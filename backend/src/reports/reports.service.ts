import { Injectable, NotFoundException } from '@nestjs/common'; // NotFoundException used for empty report
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

function tallyByStatus(rows: { status: string; amount?: any; totalAmount?: any }[]) {
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

type AllBalancesRow = {
  label: string;
  name: string;
  extra: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  openingBalance: number;
  rangeOpeningBalance?: number; // vendor only -- balance just before rangeStart
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  voidedAmount: number;
  invoiceCount: number;
  billCount: number;
};

function buildAllBalancesWorkbook(
  sheetTitle: 'Sites' | 'Vendors',
  labelHeader: string,
  extraHeader: string,
  rows: AllBalancesRow[],
  rangeStart?: Date,
  rangeEnd?: Date,
): Promise<ExcelJS.Buffer> {
  const hasRangeOpening = sheetTitle === 'Vendors' && !!rangeStart;
  const workbook   = new ExcelJS.Workbook();
  workbook.creator = 'SiteLedger';
  workbook.created = new Date();

  const navyFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
  const navyFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const boldFont: Partial<ExcelJS.Font> = { bold: true };

  const sheet = workbook.addWorksheet(sheetTitle, { pageSetup: { orientation: 'landscape', fitToPage: true } });
  sheet.columns = [
    { header: sheetTitle === 'Sites' ? 'Site Name' : 'Vendor Name', key: 'name',           width: 26 },
    { header: labelHeader,                                          key: 'label',          width: 18 },
    { header: extraHeader,                                          key: 'extra',          width: 22 },
    ...(sheetTitle === 'Vendors' ? [
      { header: 'Bank Name',                                        key: 'bankName',       width: 20 },
      { header: 'Account Number',                                   key: 'accountNumber',  width: 20 },
      { header: 'IBAN',                                              key: 'iban',           width: 24 },
    ] : []),
    { header: 'Opening Balance (PKR)',                              key: 'openingBalance', width: 18 },
    ...(hasRangeOpening ? [
      { header: `Balance at Start (PKR) [${rangeStart!.toLocaleDateString('en-PK')}]`, key: 'rangeOpeningBalance', width: 20 },
    ] : []),
    { header: 'Approved (PKR)',                                     key: 'approvedAmount', width: 16 },
    { header: 'Pending (PKR)',                                      key: 'pendingAmount',  width: 16 },
    { header: 'Rejected (PKR)',                                     key: 'rejectedAmount', width: 16 },
    { header: 'Voided (PKR)',                                       key: 'voidedAmount',   width: 16 },
    {
      header: sheetTitle === 'Vendors'
        ? `${rangeStart ? 'Closing' : 'Outstanding'} Balance (PKR)${rangeEnd ? ` [as of ${rangeEnd.toLocaleDateString('en-PK')}]` : ''}`
        : 'Grand Total (PKR)',
      key: 'totalAmount', width: 20,
    },
    { header: 'Invoices',                                           key: 'invoiceCount',   width: 10 },
    { header: 'Bills',                                              key: 'billCount',      width: 10 },
  ];
  const periodText =
    rangeStart && rangeEnd ? `${rangeStart.toLocaleDateString('en-PK')} – ${rangeEnd.toLocaleDateString('en-PK')}`
    : rangeEnd             ? `Up to ${rangeEnd.toLocaleDateString('en-PK')}`
    : rangeStart            ? `From ${rangeStart.toLocaleDateString('en-PK')} to today`
    : 'Full History (live balance)';

  const columnCount = sheet.columns.length;
  const generatedRow = sheet.insertRow(1, [`Generated ${new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}`]);
  sheet.mergeCells(1, 1, 1, columnCount);
  generatedRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF888888' } };
  generatedRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  generatedRow.height = 16;

  const periodRow = sheet.insertRow(2, [`Report Period: ${periodText}`]);
  sheet.mergeCells(2, 1, 2, columnCount);
  periodRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1B2A4A' } };
  periodRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  periodRow.height = 18;

  const headerRow = sheet.getRow(3);
  headerRow.eachCell((cell) => {
    cell.fill = navyFill; cell.font = navyFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
  });
  headerRow.height = 22;

  const moneyCols = [
    'openingBalance', ...(hasRangeOpening ? ['rangeOpeningBalance'] : []),
    'approvedAmount', 'pendingAmount', 'rejectedAmount', 'voidedAmount', 'totalAmount',
  ];
  const totals = {
    openingBalance: 0, rangeOpeningBalance: 0,
    approvedAmount: 0, pendingAmount: 0, rejectedAmount: 0, voidedAmount: 0, totalAmount: 0, invoiceCount: 0, billCount: 0,
  };

  rows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    const rowBg = idx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';
    row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.alignment = { vertical: 'middle' }; });
    moneyCols.forEach((key) => {
      const cell = row.getCell(key);
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    row.getCell('totalAmount').font = boldFont;
    row.getCell('invoiceCount').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('billCount').alignment    = { horizontal: 'center', vertical: 'middle' };

    totals.openingBalance += r.openingBalance;
    totals.rangeOpeningBalance += r.rangeOpeningBalance ?? 0;
    totals.approvedAmount += r.approvedAmount;
    totals.pendingAmount  += r.pendingAmount;
    totals.rejectedAmount += r.rejectedAmount;
    totals.voidedAmount   += r.voidedAmount;
    totals.totalAmount    += r.totalAmount;
    totals.invoiceCount   += r.invoiceCount;
    totals.billCount      += r.billCount;
  });

  const totalRow = sheet.addRow({ name: 'TOTAL', ...totals });
  totalRow.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } }; cell.font = boldFont; cell.alignment = { vertical: 'middle' }; });
  moneyCols.forEach((key) => {
    const cell = totalRow.getCell(key);
    cell.numFmt = '#,##0';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  totalRow.getCell('invoiceCount').alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell('billCount').alignment    = { horizontal: 'center', vertical: 'middle' };

  sheet.views = [{ state: 'frozen', ySplit: 3 }];

  return workbook.xlsx.writeBuffer();
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Reconstructs a vendor's outstanding balance as of a past date from the
  // VendorTransaction ledger (every balance-affecting event snapshots
  // outstandingAfter), falling back to openingBalance if nothing happened yet.
  private async getVendorOutstandingAsOf(vendorId: string, asOf: Date): Promise<number> {
    const txn = await this.prisma.vendorTransaction.findFirst({
      where: { vendorId, createdAt: { lte: asOf } },
      orderBy: { createdAt: 'desc' },
      select: { outstandingAfter: true },
    });
    if (txn) return Number(txn.outstandingAfter);
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { openingBalance: true } });
    return Number(vendor?.openingBalance ?? 0);
  }

  async getVendors() {
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSupervisors() {
    return this.prisma.user.findMany({
      where: { role: 'site_supervisor' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async generateCombinedReport(filters: {
    siteId?: string;
    vendorId?: string;
    supervisorId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<ExcelJS.Buffer> {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const to   = filters.dateTo
      ? new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999))
      : undefined;

    const dateFilter = (from || to) ? {
      submittedAt: {
        ...(from && { gte: from }),
        ...(to   && { lte: to }),
      },
    } : {};

    const [bills, invoices] = await Promise.all([
      this.prisma.bill.findMany({
        where: {
          ...(filters.siteId       && { siteId:       filters.siteId }),
          ...(filters.vendorId     && { vendorId:     filters.vendorId }),
          ...(filters.supervisorId && { submittedById: filters.supervisorId }),
          ...(filters.status       && { status:       filters.status as any }),
          ...dateFilter,
        },
        include: {
          site:        true,
          submittedBy: { select: { name: true } },
          lineItems:   { include: { task: { select: { name: true } } } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: {
          ...(filters.siteId   && { siteId:   filters.siteId }),
          ...(filters.vendorId && { vendorId: filters.vendorId }),
          ...(filters.status   && { status:   filters.status as any }),
          ...dateFilter,
        },
        include: { task: true, site: true },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const allVendorIds = [
      ...new Set([
        ...bills.map((b) => b.vendorId),
        ...invoices.map((i) => i.vendorId),
      ].filter(Boolean)),
    ] as string[];
    const vendors   = await this.prisma.vendor.findMany({ where: { id: { in: allVendorIds } }, select: { id: true, name: true } });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = 'SiteLedger';
    workbook.created = new Date();

    const navyFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
    const navyFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const boldFont: Partial<ExcelJS.Font> = { bold: true };
    const statusColours: Record<string, string> = {
      pending: 'FFFFF3CD', approved: 'FFD1ECF1', rejected: 'FFFDE8E8', voided: 'FFE2E3E5',
    };

    // ── Sheet 1: Bills ────────────────────────────────────────────────────────
    const bill_sheet = workbook.addWorksheet('Bills', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    bill_sheet.columns = [
      { header: 'Bill #',           key: 'billNum',          width: 14 },
      { header: 'Site',             key: 'site',             width: 22 },
      { header: 'Vendor',           key: 'vendor',           width: 22 },
      { header: 'Supervisor',       key: 'supervisor',       width: 22 },
      { header: 'Task Name',        key: 'taskName',         width: 28 },
      { header: 'Unit',             key: 'unit',             width: 10 },
      { header: 'Qty',              key: 'qty',              width: 10 },
      { header: 'Rate (PKR)',       key: 'rate',             width: 14 },
      { header: 'Amount (PKR)',     key: 'amount',           width: 16 },
      { header: 'Status',           key: 'status',           width: 12 },
      { header: 'Submitted',        key: 'submittedAt',      width: 14 },
      { header: 'Approved',         key: 'approvedAt',       width: 14 },
    ];
    bill_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    bill_sheet.getRow(1).height = 22;

    let billRowIdx = 0;
    let billGrandTotal = 0;
    for (const bill of bills) {
      const billNum    = `BILL-${String(bill.billNumber).padStart(5, '0')}`;
      const siteName   = bill.site?.name ?? '—';
      const vendorName = bill.vendorId ? (vendorMap[bill.vendorId] ?? '—') : '—';
      const supName    = bill.submittedBy?.name ?? '—';
      const billTotal  = Number(bill.totalAmount);
      for (const li of bill.lineItems) {
        const rowBg = billRowIdx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';
        const row = bill_sheet.addRow({
          billNum, site: siteName, vendor: vendorName, supervisor: supName,
          taskName:         li.task?.name ?? li.customTaskName ?? '—',
          unit:             li.unit,
          qty:              Number(li.quantity),
          rate:             li.unitCostSnapshot ? Number(li.unitCostSnapshot) : '',
          amount:           Number(li.amount),
          status:           bill.status,
          submittedAt:      bill.submittedAt ? new Date(bill.submittedAt).toLocaleDateString('en-PK') : '',
          approvedAt:       bill.approvedAt  ? new Date(bill.approvedAt).toLocaleDateString('en-PK')  : '',
        });
        row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.alignment = { vertical: 'middle' }; });
        const sc = row.getCell('status');
        sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColours[bill.status] ?? rowBg } };
        sc.font = boldFont; sc.alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('qty').alignment       = { horizontal: 'right', vertical: 'middle' };
        row.getCell('rate').alignment      = { horizontal: 'right', vertical: 'middle' };
        row.getCell('amount').alignment    = { horizontal: 'right', vertical: 'middle' };
        row.getCell('amount').font         = boldFont;
        billRowIdx++;
      }
      billGrandTotal += billTotal;
    }
    if (bills.length === 0) {
      bill_sheet.addRow({ billNum: '—', site: 'No bills found for selected filters.' });
    } else {
      const tr = bill_sheet.addRow({ site: 'TOTAL', amount: billGrandTotal });
      tr.getCell('site').font = boldFont; tr.getCell('amount').font = boldFont;
      tr.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
      tr.getCell('site').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
    }
    bill_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Sheet 2: Invoices ─────────────────────────────────────────────────────
    const inv_sheet = workbook.addWorksheet('Invoices', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    inv_sheet.columns = [
      { header: 'Invoice #',        key: 'num',              width: 14 },
      { header: 'Site',             key: 'site',             width: 22 },
      { header: 'Vendor',           key: 'vendor',           width: 22 },
      { header: 'Task',             key: 'task',             width: 26 },
      { header: 'Unit',             key: 'unit',             width: 10 },
      { header: 'Quantity',         key: 'quantity',         width: 12 },
      { header: 'Unit Cost (PKR)',  key: 'unitCost',         width: 16 },
      { header: 'Amount (PKR)',     key: 'amount',           width: 16 },
      { header: 'Status',           key: 'status',           width: 12 },
      { header: 'Submitted',        key: 'submittedAt',      width: 14 },
      { header: 'Approved',         key: 'approvedAt',       width: 14 },
    ];
    inv_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    inv_sheet.getRow(1).height = 22;

    invoices.forEach((inv, idx) => {
      const rowBg = idx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';
      const row = inv_sheet.addRow({
        num:              `INV-${String(inv.invoiceNumber).padStart(5, '0')}`,
        site:             inv.site?.name ?? '—',
        vendor:           inv.vendorId ? (vendorMap[inv.vendorId] ?? '—') : '—',
        task:             inv.task?.name ?? inv.customTaskName ?? '—',
        unit:             inv.unit,
        quantity:         Number(inv.quantity),
        unitCost:         inv.unitCostSnapshot ? Number(inv.unitCostSnapshot) : '',
        amount:           Number(inv.amount),
        status:           inv.status,
        submittedAt:      inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:       inv.approvedAt  ? new Date(inv.approvedAt).toLocaleDateString('en-PK')  : '',
      });
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.alignment = { vertical: 'middle' }; });
      const sc = row.getCell('status');
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColours[inv.status] ?? rowBg } };
      sc.font = boldFont; sc.alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('quantity').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('unitCost').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').alignment   = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').font        = boldFont;
    });
    if (invoices.length === 0) {
      inv_sheet.addRow({ num: '—', site: 'No invoices found for selected filters.' });
    } else {
      const tr = inv_sheet.addRow({ site: 'TOTAL', amount: invoices.reduce((s, i) => s + Number(i.amount), 0) });
      tr.getCell('site').font = boldFont; tr.getCell('amount').font = boldFont;
      tr.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
      tr.getCell('site').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
    }
    inv_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    return workbook.xlsx.writeBuffer();
  }

  async generateBillReport(filters: {
    siteId?: string;
    vendorId?: string;
    supervisorId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<ExcelJS.Buffer> {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const to   = filters.dateTo
      ? new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999))
      : undefined;

    const bills = await this.prisma.bill.findMany({
      where: {
        ...(filters.siteId       && { siteId:       filters.siteId }),
        ...(filters.vendorId     && { vendorId:     filters.vendorId }),
        ...(filters.supervisorId && { submittedById: filters.supervisorId }),
        ...(filters.status       && { status:       filters.status as any }),
        ...((from || to) && {
          submittedAt: {
            ...(from && { gte: from }),
            ...(to   && { lte: to }),
          },
        }),
      },
      include: {
        site:        true,
        submittedBy: { select: { name: true } },
        lineItems:   { include: { task: { select: { name: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    if (bills.length === 0) {
      throw new NotFoundException('No bills found for the selected filters.');
    }

    const vendorIds = [...new Set(bills.map((b) => b.vendorId).filter(Boolean))] as string[];
    const vendors   = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = 'SiteLedger';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Bills', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    const navyFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
    const navyFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const statusColours: Record<string, string> = {
      pending: 'FFFFF3CD', approved: 'FFD1ECF1', rejected: 'FFFDE8E8', voided: 'FFE2E3E5',
    };

    sheet.columns = [
      { header: 'Bill #',          key: 'billNum',          width: 14 },
      { header: 'Site',            key: 'site',             width: 22 },
      { header: 'Vendor',          key: 'vendor',           width: 22 },
      { header: 'Supervisor',      key: 'supervisor',       width: 22 },
      { header: 'Task Name',       key: 'taskName',         width: 28 },
      { header: 'Unit',            key: 'unit',             width: 10 },
      { header: 'Qty',             key: 'qty',              width: 10 },
      { header: 'Rate (PKR)',      key: 'rate',             width: 14 },
      { header: 'Amount (PKR)',    key: 'amount',           width: 16 },
      { header: 'Status',          key: 'status',           width: 12 },
      { header: 'Submitted',       key: 'submittedAt',      width: 14 },
      { header: 'Approved',        key: 'approvedAt',       width: 14 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill;
      cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    sheet.getRow(1).height = 22;

    let rowIdx = 0;
    let grandTotal = 0;

    for (const bill of bills) {
      const billNum    = `BILL-${String(bill.billNumber).padStart(5, '0')}`;
      const siteName   = bill.site?.name ?? '—';
      const vendorName = bill.vendorId ? (vendorMap[bill.vendorId] ?? '—') : '—';
      const supName    = bill.submittedBy?.name ?? '—';
      const billTotal  = Number(bill.totalAmount);

      for (const li of bill.lineItems) {
        const taskName = li.task?.name ?? li.customTaskName ?? '—';
        const rowBg    = rowIdx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';

        const row = sheet.addRow({
          billNum,
          site:             siteName,
          vendor:           vendorName,
          supervisor:       supName,
          taskName,
          unit:             li.unit,
          qty:              Number(li.quantity),
          rate:             li.unitCostSnapshot ? Number(li.unitCostSnapshot) : '',
          amount:           Number(li.amount),
          status:           bill.status,
          submittedAt:      bill.submittedAt ? new Date(bill.submittedAt).toLocaleDateString('en-PK') : '',
          approvedAt:       bill.approvedAt  ? new Date(bill.approvedAt).toLocaleDateString('en-PK')  : '',
        });

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.alignment = { vertical: 'middle' };
        });

        const sc = row.getCell('status');
        sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColours[bill.status] ?? rowBg } };
        sc.font = { bold: true };
        sc.alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell('qty').alignment       = { horizontal: 'right', vertical: 'middle' };
        row.getCell('rate').alignment      = { horizontal: 'right', vertical: 'middle' };
        row.getCell('amount').alignment    = { horizontal: 'right', vertical: 'middle' };
        row.getCell('amount').font         = { bold: true };

        rowIdx++;
      }

      grandTotal += billTotal;
    }

    const totalRow = sheet.addRow({ site: 'TOTAL', amount: grandTotal });
    totalRow.getCell('site').font      = { bold: true };
    totalRow.getCell('amount').font = { bold: true };
    totalRow.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('site').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    return workbook.xlsx.writeBuffer();
  }

  async generateBalanceReport(filter: {
    siteId?: string;
    vendorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ExcelJS.Buffer> {
    const rangeStart = filter.dateFrom ? new Date(new Date(filter.dateFrom).setHours(0, 0, 0, 0))     : undefined;
    const rangeEnd   = filter.dateTo   ? new Date(new Date(filter.dateTo).setHours(23, 59, 59, 999))  : undefined;
    // "Just before the range starts" -- the instant used to reconstruct the vendor's
    // balance at the start of the window, so the start day's own activity is excluded.
    const justBeforeRangeStart = rangeStart ? new Date(rangeStart.getTime() - 1) : undefined;

    const where = {
      ...(filter.siteId   && { siteId:   filter.siteId }),
      ...(filter.vendorId && { vendorId: filter.vendorId }),
      ...((rangeStart || rangeEnd) && {
        submittedAt: {
          ...(rangeStart && { gte: rangeStart }),
          ...(rangeEnd   && { lte: rangeEnd }),
        },
      }),
    };

    const [invoices, bills] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: { task: true, site: true }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.bill.findMany({
        where,
        include: { site: true, lineItems: { include: { task: { select: { name: true } } } } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    // Resolve entity name and opening balance.
    // Site.currentBalance is a static, manually-set baseline (never auto-updated by
    // approvals) -- it already behaves like a real opening balance, so it's used as-is.
    // Vendor.currentBalance IS auto-updated by approvals, so it is NOT the opening
    // balance -- Vendor has a real, separate openingBalance field set once at creation.
    let entityName = 'Unknown';
    let openingBalance = 0;
    let outstandingBalance: number | null = null; // vendor only -- closing balance (as of rangeEnd, or live)
    let rangeOpeningBalance: number | null = null; // vendor only -- balance just before rangeStart, when a range is set
    let vendorBankDetails: { bankName: string | null; accountNumber: string | null; iban: string | null } | null = null;
    if (filter.siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: filter.siteId }, select: { name: true, currentBalance: true } });
      entityName = site?.name ?? filter.siteId;
      openingBalance = Number(site?.currentBalance ?? 0);
    } else if (filter.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: filter.vendorId },
        select: { name: true, openingBalance: true, currentBalance: true, bankName: true, accountNumber: true, iban: true },
      });
      entityName = vendor?.name ?? filter.vendorId;
      openingBalance = Number(vendor?.openingBalance ?? 0);
      outstandingBalance = rangeEnd
        ? await this.getVendorOutstandingAsOf(filter.vendorId, rangeEnd)
        : Number(vendor?.currentBalance ?? 0);
      rangeOpeningBalance = justBeforeRangeStart
        ? await this.getVendorOutstandingAsOf(filter.vendorId, justBeforeRangeStart)
        : null;
      vendorBankDetails = vendor ? { bankName: vendor.bankName, accountNumber: vendor.accountNumber, iban: vendor.iban } : null;
    }

    // Vendor name map
    const allVendorIds = [
      ...new Set([
        ...invoices.map((i) => i.vendorId),
        ...bills.map((b) => b.vendorId),
      ].filter(Boolean)),
    ] as string[];
    const vendors   = await this.prisma.vendor.findMany({ where: { id: { in: allVendorIds } }, select: { id: true, name: true } });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

    // Compute summaries. Voided rows are tracked separately and excluded from `total` --
    // a voided invoice/bill never affected any balance, so it shouldn't inflate the total.
    function tally(rows: { status: string; amount?: any; totalAmount?: any }[]) {
      const s = { total: 0, paid: 0, approved: 0, pending: 0, rejected: 0, voided: 0,
                  totalCount: 0, paidCount: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0, voidedCount: 0 };
      for (const r of rows) {
        const amt = Number(r.amount ?? r.totalAmount);
        if (r.status === 'voided') { s.voided += amt; s.voidedCount++; continue; }
        s.total += amt;
        s.totalCount++;
        if (r.status === 'paid')     { s.paid     += amt; s.paidCount++;     }
        if (r.status === 'approved') { s.approved += amt; s.approvedCount++; }
        if (r.status === 'pending')  { s.pending  += amt; s.pendingCount++;  }
        if (r.status === 'rejected') { s.rejected += amt; s.rejectedCount++; }
      }
      return s;
    }

    const inv  = tally(invoices);
    const bill = tally(bills);
    const combined = {
      total: inv.total + bill.total, paid: inv.paid + bill.paid,
      approved: inv.approved + bill.approved, pending: inv.pending + bill.pending,
      rejected: inv.rejected + bill.rejected, voided: inv.voided + bill.voided,
      totalCount: inv.totalCount + bill.totalCount,
    };

    // Vendor.currentBalance already reflects every approved invoice/bill -- it IS the
    // outstanding balance, nothing to add on top. Site.currentBalance never auto-updates,
    // so adding invoice/bill totals on top of it is correct math for sites.
    const headlineLabel = filter.vendorId ? 'Outstanding Balance' : 'Grand Total';
    const headlineAmount = filter.vendorId ? outstandingBalance! : (inv.total + bill.total + openingBalance);
    const netMovement = rangeOpeningBalance !== null ? outstandingBalance! - rangeOpeningBalance : null;

    const rangeLabel =
      rangeStart && rangeEnd ? ` (${rangeStart.toLocaleDateString('en-PK')} – ${rangeEnd.toLocaleDateString('en-PK')})`
      : rangeEnd             ? ` (as of ${rangeEnd.toLocaleDateString('en-PK')})`
      : rangeStart            ? ` (from ${rangeStart.toLocaleDateString('en-PK')})`
      : '';

    const periodText =
      rangeStart && rangeEnd ? `${rangeStart.toLocaleDateString('en-PK')} – ${rangeEnd.toLocaleDateString('en-PK')}`
      : rangeEnd             ? `Up to ${rangeEnd.toLocaleDateString('en-PK')}`
      : rangeStart            ? `From ${rangeStart.toLocaleDateString('en-PK')} to today`
      : 'Full History (live balance)';

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = 'SiteLedger';
    workbook.created = new Date();

    const navyFill:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
    const navyFont:  Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const boldFont:  Partial<ExcelJS.Font> = { bold: true };
    const statusColours: Record<string, string> = {
      pending: 'FFFFF3CD', approved: 'FFD1ECF1', rejected: 'FFFDE8E8', voided: 'FFE2E3E5',
    };

    function addSummaryBlock(sheet: ExcelJS.Worksheet, title: string, s: typeof inv, colOffset = 0) {
      const col = (n: number) => n + colOffset;
      const addRow = (label: string, amount: number, count: number, bg: string) => {
        const r = sheet.addRow([]);
        r.getCell(col(1)).value = label;
        r.getCell(col(2)).value = amount;
        r.getCell(col(3)).value = count;
        [col(1), col(2), col(3)].forEach((c) => {
          r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          r.getCell(c).alignment = { vertical: 'middle' };
        });
        r.getCell(col(1)).font = boldFont;
        r.getCell(col(2)).numFmt = '#,##0';
        r.getCell(col(2)).alignment = { horizontal: 'right', vertical: 'middle' };
        r.getCell(col(3)).alignment = { horizontal: 'center', vertical: 'middle' };
        r.height = 19;
      };
      // section title
      const hdrRow = sheet.addRow([]);
      hdrRow.getCell(col(1)).value = title;
      [col(1), col(2), col(3)].forEach((c) => {
        hdrRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
        hdrRow.getCell(c).font = boldFont;
        hdrRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      });
      hdrRow.height = 20;
      addRow('Total', s.total, s.totalCount, 'FFFFFFFF');
      addRow('Paid',     s.paid,     s.paidCount,     'FFD4EDDA');
      addRow('Approved', s.approved, s.approvedCount, 'FFD1ECF1');
      addRow('Pending',  s.pending,  s.pendingCount,  'FFFFF3CD');
      addRow('Rejected', s.rejected, s.rejectedCount, 'FFFDE8E8');
      addRow('Voided',   s.voided,   s.voidedCount,   'FFE2E3E5');
    }

    // ── Sheet 1: Balance Summary ──────────────────────────────────────────────
    const sum_sheet = workbook.addWorksheet('Balance Summary');
    sum_sheet.columns = [
      { key: 'a', width: 20 }, { key: 'b', width: 18 }, { key: 'c', width: 12 },
    ];

    const titleRow = sum_sheet.addRow([`Balance Report — ${entityName}${rangeLabel}`, '', '']);
    titleRow.getCell(1).fill = navyFill;
    titleRow.getCell(1).font = { ...navyFont, size: 13 };
    titleRow.getCell(2).fill = navyFill;
    titleRow.getCell(3).fill = navyFill;
    titleRow.height = 26;
    sum_sheet.mergeCells('A1:C1');
    titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const generatedRow = sum_sheet.addRow([`Generated ${new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}`, '', '']);
    sum_sheet.mergeCells(generatedRow.number, 1, generatedRow.number, 3);
    generatedRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF888888' } };
    generatedRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    generatedRow.height = 16;

    const periodRow = sum_sheet.addRow([`Report Period: ${periodText}`, '', '']);
    sum_sheet.mergeCells(periodRow.number, 1, periodRow.number, 3);
    periodRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1B2A4A' } };
    periodRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    periodRow.height = 18;

    sum_sheet.addRow([]);

    // Vendor bank details
    if (vendorBankDetails && (vendorBankDetails.bankName || vendorBankDetails.accountNumber || vendorBankDetails.iban)) {
      const addBankRow = (label: string, value: string | null) => {
        if (!value) return;
        const r = sum_sheet.addRow([label, value, '']);
        r.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; c.alignment = { vertical: 'middle' }; });
        r.getCell(1).font = boldFont;
        r.height = 18;
      };
      addBankRow('Bank Name',      vendorBankDetails.bankName);
      addBankRow('Account Number', vendorBankDetails.accountNumber);
      addBankRow('IBAN',           vendorBankDetails.iban);
      sum_sheet.addRow([]);
    }

    // Opening balance (lifetime, fixed at vendor creation -- or site's manual baseline)
    const openingRow = sum_sheet.addRow([`Opening Balance`, openingBalance, '']);
    openingRow.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } }; c.alignment = { vertical: 'middle' }; });
    openingRow.getCell(1).font = boldFont;
    openingRow.getCell(2).numFmt = '#,##0';
    openingRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    openingRow.height = 19;

    // Balance at start of range -- only shown when a "from" date narrows the window,
    // reconstructed from the VendorTransaction ledger just before that date.
    if (rangeOpeningBalance !== null && rangeStart) {
      const rangeOpenRow = sum_sheet.addRow([`Balance at Start (${rangeStart.toLocaleDateString('en-PK')})`, rangeOpeningBalance, '']);
      rangeOpenRow.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; c.alignment = { vertical: 'middle' }; });
      rangeOpenRow.getCell(1).font = boldFont;
      rangeOpenRow.getCell(2).numFmt = '#,##0';
      rangeOpenRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      rangeOpenRow.height = 19;
    }

    // Invoices + bills movement total
    const movementRow = sum_sheet.addRow([`Invoices + Bills`, combined.total, combined.totalCount]);
    movementRow.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle' }; });
    movementRow.getCell(1).font = boldFont;
    movementRow.getCell(2).numFmt = '#,##0';
    movementRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    movementRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    movementRow.height = 19;

    // Headline total -- Outstanding Balance for vendors (currentBalance, already correct,
    // nothing added on top), Grand Total for sites (opening balance + invoices + bills).
    const grandRow = sum_sheet.addRow([headlineLabel, headlineAmount, combined.totalCount]);
    grandRow.eachCell({ includeEmpty: true }, (c) => { c.fill = navyFill; c.font = navyFont; c.alignment = { vertical: 'middle' }; });
    grandRow.getCell(2).numFmt = '#,##0';
    grandRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    grandRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    grandRow.height = 22;

    if (netMovement !== null) {
      const netRow = sum_sheet.addRow([`Net Movement`, netMovement, '']);
      netRow.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netMovement >= 0 ? 'FFFDE8E8' : 'FFD4EDDA' } };
        c.alignment = { vertical: 'middle' };
      });
      netRow.getCell(1).font = boldFont;
      netRow.getCell(2).numFmt = '#,##0;[Red]-#,##0';
      netRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      netRow.height = 19;
    }
    sum_sheet.addRow([]);

    addSummaryBlock(sum_sheet, 'Invoices', inv);
    sum_sheet.addRow([]);
    addSummaryBlock(sum_sheet, 'Bills', bill);
    sum_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Sheet 2: Invoices ─────────────────────────────────────────────────────
    const inv_sheet = workbook.addWorksheet('Invoices', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    inv_sheet.columns = [
      { header: 'Invoice #',       key: 'num',              width: 14 },
      { header: 'Site',            key: 'site',             width: 22 },
      { header: 'Vendor',          key: 'vendor',           width: 22 },
      { header: 'Task',            key: 'task',             width: 26 },
      { header: 'Unit',            key: 'unit',             width: 10 },
      { header: 'Quantity',        key: 'quantity',         width: 12 },
      { header: 'Unit Cost (PKR)', key: 'unitCost',         width: 16 },
      { header: 'Amount (PKR)',    key: 'amount',           width: 16 },
      { header: 'Status',          key: 'status',           width: 12 },
      { header: 'Submitted',       key: 'submittedAt',      width: 14 },
      { header: 'Approved',        key: 'approvedAt',       width: 14 },
    ];
    inv_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    inv_sheet.getRow(1).height = 22;

    invoices.forEach((inv, idx) => {
      const row = inv_sheet.addRow({
        num:              `INV-${String(inv.invoiceNumber).padStart(5, '0')}`,
        site:             inv.site?.name ?? '—',
        vendor:           inv.vendorId ? (vendorMap[inv.vendorId] ?? '—') : '—',
        task:             inv.task?.name ?? inv.customTaskName ?? '—',
        unit:             inv.unit,
        quantity:         Number(inv.quantity),
        unitCost:         inv.unitCostSnapshot ? Number(inv.unitCostSnapshot) : '',
        amount:           Number(inv.amount),
        status:           inv.status,
        submittedAt:      inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:       inv.approvedAt  ? new Date(inv.approvedAt).toLocaleDateString('en-PK')  : '',
      });
      const rowBg = idx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.alignment = { vertical: 'middle' }; });
      const sc = row.getCell('status');
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColours[inv.status] ?? rowBg } };
      sc.font = boldFont; sc.alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('quantity').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('unitCost').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').alignment   = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').font        = boldFont;
    });
    const invTotal = inv_sheet.addRow({ site: 'TOTAL', amount: inv.total });
    invTotal.getCell('site').font = boldFont; invTotal.getCell('amount').font = boldFont;
    invTotal.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
    invTotal.getCell('site').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
    inv_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Sheet 3: Bills ────────────────────────────────────────────────────────
    const bill_sheet = workbook.addWorksheet('Bills', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    bill_sheet.columns = [
      { header: 'Bill #',       key: 'num',              width: 14 },
      { header: 'Site',         key: 'site',             width: 22 },
      { header: 'Vendor',       key: 'vendor',           width: 22 },
      { header: 'Line Items',   key: 'lineItems',        width: 12 },
      { header: 'Total (PKR)',  key: 'total',            width: 16 },
      { header: 'Status',       key: 'status',           width: 12 },
      { header: 'Submitted',    key: 'submittedAt',      width: 14 },
      { header: 'Approved',     key: 'approvedAt',       width: 14 },
    ];
    bill_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    bill_sheet.getRow(1).height = 22;

    bills.forEach((b, idx) => {
      const row = bill_sheet.addRow({
        num:              `BILL-${String(b.billNumber).padStart(5, '0')}`,
        site:             b.site?.name ?? '—',
        vendor:           b.vendorId ? (vendorMap[b.vendorId] ?? '—') : '—',
        lineItems:        b.lineItems.length,
        total:            Number(b.totalAmount),
        status:           b.status,
        submittedAt:      b.submittedAt ? new Date(b.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:       b.approvedAt  ? new Date(b.approvedAt).toLocaleDateString('en-PK')  : '',
      });
      const rowBg = idx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.alignment = { vertical: 'middle' }; });
      const sc = row.getCell('status');
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColours[b.status] ?? rowBg } };
      sc.font = boldFont; sc.alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('lineItems').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('total').alignment     = { horizontal: 'right',  vertical: 'middle' };
      row.getCell('total').font          = boldFont;
    });
    const billTotal = bill_sheet.addRow({ site: 'TOTAL', total: bill.total });
    billTotal.getCell('site').font = boldFont; billTotal.getCell('total').font = boldFont;
    billTotal.getCell('total').alignment = { horizontal: 'right', vertical: 'middle' };
    billTotal.getCell('site').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
    bill_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    return workbook.xlsx.writeBuffer();
  }

  async generateAllSitesBalanceReport(): Promise<ExcelJS.Buffer> {
    const sites = await this.prisma.site.findMany({
      where: { isActive: true, isArchived: false },
      select: { id: true, siteCode: true, name: true, location: true, currentBalance: true },
      orderBy: { name: 'asc' },
    });

    if (sites.length === 0) {
      throw new NotFoundException('No active sites found.');
    }

    const siteIds = sites.map((s) => s.id);
    const [invoices, bills] = await Promise.all([
      this.prisma.invoice.findMany({ where: { siteId: { in: siteIds } }, select: { siteId: true, status: true, amount: true } }),
      this.prisma.bill.findMany({    where: { siteId: { in: siteIds } }, select: { siteId: true, status: true, totalAmount: true } }),
    ]);

    const rows = sites.map((site) => {
      const inv  = tallyByStatus(invoices.filter((i) => i.siteId === site.id));
      const bill = tallyByStatus(bills.filter((b) => b.siteId === site.id));
      // Site.currentBalance never auto-updates, so it already behaves like an opening
      // balance -- adding invoice/bill totals on top of it is correct math for sites.
      const openingBalance = Number(site.currentBalance);
      return {
        label:          `S-${String(site.siteCode).padStart(3, '0')}`,
        name:           site.name,
        extra:          site.location,
        openingBalance,
        totalAmount:    inv.totalAmount + bill.totalAmount + openingBalance,
        approvedAmount: inv.approvedAmount + bill.approvedAmount,
        pendingAmount:  inv.pendingAmount  + bill.pendingAmount,
        rejectedAmount: inv.rejectedAmount + bill.rejectedAmount,
        voidedAmount:   inv.voidedAmount   + bill.voidedAmount,
        invoiceCount:   inv.totalCount,
        billCount:      bill.totalCount,
      };
    });

    return buildAllBalancesWorkbook('Sites', 'Site Code', 'Location', rows);
  }

  async generateAllVendorsBalanceReport(dateFrom?: string, dateTo?: string): Promise<ExcelJS.Buffer> {
    const rangeStart = dateFrom ? new Date(new Date(dateFrom).setHours(0, 0, 0, 0))    : undefined;
    const rangeEnd   = dateTo   ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : undefined;
    const justBeforeRangeStart = rangeStart ? new Date(rangeStart.getTime() - 1) : undefined;

    const vendors = await this.prisma.vendor.findMany({
      where: { isActive: true, isArchived: false },
      select: {
        id: true, name: true, contactPerson: true, phone: true, openingBalance: true, currentBalance: true,
        bankName: true, accountNumber: true, iban: true,
      },
      orderBy: { name: 'asc' },
    });

    if (vendors.length === 0) {
      throw new NotFoundException('No active vendors found.');
    }

    const vendorIds = vendors.map((v) => v.id);
    const dateWhere = (rangeStart || rangeEnd) ? {
      submittedAt: { ...(rangeStart && { gte: rangeStart }), ...(rangeEnd && { lte: rangeEnd }) },
    } : {};
    const [invoices, bills, closingByVendor, rangeOpeningByVendor] = await Promise.all([
      this.prisma.invoice.findMany({ where: { vendorId: { in: vendorIds }, ...dateWhere }, select: { vendorId: true, status: true, amount: true } }),
      this.prisma.bill.findMany({    where: { vendorId: { in: vendorIds }, ...dateWhere }, select: { vendorId: true, status: true, totalAmount: true } }),
      rangeEnd
        ? Promise.all(vendors.map((v) => this.getVendorOutstandingAsOf(v.id, rangeEnd)))
        : Promise.resolve(null),
      justBeforeRangeStart
        ? Promise.all(vendors.map((v) => this.getVendorOutstandingAsOf(v.id, justBeforeRangeStart)))
        : Promise.resolve(null),
    ]);

    const rows = vendors.map((vendor, idx) => {
      const inv  = tallyByStatus(invoices.filter((i) => i.vendorId === vendor.id));
      const bill = tallyByStatus(bills.filter((b) => b.vendorId === vendor.id));
      // Vendor.currentBalance already reflects every approved invoice/bill -- it IS the
      // outstanding balance, nothing to add on top. openingBalance is the real, separate,
      // fixed-at-creation field. When a range is given, the closing/start-of-range balances
      // are reconstructed from the VendorTransaction ledger instead of reading the live (now) balance.
      return {
        label:          vendor.contactPerson ?? '—',
        name:           vendor.name,
        extra:          vendor.phone ?? '—',
        bankName:       vendor.bankName ?? '—',
        accountNumber:  vendor.accountNumber ?? '—',
        iban:           vendor.iban ?? '—',
        openingBalance: Number(vendor.openingBalance),
        ...(rangeOpeningByVendor && { rangeOpeningBalance: rangeOpeningByVendor[idx] }),
        totalAmount:    closingByVendor ? closingByVendor[idx] : Number(vendor.currentBalance),
        approvedAmount: inv.approvedAmount + bill.approvedAmount,
        pendingAmount:  inv.pendingAmount  + bill.pendingAmount,
        rejectedAmount: inv.rejectedAmount + bill.rejectedAmount,
        voidedAmount:   inv.voidedAmount   + bill.voidedAmount,
        invoiceCount:   inv.totalCount,
        billCount:      bill.totalCount,
      };
    });

    return buildAllBalancesWorkbook('Vendors', 'Contact Person', 'Phone', rows, rangeStart, rangeEnd);
  }

  async generateInvoiceReport(filters: {
    siteId?: string;
    vendorId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<ExcelJS.Buffer> {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    // Set dateTo to end of day
    const to = filters.dateTo
      ? new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999))
      : undefined;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(filters.siteId   && { siteId:   filters.siteId }),
        ...(filters.vendorId && { vendorId: filters.vendorId }),
        ...(filters.status   && { status:   filters.status as any }),
        ...((from || to) && {
          submittedAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }),
      },
      include: { task: true, site: true },
      orderBy: { submittedAt: 'desc' },
    });

    if (invoices.length === 0) {
      throw new NotFoundException('No invoices found for the selected filters.');
    }

    // Fetch vendor names for all invoices in one query
    const vendorIds = [...new Set(invoices.map((i) => i.vendorId).filter(Boolean))] as string[];
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SiteLedger';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Invoices', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // ── Header styling ────────────────────────────────────────────
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B2A4A' }, // navy
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11,
    };

    sheet.columns = [
      { header: 'Invoice ID',      key: 'id',               width: 22 },
      { header: 'Site',            key: 'site',              width: 22 },
      { header: 'Vendor',          key: 'vendor',            width: 22 },
      { header: 'Task',            key: 'task',              width: 26 },
      { header: 'Unit',            key: 'unit',              width: 10 },
      { header: 'Quantity',        key: 'quantity',          width: 12 },
      { header: 'Unit Cost (PKR)', key: 'unitCost',          width: 16 },
      { header: 'Amount (PKR)',    key: 'amount',            width: 16 },
      { header: 'Status',          key: 'status',            width: 12 },
      { header: 'Submitted',       key: 'submittedAt',       width: 14 },
      { header: 'Approved',        key: 'approvedAt',        width: 14 },
      { header: 'Description',     key: 'description',       width: 30 },
    ];

    // Style header row
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE8A33D' } },
      };
    });
    sheet.getRow(1).height = 22;

    // ── Status colours ────────────────────────────────────────────
    const statusColours: Record<string, string> = {
      pending: 'FFFFF3CD', approved: 'FFD1ECF1', rejected: 'FFFDE8E8', voided: 'FFE2E3E5',
    };

    // ── Data rows ─────────────────────────────────────────────────
    invoices.forEach((inv, idx) => {
      const row = sheet.addRow({
        id:               inv.id,
        site:             inv.site?.name ?? '—',
        vendor:           inv.vendorId ? (vendorMap[inv.vendorId] ?? inv.vendorId) : '—',
        task:             inv.task?.name ?? inv.customTaskName ?? '—',
        unit:             inv.unit,
        quantity:         Number(inv.quantity),
        unitCost:         inv.unitCostSnapshot ? Number(inv.unitCostSnapshot) : '',
        amount:           Number(inv.amount),
        status:           inv.status,
        submittedAt:      inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:       inv.approvedAt  ? new Date(inv.approvedAt).toLocaleDateString('en-PK')  : '',
        description:      inv.description ?? '',
      });

      const rowBg = idx % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF';

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.alignment = { vertical: 'middle' };
      });

      // Colour the status cell
      const statusCell = row.getCell('status');
      const statusBg = statusColours[inv.status] ?? rowBg;
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      statusCell.font = { bold: true };
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell('quantity').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('unitCost').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').alignment   = { horizontal: 'right', vertical: 'middle' };
      row.getCell('amount').font        = { bold: true };
    });

    // ── Totals row ────────────────────────────────────────────────
    const totalRow = sheet.addRow({
      site:   'TOTAL',
      amount: invoices.reduce((sum, i) => sum + Number(i.amount), 0),
    });
    totalRow.getCell('site').font   = { bold: true };
    totalRow.getCell('amount').font = { bold: true };
    totalRow.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('site').fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' },
    };

    // Freeze the header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    return workbook.xlsx.writeBuffer();
  }
}
