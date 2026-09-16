import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, RejectInvoiceDto, UpdateInvoiceDto, VoidInvoiceDto } from './invoices.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateInvoiceDto, submittedById: string, role?: string) {
    let amount: Decimal;
    let unitCostSnapshot: Decimal | null = null;
    let unit: string;
    let taskId: string | null = null;

    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
      if (!task) throw new NotFoundException('Task not found');
      if (!task.isActive) throw new BadRequestException('Task is no longer active');

      unit = task.unit;
      taskId = task.id;

      if (task.isCustom && !task.unitCost) {
        if (!dto.amount) throw new BadRequestException('amount is required for custom tasks');
        amount = new Decimal(dto.amount);
      } else {
        if (!task.unitCost) throw new BadRequestException('Task has no unit cost set');
        unitCostSnapshot = task.unitCost;
        amount = task.unitCost.mul(new Decimal(dto.quantity));
      }
    } else {
      if (!dto.customTaskName || !dto.customTaskUnit || !dto.customTaskUnitCost) {
        throw new BadRequestException(
          'customTaskName, customTaskUnit, and customTaskUnitCost are required when taskId is not provided',
        );
      }
      unit = dto.customTaskUnit;
      unitCostSnapshot = new Decimal(dto.customTaskUnitCost);
      amount = unitCostSnapshot.mul(new Decimal(dto.quantity));
    }

    const allowedStatus = role === 'admin' && dto.status && ['pending', 'approved'].includes(dto.status)
      ? dto.status
      : 'pending';
    const now = new Date();

    const invoiceData = {
      taskId,
      customTaskName: dto.taskId ? null : (dto.customTaskName ?? null),
      siteId: dto.siteId,
      submittedById,
      vendorId: dto.vendorId,
      unit,
      quantity: dto.quantity,
      unitCostSnapshot,
      amount,
      description: dto.description ?? null,
      attachmentUrl: dto.attachmentUrl ?? null,
      status: allowedStatus as any,
      ...(allowedStatus === 'approved' && { approvedBy: submittedById, approvedAt: now }),
    };
    const invoiceInclude = { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } };

    // When creating as approved with a vendor, credit vendor balance immediately
    if (allowedStatus === 'approved' && dto.vendorId) {
      return this.prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.findUnique({ where: { id: dto.vendorId! } });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const outstandingAfter = new Decimal(vendor.currentBalance.toString()).add(amount);
        const advanceAfter     = new Decimal(vendor.advanceBalance.toString());

        await tx.vendor.update({
          where: { id: dto.vendorId! },
          data:  { currentBalance: outstandingAfter },
        });

        const invoice = await tx.invoice.create({ data: invoiceData, include: invoiceInclude });

        await tx.vendorTransaction.create({
          data: {
            vendorId:        dto.vendorId!,
            type:            'INVOICE_APPROVED',
            amount,
            invoiceId:       invoice.id,
            outstandingAfter,
            advanceAfter,
            performedById:   submittedById,
          },
        });

        return invoice;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    return this.prisma.invoice.create({ data: invoiceData, include: invoiceInclude });
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
      this.prisma.invoice.findMany({
        where,
        include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ─── Site Supervisor: Edit (pending only) ────────────────────────────────

  async update(id: string, dto: UpdateInvoiceDto, submittedById: string, role?: string) {
    const invoice = await this.findOne(id);
    if (role !== 'admin' && invoice.submittedById !== submittedById)
      throw new ForbiddenException('Not your invoice');
    if (invoice.status !== 'pending')
      throw new BadRequestException('Only pending invoices can be edited');

    let amount = invoice.amount;
    if (dto.quantity && invoice.unitCostSnapshot) {
      amount = invoice.unitCostSnapshot.mul(new Decimal(dto.quantity));
    } else if (dto.amount) {
      amount = new Decimal(dto.amount);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.vendorId     && { vendorId: dto.vendorId }),
        ...(dto.quantity     && { quantity: dto.quantity }),
        amount,
        ...(dto.description   !== undefined && { description:   dto.description }),
        ...(dto.attachmentUrl !== undefined && { attachmentUrl: dto.attachmentUrl }),
        syncVersion: { increment: 1 },
      },
      include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
    });
  }

  // ─── Site Supervisor / Accountant: Delete Request (pending only) ─────────

  async requestDelete(id: string, submittedById: string) {
    const invoice = await this.findOne(id);
    if (invoice.submittedById !== submittedById)
      throw new ForbiddenException('Not your invoice');
    if (invoice.status !== 'pending')
      throw new BadRequestException('Only pending invoices can be delete-requested');
    if (invoice.deleteRequested)
      throw new BadRequestException('Delete already requested');

    return this.prisma.invoice.update({
      where: { id },
      data: { deleteRequested: true, deleteRequestedBy: submittedById, deleteRequestedAt: new Date() },
    });
  }

  // ─── Admin: Direct Delete ───────────────────────────────────────────────────

  async adminDelete(id: string, adminId: string) {
    const invoice = await this.findOne(id);
    if (!['pending', 'approved', 'voided'].includes(invoice.status))
      throw new BadRequestException('Only pending, approved, or voided invoices can be deleted');

    if (invoice.status === 'approved' && invoice.vendorId) {
      return this.prisma.$transaction(async (tx) => {
        const originalTxn = await tx.vendorTransaction.findFirst({
          where: { invoiceId: id, type: 'INVOICE_APPROVED' },
          include: { reversedBy: { select: { id: true } } },
        });

        if (originalTxn && originalTxn.reversedBy.length === 0) {
          const vendor = await tx.vendor.findUnique({ where: { id: invoice.vendorId! } });
          if (!vendor) throw new NotFoundException('Vendor not found');

          const amount = new Decimal(invoice.amount.toString());
          const outstandingAfter = new Decimal(vendor.currentBalance.toString()).sub(amount);
          const advanceAfter = new Decimal(vendor.advanceBalance.toString());

          await tx.vendor.update({
            where: { id: invoice.vendorId! },
            data: { currentBalance: outstandingAfter },
          });

          // Null out the invoiceId on the original txn to avoid FK constraint on delete
          await tx.vendorTransaction.update({
            where: { id: originalTxn.id },
            data: { invoiceId: null },
          });

          await tx.vendorTransaction.create({
            data: {
              vendorId: invoice.vendorId!,
              type: 'REVERSAL',
              amount,
              reversesId: originalTxn.id,
              outstandingAfter,
              advanceAfter,
              notes: `Invoice INV-${String(invoice.invoiceNumber).padStart(5, '0')} deleted`,
              performedById: adminId,
            },
          });
        }

        await tx.invoice.delete({ where: { id } });
        return { deleted: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Admin: Approve — credits vendor balance ──────────────────────────────

  async approve(id: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.deleteRequested)
        throw new BadRequestException('Cannot approve an invoice with a pending deletion request');
      if (invoice.status !== 'pending')
        throw new BadRequestException('Only pending invoices can be approved');

      const now = new Date();
      let outstandingAfter = new Decimal(0);
      let advanceAfter = new Decimal(0);

      if (invoice.vendorId) {
        const vendor = await tx.vendor.findUnique({ where: { id: invoice.vendorId } });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const amount = new Decimal(invoice.amount.toString());
        outstandingAfter = new Decimal(vendor.currentBalance.toString()).add(amount);
        advanceAfter = new Decimal(vendor.advanceBalance.toString());

        await tx.vendor.update({
          where: { id: invoice.vendorId },
          data: { currentBalance: outstandingAfter },
        });

        await tx.vendorTransaction.create({
          data: {
            vendorId: invoice.vendorId,
            type: 'INVOICE_APPROVED',
            amount: invoice.amount,
            invoiceId: id,
            outstandingAfter,
            advanceAfter,
            performedById: adminId,
          },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'approved', approvedBy: adminId, approvedAt: now },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Admin: Reject ────────────────────────────────────────────────────────

  async reject(id: string, dto: RejectInvoiceDto, adminId: string) {
    const invoice = await this.findOne(id);
    if (invoice.deleteRequested)
      throw new BadRequestException('Cannot reject an invoice with a pending deletion request');
    if (invoice.status !== 'pending')
      throw new BadRequestException('Only pending invoices can be rejected');
    if (dto.rejectionReason === 'Other' && !dto.rejectionReasonOther)
      throw new BadRequestException('rejectionReasonOther is required when reason is "Other"');

    return this.prisma.invoice.update({
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

  // ─── Admin: Void approved invoice ────────────────────────────────────────

  async void(id: string, dto: VoidInvoiceDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'approved')
        throw new BadRequestException('Only approved invoices can be voided');

      if (invoice.vendorId) {
        // Find the original INVOICE_APPROVED transaction for this invoice
        const originalTxn = await tx.vendorTransaction.findFirst({
          where: { invoiceId: id, type: 'INVOICE_APPROVED' },
          include: { reversedBy: { select: { id: true } } },
        });

        if (originalTxn) {
          if (originalTxn.reversedBy.length > 0)
            throw new BadRequestException('The balance credit for this invoice has already been reversed');

          const vendor = await tx.vendor.findUnique({ where: { id: invoice.vendorId } });
          if (!vendor) throw new NotFoundException('Vendor not found');

          const amount = new Decimal(invoice.amount.toString());
          const outstandingAfter = new Decimal(vendor.currentBalance.toString()).sub(amount);
          const advanceAfter = new Decimal(vendor.advanceBalance.toString());

          await tx.vendor.update({
            where: { id: invoice.vendorId },
            data: { currentBalance: outstandingAfter },
          });

          await tx.vendorTransaction.create({
            data: {
              vendorId: invoice.vendorId,
              type: 'REVERSAL',
              amount: invoice.amount,
              reversesId: originalTxn.id,
              outstandingAfter,
              advanceAfter,
              notes: dto.reason,
              performedById: adminId,
            },
          });
        }
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'voided' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Admin: Handle Delete Request ─────────────────────────────────────────

  async resolveDeleteRequest(id: string, approve: boolean, adminId: string) {
    const invoice = await this.findOne(id);
    if (!invoice.deleteRequested)
      throw new BadRequestException('No delete request on this invoice');

    if (approve) {
      await this.prisma.invoice.delete({ where: { id } });
      return { deleted: true };
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { deleteApprovedBy: adminId, deleteDecisionAt: new Date() },
    });
  }

  // ─── Admin: Pending Delete Requests ───────────────────────────────────────

  async findPendingDeleteRequests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { deleteRequested: true, deleteApprovedBy: null };
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
        orderBy: { deleteRequestedAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ─── Balance Summary ──────────────────────────────────────────────────────

  async getBalance(filter: { siteId?: string; vendorId?: string }) {
    const where = {
      ...(filter.siteId   && { siteId:   filter.siteId }),
      ...(filter.vendorId && { vendorId: filter.vendorId }),
    };

    const [invoices, bills, entity] = await Promise.all([
      this.prisma.invoice.findMany({ where, select: { status: true, amount: true } }),
      this.prisma.bill.findMany({ where, select: { status: true, totalAmount: true } }),
      filter.siteId
        ? this.prisma.site.findUnique({ where: { id: filter.siteId }, select: { currentBalance: true } })
        : filter.vendorId
          ? this.prisma.vendor.findUnique({ where: { id: filter.vendorId }, select: { currentBalance: true } })
          : Promise.resolve(null),
    ]);

    const currentBalance = Number(entity?.currentBalance ?? 0);

    function tally(rows: { status: string; amount?: any; totalAmount?: any }[]) {
      const s = {
        totalAmount: 0, approvedAmount: 0, pendingAmount: 0, rejectedAmount: 0, voidedAmount: 0,
        totalCount: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0, voidedCount: 0,
      };
      for (const r of rows) {
        const amt = Number(r.amount ?? r.totalAmount);
        if (r.status === 'voided') { s.voidedAmount += amt; s.voidedCount++; continue; }
        s.totalAmount += amt;
        s.totalCount++;
        if (r.status === 'approved') { s.approvedAmount += amt; s.approvedCount++; }
        if (r.status === 'pending')  { s.pendingAmount  += amt; s.pendingCount++;  }
        if (r.status === 'rejected') { s.rejectedAmount += amt; s.rejectedCount++; }
      }
      return s;
    }

    const inv  = tally(invoices);
    const bill = tally(bills);

    return {
      currentBalance,
      totalAmount:    inv.totalAmount    + bill.totalAmount    + currentBalance,
      approvedAmount: inv.approvedAmount + bill.approvedAmount,
      pendingAmount:  inv.pendingAmount  + bill.pendingAmount,
      rejectedAmount: inv.rejectedAmount + bill.rejectedAmount,
      voidedAmount:   inv.voidedAmount   + bill.voidedAmount,
      totalCount:     inv.totalCount     + bill.totalCount,
      approvedCount:  inv.approvedCount  + bill.approvedCount,
      pendingCount:   inv.pendingCount   + bill.pendingCount,
      rejectedCount:  inv.rejectedCount  + bill.rejectedCount,
      voidedCount:    inv.voidedCount    + bill.voidedCount,
      invoices: inv,
      bills:    bill,
    };
  }
}
