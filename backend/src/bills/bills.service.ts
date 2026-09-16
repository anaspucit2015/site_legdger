import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillDto, UpdateBillDto, RejectBillDto, VoidBillDto } from './bills.dto';
import { Decimal } from '@prisma/client/runtime/library';

const BILL_INCLUDE = {
  site: true,
  vendor: { select: { name: true } },
  submittedBy: { select: { name: true } },
  lineItems: {
    include: { task: { select: { name: true, unit: true } } },
  },
} as const;

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateBillDto, submittedById: string, role?: string) {
    if (!dto.lineItems || dto.lineItems.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    // Process each line item
    const processedItems: Array<{
      taskId: string | null;
      customTaskName: string | null;
      unit: string;
      quantity: Decimal;
      unitCostSnapshot: Decimal | null;
      amount: Decimal;
    }> = [];

    let totalAmount = new Decimal(0);

    for (const lineItem of dto.lineItems) {
      let unit: string;
      let taskId: string | null = null;
      let unitCostSnapshot: Decimal | null = null;
      let amount: Decimal;

      if (lineItem.taskId) {
        const task = await this.prisma.task.findUnique({ where: { id: lineItem.taskId } });
        if (!task) throw new NotFoundException(`Task ${lineItem.taskId} not found`);
        if (!task.isActive) throw new BadRequestException(`Task "${task.name}" is no longer active`);

        unit = task.unit;
        taskId = task.id;

        if (task.isCustom && !task.unitCost) {
          throw new BadRequestException(`Task "${task.name}" has no unit cost — use a custom line item instead`);
        } else {
          if (!task.unitCost) throw new BadRequestException(`Task "${task.name}" has no unit cost set`);
          unitCostSnapshot = task.unitCost;
          amount = task.unitCost.mul(new Decimal(lineItem.quantity));
        }
      } else {
        // Custom line item
        if (!lineItem.customTaskName || !lineItem.customTaskUnit || !lineItem.customTaskUnitCost) {
          throw new BadRequestException(
            'customTaskName, customTaskUnit, and customTaskUnitCost are required when taskId is not provided',
          );
        }
        unit = lineItem.customTaskUnit;
        unitCostSnapshot = new Decimal(lineItem.customTaskUnitCost);
        amount = unitCostSnapshot.mul(new Decimal(lineItem.quantity));
      }

      totalAmount = totalAmount.add(amount);
      processedItems.push({
        taskId,
        customTaskName: lineItem.taskId ? null : (lineItem.customTaskName ?? null),
        unit,
        quantity: new Decimal(lineItem.quantity),
        unitCostSnapshot,
        amount,
      });
    }

    const status = (role === 'admin' && dto.status && ['pending', 'approved'].includes(dto.status))
      ? dto.status
      : 'pending';
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          siteId: dto.siteId,
          submittedById,
          vendorId: dto.vendorId ?? null,
          totalAmount,
          description: dto.description ?? null,
          attachmentUrl: dto.attachmentUrl ?? null,
          status,
          ...(status === 'approved' && { approvedBy: submittedById, approvedAt: now }),
          lineItems: { create: processedItems },
        },
        include: BILL_INCLUDE,
      });

      // When creating as approved with a vendor, credit vendor balance immediately
      if (status === 'approved' && dto.vendorId) {
        const vendor = await tx.vendor.findUnique({ where: { id: dto.vendorId } });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const outstandingAfter = new Decimal(vendor.currentBalance.toString()).add(totalAmount);
        const advanceAfter     = new Decimal(vendor.advanceBalance.toString());

        await tx.vendor.update({
          where: { id: dto.vendorId },
          data:  { currentBalance: outstandingAfter },
        });

        await tx.vendorTransaction.create({
          data: {
            vendorId:        dto.vendorId,
            type:            'BILL_APPROVED',
            amount:          totalAmount,
            billId:          bill.id,
            outstandingAfter,
            advanceAfter,
            performedById:   submittedById,
          },
        });
      }

      return bill;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async findAll(
    filters: { siteId?: string; vendorId?: string; submittedById?: string; status?: string },
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      deleteRequested: false,
      ...(filters.siteId        && { siteId:        filters.siteId }),
      ...(filters.vendorId      && { vendorId:      filters.vendorId }),
      ...(filters.submittedById && { submittedById: filters.submittedById }),
      ...(filters.status        && { status:        filters.status as any }),
    };
    const [data, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        include: BILL_INCLUDE,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.bill.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: BILL_INCLUDE,
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  // ─── Admin: Update (pending only) ────────────────────────────────────────

  async adminUpdate(id: string, dto: UpdateBillDto) {
    const bill = await this.findOne(id);
    if (bill.status !== 'pending')
      throw new BadRequestException('Only pending bills can be edited');

    return this.prisma.bill.update({
      where: { id },
      data: {
        ...(dto.vendorId      !== undefined && { vendorId:      dto.vendorId      || null }),
        ...(dto.description   !== undefined && { description:   dto.description   || null }),
        ...(dto.attachmentUrl !== undefined && { attachmentUrl: dto.attachmentUrl || null }),
      },
      include: BILL_INCLUDE,
    });
  }

  // ─── Approve — credits vendor balance ────────────────────────────────────

  async approve(id: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id } });
      if (!bill) throw new NotFoundException('Bill not found');
      if (bill.deleteRequested)
        throw new BadRequestException('Cannot approve a bill with a pending deletion request');
      if (bill.status !== 'pending')
        throw new BadRequestException('Only pending bills can be approved');

      const now = new Date();
      let outstandingAfter = new Decimal(0);
      let advanceAfter = new Decimal(0);

      if (bill.vendorId) {
        const vendor = await tx.vendor.findUnique({ where: { id: bill.vendorId } });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const amount = new Decimal(bill.totalAmount.toString());
        outstandingAfter = new Decimal(vendor.currentBalance.toString()).add(amount);
        advanceAfter = new Decimal(vendor.advanceBalance.toString());

        await tx.vendor.update({
          where: { id: bill.vendorId },
          data: { currentBalance: outstandingAfter },
        });

        await tx.vendorTransaction.create({
          data: {
            vendorId: bill.vendorId,
            type: 'BILL_APPROVED',
            amount: bill.totalAmount,
            billId: id,
            outstandingAfter,
            advanceAfter,
            performedById: adminId,
          },
        });
      }

      return tx.bill.update({
        where: { id },
        data: { status: 'approved', approvedBy: adminId, approvedAt: now },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Reject ───────────────────────────────────────────────────────────────

  async reject(id: string, dto: RejectBillDto, adminId: string) {
    const bill = await this.findOne(id);
    if (bill.deleteRequested)
      throw new BadRequestException('Cannot reject a bill with a pending deletion request');
    if (bill.status !== 'pending')
      throw new BadRequestException('Only pending bills can be rejected');
    if (dto.rejectionReason === 'Other' && !dto.rejectionReasonOther)
      throw new BadRequestException('rejectionReasonOther is required when reason is "Other"');

    return this.prisma.bill.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason,
        rejectionReasonOther: dto.rejectionReasonOther ?? null,
      },
    });
  }

  // ─── Admin: Void approved bill ────────────────────────────────────────────

  async void(id: string, dto: VoidBillDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id } });
      if (!bill) throw new NotFoundException('Bill not found');
      if (bill.status !== 'approved')
        throw new BadRequestException('Only approved bills can be voided');

      if (bill.vendorId) {
        // Find the original BILL_APPROVED transaction for this bill
        const originalTxn = await tx.vendorTransaction.findFirst({
          where: { billId: id, type: 'BILL_APPROVED' },
          include: { reversedBy: { select: { id: true } } },
        });

        if (originalTxn) {
          if (originalTxn.reversedBy.length > 0)
            throw new BadRequestException('The balance credit for this bill has already been reversed');

          const vendor = await tx.vendor.findUnique({ where: { id: bill.vendorId } });
          if (!vendor) throw new NotFoundException('Vendor not found');

          const amount = new Decimal(bill.totalAmount.toString());
          const outstandingAfter = new Decimal(vendor.currentBalance.toString()).sub(amount);
          const advanceAfter = new Decimal(vendor.advanceBalance.toString());

          await tx.vendor.update({
            where: { id: bill.vendorId },
            data: { currentBalance: outstandingAfter },
          });

          await tx.vendorTransaction.create({
            data: {
              vendorId: bill.vendorId,
              type: 'REVERSAL',
              amount: bill.totalAmount,
              reversesId: originalTxn.id,
              outstandingAfter,
              advanceAfter,
              notes: dto.reason,
              performedById: adminId,
            },
          });
        }
      }

      return tx.bill.update({
        where: { id },
        data: { status: 'voided' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Request Delete ───────────────────────────────────────────────────────

  async requestDelete(id: string, submittedById: string) {
    const bill = await this.findOne(id);
    if (bill.submittedById !== submittedById)
      throw new ForbiddenException('Not your bill');
    if (bill.status !== 'pending')
      throw new BadRequestException('Only pending bills can be delete-requested');
    if (bill.deleteRequested)
      throw new BadRequestException('Delete already requested');

    return this.prisma.bill.update({
      where: { id },
      data: {
        deleteRequested: true,
        deleteRequestedBy: submittedById,
        deleteRequestedAt: new Date(),
      },
    });
  }

  // ─── Admin: Direct Delete ─────────────────────────────────────────────────

  async adminDelete(id: string, adminId: string) {
    const bill = await this.findOne(id);
    if (!['pending', 'approved', 'voided'].includes(bill.status))
      throw new BadRequestException('Only pending, approved, or voided bills can be deleted');

    if (bill.status === 'approved' && bill.vendorId) {
      return this.prisma.$transaction(async (tx) => {
        const originalTxn = await tx.vendorTransaction.findFirst({
          where: { billId: id, type: 'BILL_APPROVED' },
          include: { reversedBy: { select: { id: true } } },
        });

        if (originalTxn && originalTxn.reversedBy.length === 0) {
          const vendor = await tx.vendor.findUnique({ where: { id: bill.vendorId! } });
          if (!vendor) throw new NotFoundException('Vendor not found');

          const amount = new Decimal(bill.totalAmount.toString());
          const outstandingAfter = new Decimal(vendor.currentBalance.toString()).sub(amount);
          const advanceAfter = new Decimal(vendor.advanceBalance.toString());

          await tx.vendor.update({
            where: { id: bill.vendorId! },
            data: { currentBalance: outstandingAfter },
          });

          // Null out the billId on the original txn to avoid FK constraint on delete
          await tx.vendorTransaction.update({
            where: { id: originalTxn.id },
            data: { billId: null },
          });

          await tx.vendorTransaction.create({
            data: {
              vendorId: bill.vendorId!,
              type: 'REVERSAL',
              amount,
              reversesId: originalTxn.id,
              outstandingAfter,
              advanceAfter,
              notes: `Bill BILL-${String(bill.billNumber).padStart(5, '0')} deleted`,
              performedById: adminId,
            },
          });
        }

        await tx.bill.delete({ where: { id } });
        return { deleted: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    await this.prisma.bill.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Admin: Resolve Delete Request ────────────────────────────────────────

  async resolveDeleteRequest(id: string, approve: boolean, adminId: string) {
    const bill = await this.findOne(id);
    if (!bill.deleteRequested)
      throw new BadRequestException('No delete request on this bill');

    if (approve) {
      await this.prisma.bill.delete({ where: { id } });
      return { deleted: true };
    }

    return this.prisma.bill.update({
      where: { id },
      data: { deleteApprovedBy: adminId, deleteDecisionAt: new Date() },
    });
  }

  // ─── Admin: Pending Delete Requests ───────────────────────────────────────

  async findPendingDeleteRequests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { deleteRequested: true, deleteApprovedBy: null };
    const [data, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        include: BILL_INCLUDE,
        orderBy: { deleteRequestedAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.bill.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
