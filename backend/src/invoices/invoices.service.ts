import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvoiceDto,
  RejectInvoiceDto,
  ReleasePaymentDto,
  UpdateInvoiceDto,
} from './invoices.dto';
import { Decimal } from '@prisma/client/runtime/library';

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
      // Predefined task flow
      const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
      if (!task) throw new NotFoundException('Task not found');
      if (!task.isActive) throw new BadRequestException('Task is no longer active');

      unit = task.unit;
      taskId = task.id;

      if (task.isCustom && !task.unitCost) {
        // Admin-created custom task with no rate: submitter provides total amount
        if (!dto.amount) throw new BadRequestException('amount is required for custom tasks');
        amount = new Decimal(dto.amount);
      } else {
        if (!task.unitCost) throw new BadRequestException('Task has no unit cost set');
        unitCostSnapshot = task.unitCost;
        amount = task.unitCost.mul(new Decimal(dto.quantity));
      }
    } else {
      // Custom task: stored directly on invoice, no Task record created
      if (!dto.customTaskName || !dto.customTaskUnit || !dto.customTaskUnitCost) {
        throw new BadRequestException(
          'customTaskName, customTaskUnit, and customTaskUnitCost are required when taskId is not provided',
        );
      }
      unit = dto.customTaskUnit;
      unitCostSnapshot = new Decimal(dto.customTaskUnitCost);
      amount = unitCostSnapshot.mul(new Decimal(dto.quantity));
    }

    const status = (role === 'admin' && dto.status) ? dto.status : 'pending';
    const now = new Date();

    return this.prisma.invoice.create({
      data: {
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
        status,
        ...(status === 'approved' && { approvedBy: submittedById, approvedAt: now }),
        ...(status === 'paid' && { approvedBy: submittedById, approvedAt: now, paidBy: submittedById, paidAt: now }),
      },
      include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
    });
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  // All invoices, filterable — excludes delete-requested (those are in their own queue)
  findAll(filters: { siteId?: string; vendorId?: string; submittedById?: string; status?: string }) {
    return this.prisma.invoice.findMany({
      where: {
        deleteRequested: false,
        ...(filters.siteId       && { siteId:       filters.siteId }),
        ...(filters.vendorId     && { vendorId:     filters.vendorId }),
        ...(filters.submittedById && { submittedById: filters.submittedById }),
        ...(filters.status       && { status:       filters.status as any }),
      },
      include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
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

    // Recalculate amount if quantity changes on predefined task
    let amount = invoice.amount;
    if (dto.quantity && invoice.unitCostSnapshot) {
      amount = invoice.unitCostSnapshot.mul(new Decimal(dto.quantity));
    } else if (dto.amount) {
      amount = new Decimal(dto.amount);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.vendorId    && { vendorId: dto.vendorId }),
        ...(dto.quantity    && { quantity: dto.quantity }),
        amount,
        ...(dto.description  !== undefined && { description:   dto.description }),
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
      data: {
        deleteRequested: true,
        deleteRequestedBy: submittedById,
        deleteRequestedAt: new Date(),
      },
    });
  }

  // ─── Admin: Direct Delete (pending / approved) ───────────────────────────

  async adminDelete(id: string) {
    const invoice = await this.findOne(id);
    if (!['pending', 'approved'].includes(invoice.status))
      throw new BadRequestException('Only pending or approved invoices can be deleted');
    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Admin: Approve ───────────────────────────────────────────────────────

  async approve(id: string, adminId: string) {
    const invoice = await this.findOne(id);
    if (invoice.deleteRequested)
      throw new BadRequestException('Cannot approve an invoice with a pending deletion request');
    if (invoice.status !== 'pending')
      throw new BadRequestException('Only pending invoices can be approved');

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'approved', approvedBy: adminId, approvedAt: new Date() },
    });
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

  findPendingDeleteRequests() {
    return this.prisma.invoice.findMany({
      where: { deleteRequested: true, deleteApprovedBy: null },
      include: { task: true, site: true, vendor: { select: { name: true } }, submittedBy: { select: { name: true } } },
      orderBy: { deleteRequestedAt: 'asc' },
    });
  }

  // ─── Accountant: Release Payment ──────────────────────────────────────────

  async releasePayment(id: string, dto: ReleasePaymentDto, accountantId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'approved')
      throw new BadRequestException('Only approved invoices can be paid');

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'paid',
        paidBy: accountantId,
        paidAt: new Date(),
        paymentRef: dto.paymentRef,
      },
    });
  }
}
