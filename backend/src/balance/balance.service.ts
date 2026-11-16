import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  // Total to date = opening balance + every approved invoice + every approved bill,
  // filtered by site or vendor. Computed fresh on every read -- reads only the
  // Invoice/Bill tables (never the VendorTransaction ledger rows, which would
  // double count the same approvals).
  async getTotalToDate(filter: { siteId?: string; vendorId?: string }): Promise<Decimal> {
    const where = {
      status: 'approved' as const,
      ...(filter.siteId   && { siteId:   filter.siteId }),
      ...(filter.vendorId && { vendorId: filter.vendorId }),
    };

    const [invoiceAgg, billAgg, openingBalance] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _sum: { amount: true } }),
      this.prisma.bill.aggregate({ where, _sum: { totalAmount: true } }),
      this.getOpeningBalance(filter),
    ]);

    const invoiceSum = invoiceAgg._sum.amount ?? new Decimal(0);
    const billSum    = billAgg._sum.totalAmount ?? new Decimal(0);

    return openingBalance.add(invoiceSum).add(billSum);
  }

  private async getOpeningBalance(filter: { siteId?: string; vendorId?: string }): Promise<Decimal> {
    if (filter.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: filter.siteId },
        select: { openingBalance: true },
      });
      return site?.openingBalance ?? new Decimal(0);
    }
    if (filter.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: filter.vendorId },
        select: { openingBalance: true },
      });
      return vendor?.openingBalance ?? new Decimal(0);
    }
    return new Decimal(0);
  }
}
