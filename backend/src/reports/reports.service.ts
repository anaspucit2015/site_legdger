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
