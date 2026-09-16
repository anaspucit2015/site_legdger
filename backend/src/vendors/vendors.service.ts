import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyAdvanceDto, CreateVendorDto, GiveAdvanceDto, PayVendorDto, UpdateVendorDto } from './vendors.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({ data: dto });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({ orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.vendor.count(),
    ]);
    return { data, total, page, limit };
  }

  findActive() {
    return this.prisma.vendor.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  private async checkNoOpenRecords(vendorId: string) {
    const [invoiceCount, billCount] = await Promise.all([
      this.prisma.invoice.count({
        where: { vendorId, status: { in: ['pending', 'approved'] } },
      }),
      this.prisma.bill.count({
        where: { vendorId, status: { in: ['pending', 'approved'] } },
      }),
    ]);
    if (invoiceCount > 0 || billCount > 0) {
      throw new BadRequestException(
        `Cannot perform this action — vendor has ${invoiceCount + billCount} invoice(s)/bill(s) that are still pending or approved. All must be voided or rejected first.`,
      );
    }
  }

  private checkNoBalance(vendor: { currentBalance: Decimal; advanceBalance: Decimal }) {
    const outstanding = Number(vendor.currentBalance);
    const advance = Number(vendor.advanceBalance);
    if (outstanding !== 0 || advance !== 0) {
      throw new BadRequestException(
        `Cannot perform this action — vendor has a non-zero balance. Outstanding: PKR ${outstanding.toFixed(2)}, Advance: PKR ${advance.toFixed(2)}. Settle all balances first.`,
      );
    }
  }

  async deactivate(id: string) {
    const vendor = await this.findOne(id);
    await this.checkNoOpenRecords(id);
    this.checkNoBalance(vendor);
    return this.prisma.vendor.update({ where: { id }, data: { isActive: false } });
  }

  async archive(id: string) {
    const vendor = await this.findOne(id);
    await this.checkNoOpenRecords(id);
    this.checkNoBalance(vendor);
    return this.prisma.vendor.update({ where: { id }, data: { isArchived: true } });
  }

  // ─── Give Advance ─────────────────────────────────────────────────────────

  async giveAdvance(id: string, dto: GiveAdvanceDto, performedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { id } });
      if (!vendor) throw new NotFoundException('Vendor not found');
      if (!vendor.isActive || vendor.isArchived) throw new BadRequestException('Vendor is not active');

      const amount = new Decimal(dto.amount);
      const newAdvance = new Decimal(vendor.advanceBalance.toString()).add(amount);
      const outstandingAfter = new Decimal(vendor.currentBalance.toString());

      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: { advanceBalance: newAdvance },
      });

      const transaction = await tx.vendorTransaction.create({
        data: {
          vendorId: id,
          type: 'ADVANCE_GIVEN',
          amount,
          outstandingAfter,
          advanceAfter: newAdvance,
          notes: dto.notes ?? null,
          performedById,
        },
      });

      return { vendor: updatedVendor, transaction };
    });
  }

  // ─── Apply Advance to Balance ─────────────────────────────────────────────

  async applyAdvance(id: string, dto: ApplyAdvanceDto, performedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { id } });
      if (!vendor) throw new NotFoundException('Vendor not found');
      if (!vendor.isActive || vendor.isArchived) throw new BadRequestException('Vendor is not active');

      const amount = new Decimal(dto.amount);
      const advance = new Decimal(vendor.advanceBalance.toString());
      const outstanding = new Decimal(vendor.currentBalance.toString());

      if (amount.gt(advance)) {
        throw new BadRequestException(
          `Cannot apply more than advance balance. Available advance: PKR ${advance.toFixed(2)}, Requested: PKR ${amount.toFixed(2)}`,
        );
      }
      if (amount.gt(outstanding)) {
        throw new BadRequestException(
          `Cannot apply more than outstanding balance. Outstanding: PKR ${outstanding.toFixed(2)}, Requested: PKR ${amount.toFixed(2)}`,
        );
      }

      const newAdvance = advance.sub(amount);
      const newOutstanding = outstanding.sub(amount);

      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: { advanceBalance: newAdvance, currentBalance: newOutstanding },
      });

      const transaction = await tx.vendorTransaction.create({
        data: {
          vendorId: id,
          type: 'ADVANCE_APPLIED',
          amount,
          outstandingAfter: newOutstanding,
          advanceAfter: newAdvance,
          notes: dto.notes ?? null,
          performedById,
        },
      });

      return { vendor: updatedVendor, transaction };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Pay Vendor ───────────────────────────────────────────────────────────

  async payVendor(id: string, dto: PayVendorDto, performedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { id } });
      if (!vendor) throw new NotFoundException('Vendor not found');
      if (!vendor.isActive || vendor.isArchived) throw new BadRequestException('Vendor is not active');

      const amount = new Decimal(dto.amount);
      const outstanding = new Decimal(vendor.currentBalance.toString());

      if (dto.paymentMethod !== 'CASH' && !dto.paymentRef) {
        throw new BadRequestException(
          `paymentRef is required for payment method ${dto.paymentMethod}`,
        );
      }

      // If payment exceeds outstanding, the excess becomes advance
      const excess = amount.gt(outstanding) ? amount.sub(outstanding) : new Decimal(0);
      const newOutstanding = outstanding.sub(amount).lt(0) ? new Decimal(0) : outstanding.sub(amount);
      const advanceAfter = new Decimal(vendor.advanceBalance.toString()).add(excess);

      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: { currentBalance: newOutstanding, advanceBalance: advanceAfter },
      });

      const transaction = await tx.vendorTransaction.create({
        data: {
          vendorId: id,
          type: 'VENDOR_PAYMENT',
          amount,
          paymentMethod: dto.paymentMethod,
          paymentRef: dto.paymentRef ?? null,
          invoiceReferenceNote: dto.invoiceReferenceNote ?? null,
          outstandingAfter: newOutstanding,
          advanceAfter,
          notes: dto.notes ?? null,
          performedById,
        },
      });

      return { vendor: updatedVendor, transaction };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ─── Transactions Ledger ──────────────────────────────────────────────────

  async getTransactions(id: string, page = 1, limit = 20) {
    await this.findOne(id);
    const skip = (page - 1) * limit;

    const [data, total, vendor] = await Promise.all([
      this.prisma.vendorTransaction.findMany({
        where: { vendorId: id },
        include: {
          invoice: { select: { invoiceNumber: true } },
          bill: { select: { billNumber: true } },
          performedBy: { select: { name: true } },
          reverses: { select: { id: true, type: true } },
          reversedBy: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vendorTransaction.count({ where: { vendorId: id } }),
      this.prisma.vendor.findUnique({
        where: { id },
        select: { currentBalance: true, advanceBalance: true, name: true },
      }),
    ]);

    const outstandingBalance = Number(vendor!.currentBalance);
    const advanceBalance = Number(vendor!.advanceBalance);

    return {
      data,
      total,
      page,
      limit,
      summary: {
        vendorName: vendor!.name,
        outstandingBalance,
        advanceBalance,
        netPayable: outstandingBalance - advanceBalance,
      },
    };
  }

  // ─── Financial Statement ──────────────────────────────────────────────────

  async getStatement(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        transactions: true,
        invoices: { select: { status: true, amount: true } },
        bills: { select: { status: true, totalAmount: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const txns = vendor.transactions;

    const totalAdvanceGiven = txns
      .filter((t) => t.type === 'ADVANCE_GIVEN')
      .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

    const totalAdvanceApplied = txns
      .filter((t) => t.type === 'ADVANCE_APPLIED')
      .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

    const totalVendorPayments = txns
      .filter((t) => t.type === 'VENDOR_PAYMENT')
      .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

    const totalInvoicesApproved = txns
      .filter((t) => t.type === 'INVOICE_APPROVED')
      .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

    const totalBillsApproved = txns
      .filter((t) => t.type === 'BILL_APPROVED')
      .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

    const computedAdvance = totalAdvanceGiven.sub(totalAdvanceApplied);
    const storedAdvance = new Decimal(vendor.advanceBalance.toString());

    const totalDebits = totalInvoicesApproved.add(totalBillsApproved);
    const totalCredits = totalVendorPayments.add(totalAdvanceApplied);
    const computedOutstanding = totalDebits.sub(totalCredits);
    const storedOutstanding = new Decimal(vendor.currentBalance.toString());

    const reconciliationOk =
      computedAdvance.toFixed(2) === storedAdvance.toFixed(2) &&
      computedOutstanding.toFixed(2) === storedOutstanding.toFixed(2);

    function tallyDocs(rows: { status: string; amount?: Decimal; totalAmount?: Decimal }[]) {
      const result = { total: 0, count: 0, byStatus: { pending: 0, approved: 0, voided: 0, rejected: 0 } };
      for (const r of rows) {
        const amt = Number(r.amount ?? r.totalAmount);
        result.total += amt;
        result.count++;
        if (r.status === 'pending')  result.byStatus.pending  += amt;
        else if (r.status === 'approved') result.byStatus.approved += amt;
        else if (r.status === 'voided')   result.byStatus.voided   += amt;
        else if (r.status === 'rejected') result.byStatus.rejected += amt;
      }
      return result;
    }

    return {
      outstandingBalance: Number(vendor.currentBalance),
      advanceBalance: Number(vendor.advanceBalance),
      netPayable: Number(vendor.currentBalance) - Number(vendor.advanceBalance),
      totalAdvanceGiven: Number(totalAdvanceGiven),
      totalAdvanceApplied: Number(totalAdvanceApplied),
      totalVendorPayments: Number(totalVendorPayments),
      totalInvoicesApproved: Number(totalInvoicesApproved),
      totalBillsApproved: Number(totalBillsApproved),
      reconciliationOk,
      invoices: tallyDocs(vendor.invoices),
      bills: tallyDocs(vendor.bills),
    };
  }

  // ─── Reverse Transaction ──────────────────────────────────────────────────

  async reverseTransaction(txnId: string, reason: string, performedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.vendorTransaction.findUnique({
        where: { id: txnId },
        include: { reversedBy: { select: { id: true } } },
      });
      if (!original) throw new NotFoundException('Transaction not found');
      if (original.reversedBy.length > 0) throw new BadRequestException('This transaction has already been reversed');
      if (original.type === 'REVERSAL') throw new BadRequestException('Cannot reverse a reversal');

      const vendor = await tx.vendor.findUnique({ where: { id: original.vendorId } });
      if (!vendor) throw new NotFoundException('Vendor not found');

      const amount = new Decimal(original.amount.toString());
      let outstandingAfter = new Decimal(vendor.currentBalance.toString());
      let advanceAfter = new Decimal(vendor.advanceBalance.toString());

      if (original.type === 'ADVANCE_GIVEN') {
        advanceAfter = advanceAfter.sub(amount);
        await tx.vendor.update({ where: { id: vendor.id }, data: { advanceBalance: advanceAfter } });
      } else if (original.type === 'INVOICE_APPROVED' || original.type === 'BILL_APPROVED') {
        outstandingAfter = outstandingAfter.sub(amount);
        await tx.vendor.update({ where: { id: vendor.id }, data: { currentBalance: outstandingAfter } });

        // Reset the linked invoice/bill back to pending so it can be re-approved
        if (original.type === 'INVOICE_APPROVED' && original.invoiceId) {
          await tx.invoice.update({
            where: { id: original.invoiceId },
            data: { status: 'pending', approvedBy: null, approvedAt: null },
          });
        }
        if (original.type === 'BILL_APPROVED' && original.billId) {
          await tx.bill.update({
            where: { id: original.billId },
            data: { status: 'pending', approvedBy: null, approvedAt: null },
          });
        }
      } else if (original.type === 'ADVANCE_APPLIED') {
        // Restore both balances
        advanceAfter = advanceAfter.add(amount);
        outstandingAfter = outstandingAfter.add(amount);
        await tx.vendor.update({ where: { id: vendor.id }, data: { advanceBalance: advanceAfter, currentBalance: outstandingAfter } });
      } else if (original.type === 'VENDOR_PAYMENT') {
        outstandingAfter = outstandingAfter.add(amount);
        await tx.vendor.update({ where: { id: vendor.id }, data: { currentBalance: outstandingAfter } });
      }

      const reversalTransaction = await tx.vendorTransaction.create({
        data: {
          vendorId: original.vendorId,
          type: 'REVERSAL',
          amount,
          reversesId: txnId,
          outstandingAfter,
          advanceAfter,
          notes: reason,
          performedById,
        },
      });

      const updatedVendor = await tx.vendor.findUnique({ where: { id: original.vendorId } });
      return { vendor: updatedVendor, reversalTransaction };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
