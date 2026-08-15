import { Injectable, NotFoundException } from '@nestjs/common'; // NotFoundException used for empty report
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getVendors() {
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async generateBalanceReport(filter: {
    siteId?: string;
    vendorId?: string;
  }): Promise<ExcelJS.Buffer> {
    const where = {
      ...(filter.siteId   && { siteId:   filter.siteId }),
      ...(filter.vendorId && { vendorId: filter.vendorId }),
    };

    const [invoices, bills] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: { task: true, site: true }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.bill.findMany({
        where,
        include: { site: true, lineItems: { include: { task: { select: { name: true } } } } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    // Resolve entity name
    let entityName = 'Unknown';
    if (filter.siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: filter.siteId }, select: { name: true } });
      entityName = site?.name ?? filter.siteId;
    } else if (filter.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: filter.vendorId }, select: { name: true } });
      entityName = vendor?.name ?? filter.vendorId;
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

    // Compute summaries
    function tally(rows: { status: string; amount?: any; totalAmount?: any }[]) {
      const s = { total: 0, paid: 0, approved: 0, pending: 0, rejected: 0,
                  totalCount: rows.length, paidCount: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0 };
      for (const r of rows) {
        const amt = Number(r.amount ?? r.totalAmount);
        s.total += amt;
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
      rejected: inv.rejected + bill.rejected,
      totalCount: inv.totalCount + bill.totalCount,
    };

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = 'SiteLedger';
    workbook.created = new Date();

    const navyFill:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
    const navyFont:  Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const boldFont:  Partial<ExcelJS.Font> = { bold: true };
    const statusColours: Record<string, string> = {
      pending: 'FFFFF3CD', approved: 'FFD1ECF1', rejected: 'FFFDE8E8', paid: 'FFD4EDDA',
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
    }

    // ── Sheet 1: Balance Summary ──────────────────────────────────────────────
    const sum_sheet = workbook.addWorksheet('Balance Summary');
    sum_sheet.columns = [
      { key: 'a', width: 20 }, { key: 'b', width: 18 }, { key: 'c', width: 12 },
    ];

    const titleRow = sum_sheet.addRow([`Balance Report — ${entityName}`, '', '']);
    titleRow.getCell(1).fill = navyFill;
    titleRow.getCell(1).font = { ...navyFont, size: 13 };
    titleRow.getCell(2).fill = navyFill;
    titleRow.getCell(3).fill = navyFill;
    titleRow.height = 26;
    sum_sheet.mergeCells('A1:C1');
    titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    sum_sheet.addRow([]);

    // Combined grand total
    const grandRow = sum_sheet.addRow([`Grand Total`, combined.total, combined.totalCount]);
    grandRow.eachCell({ includeEmpty: true }, (c) => { c.fill = navyFill; c.font = navyFont; c.alignment = { vertical: 'middle' }; });
    grandRow.getCell(2).numFmt = '#,##0';
    grandRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    grandRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    grandRow.height = 22;
    sum_sheet.addRow([]);

    addSummaryBlock(sum_sheet, 'Invoices', inv);
    sum_sheet.addRow([]);
    addSummaryBlock(sum_sheet, 'Bills', bill);
    sum_sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Sheet 2: Invoices ─────────────────────────────────────────────────────
    const inv_sheet = workbook.addWorksheet('Invoices', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    inv_sheet.columns = [
      { header: 'Invoice #',       key: 'num',         width: 14 },
      { header: 'Site',            key: 'site',        width: 22 },
      { header: 'Vendor',          key: 'vendor',      width: 22 },
      { header: 'Task',            key: 'task',        width: 26 },
      { header: 'Unit',            key: 'unit',        width: 10 },
      { header: 'Quantity',        key: 'quantity',    width: 12 },
      { header: 'Unit Cost (PKR)', key: 'unitCost',    width: 16 },
      { header: 'Amount (PKR)',    key: 'amount',      width: 16 },
      { header: 'Status',          key: 'status',      width: 12 },
      { header: 'Submitted',       key: 'submittedAt', width: 14 },
      { header: 'Approved',        key: 'approvedAt',  width: 14 },
      { header: 'Paid',            key: 'paidAt',      width: 14 },
      { header: 'Payment Ref',     key: 'paymentRef',  width: 22 },
    ];
    inv_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    inv_sheet.getRow(1).height = 22;

    invoices.forEach((inv, idx) => {
      const row = inv_sheet.addRow({
        num:         `INV-${String(inv.invoiceNumber).padStart(5, '0')}`,
        site:        inv.site?.name ?? '—',
        vendor:      inv.vendorId ? (vendorMap[inv.vendorId] ?? '—') : '—',
        task:        inv.task?.name ?? inv.customTaskName ?? '—',
        unit:        inv.unit,
        quantity:    Number(inv.quantity),
        unitCost:    inv.unitCostSnapshot ? Number(inv.unitCostSnapshot) : '',
        amount:      Number(inv.amount),
        status:      inv.status,
        submittedAt: inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:  inv.approvedAt  ? new Date(inv.approvedAt).toLocaleDateString('en-PK')  : '',
        paidAt:      inv.paidAt      ? new Date(inv.paidAt).toLocaleDateString('en-PK')      : '',
        paymentRef:  inv.paymentRef  ?? '',
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
      { header: 'Bill #',       key: 'num',         width: 14 },
      { header: 'Site',         key: 'site',        width: 22 },
      { header: 'Vendor',       key: 'vendor',      width: 22 },
      { header: 'Line Items',   key: 'lineItems',   width: 12 },
      { header: 'Total (PKR)',  key: 'total',       width: 16 },
      { header: 'Status',       key: 'status',      width: 12 },
      { header: 'Submitted',    key: 'submittedAt', width: 14 },
      { header: 'Approved',     key: 'approvedAt',  width: 14 },
      { header: 'Paid',         key: 'paidAt',      width: 14 },
      { header: 'Payment Ref',  key: 'paymentRef',  width: 22 },
    ];
    bill_sheet.getRow(1).eachCell((cell) => {
      cell.fill = navyFill; cell.font = navyFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A33D' } } };
    });
    bill_sheet.getRow(1).height = 22;

    bills.forEach((b, idx) => {
      const row = bill_sheet.addRow({
        num:         `BILL-${String(b.billNumber).padStart(5, '0')}`,
        site:        b.site?.name ?? '—',
        vendor:      b.vendorId ? (vendorMap[b.vendorId] ?? '—') : '—',
        lineItems:   b.lineItems.length,
        total:       Number(b.totalAmount),
        status:      b.status,
        submittedAt: b.submittedAt ? new Date(b.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:  b.approvedAt  ? new Date(b.approvedAt).toLocaleDateString('en-PK')  : '',
        paidAt:      b.paidAt      ? new Date(b.paidAt).toLocaleDateString('en-PK')      : '',
        paymentRef:  b.paymentRef  ?? '',
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
      { header: 'Invoice ID',      key: 'id',          width: 22 },
      { header: 'Site',            key: 'site',         width: 22 },
      { header: 'Vendor',           key: 'vendor',       width: 22 },
      { header: 'Task',            key: 'task',         width: 26 },
      { header: 'Unit',            key: 'unit',         width: 10 },
      { header: 'Quantity',        key: 'quantity',     width: 12 },
      { header: 'Unit Cost (PKR)', key: 'unitCost',     width: 16 },
      { header: 'Amount (PKR)',    key: 'amount',       width: 16 },
      { header: 'Status',          key: 'status',       width: 12 },
      { header: 'Submitted',       key: 'submittedAt',  width: 14 },
      { header: 'Approved',        key: 'approvedAt',   width: 14 },
      { header: 'Paid',            key: 'paidAt',       width: 14 },
      { header: 'Payment Ref',     key: 'paymentRef',   width: 22 },
      { header: 'Description',     key: 'description',  width: 30 },
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
      pending:  'FFFFF3CD',
      approved: 'FFD1ECF1',
      rejected: 'FFFDE8E8',
      paid:     'FFD4EDDA',
    };

    // ── Data rows ─────────────────────────────────────────────────
    invoices.forEach((inv, idx) => {
      const row = sheet.addRow({
        id:          inv.id,
        site:        inv.site?.name ?? '—',
        vendor:      inv.vendorId ? (vendorMap[inv.vendorId] ?? inv.vendorId) : '—',
        task:        inv.task?.name ?? inv.customTaskName ?? '—',
        unit:        inv.unit,
        quantity:    Number(inv.quantity),
        unitCost:    inv.unitCostSnapshot ? Number(inv.unitCostSnapshot) : '',
        amount:      Number(inv.amount),
        status:      inv.status,
        submittedAt: inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString('en-PK') : '',
        approvedAt:  inv.approvedAt  ? new Date(inv.approvedAt).toLocaleDateString('en-PK')  : '',
        paidAt:      inv.paidAt      ? new Date(inv.paidAt).toLocaleDateString('en-PK')      : '',
        paymentRef:  inv.paymentRef  ?? '',
        description: inv.description ?? '',
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

      // Right-align numbers
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
