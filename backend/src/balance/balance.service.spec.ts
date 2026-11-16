import { Decimal } from '@prisma/client/runtime/library';
import { BalanceService } from './balance.service';

function makePrisma(overrides: {
  invoiceSum?: Decimal | null;
  billSum?: Decimal | null;
  openingBalance?: Decimal | null;
} = {}) {
  const {
    invoiceSum = new Decimal(0),
    billSum = new Decimal(0),
    openingBalance = new Decimal(0),
  } = overrides;

  return {
    invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: invoiceSum } }) },
    bill:    { aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: billSum } }) },
    site:    { findUnique: jest.fn().mockResolvedValue({ openingBalance }) },
    vendor:  { findUnique: jest.fn().mockResolvedValue({ openingBalance }) },
  } as any;
}

describe('BalanceService.getTotalToDate', () => {
  it('1. sums opening balance + approved invoice + approved bill', async () => {
    const prisma = makePrisma({
      invoiceSum: new Decimal(5000),
      billSum: new Decimal(3000),
      openingBalance: new Decimal(90000),
    });
    const service = new BalanceService(prisma);

    const total = await service.getTotalToDate({ vendorId: 'v1' });

    expect(total.toNumber()).toBe(98000);
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith({
      where: { status: 'approved', vendorId: 'v1' },
      _sum: { amount: true },
    });
    expect(prisma.bill.aggregate).toHaveBeenCalledWith({
      where: { status: 'approved', vendorId: 'v1' },
      _sum: { totalAmount: true },
    });
  });

  it('2. a pending or rejected invoice is not counted -- query always filters status=approved', async () => {
    const prisma = makePrisma({ openingBalance: new Decimal(10000) });
    const service = new BalanceService(prisma);

    await service.getTotalToDate({ siteId: 's1' });

    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
    );
    expect(prisma.bill.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
    );
  });

  it('3. approve then void an invoice: the total returns to its earlier value', async () => {
    const prisma = makePrisma({ openingBalance: new Decimal(10000) });
    const service = new BalanceService(prisma);

    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(0) } });
    const before = await service.getTotalToDate({ siteId: 's1' });

    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(5000) } });
    const afterApprove = await service.getTotalToDate({ siteId: 's1' });

    // Voided status is excluded by the status='approved' filter -- aggregate reflects 0 again
    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(0) } });
    const afterVoid = await service.getTotalToDate({ siteId: 's1' });

    expect(before.toNumber()).toBe(10000);
    expect(afterApprove.toNumber()).toBe(15000);
    expect(afterVoid.toNumber()).toBe(before.toNumber());
  });

  it('4. a hard-deleted invoice is not counted (row is gone, aggregate reflects its absence)', async () => {
    const prisma = makePrisma({ openingBalance: new Decimal(10000) });
    const service = new BalanceService(prisma);

    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(5000) } });
    const withInvoice = await service.getTotalToDate({ siteId: 's1' });

    // adminDelete() physically removes the row -- no flag involved, the aggregate just stops seeing it
    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { amount: new Decimal(0) } });
    const afterDelete = await service.getTotalToDate({ siteId: 's1' });

    expect(withInvoice.toNumber()).toBe(15000);
    expect(afterDelete.toNumber()).toBe(10000);
  });

  it('5. a payment or advance does NOT change the total', async () => {
    const prisma = makePrisma({
      invoiceSum: new Decimal(5000),
      billSum: new Decimal(0),
      openingBalance: new Decimal(10000),
    });
    const service = new BalanceService(prisma);

    const total = await service.getTotalToDate({ vendorId: 'v1' });

    expect(total.toNumber()).toBe(15000);
    // The function only ever selects openingBalance -- it never reads advanceBalance,
    // currentBalance, or any VendorTransaction row.
    expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { openingBalance: true },
    });
  });

  it('6. no approved invoices or bills: total equals opening balance only', async () => {
    const prisma = makePrisma({
      invoiceSum: null,
      billSum: null,
      openingBalance: new Decimal(42000),
    });
    const service = new BalanceService(prisma);

    const total = await service.getTotalToDate({ siteId: 's1' });

    expect(total.toNumber()).toBe(42000);
  });
});
