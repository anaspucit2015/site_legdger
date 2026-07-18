import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'accountant')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('vendors')
  getVendors() {
    return this.reportsService.getVendors();
  }

  @Get('invoices')
  async downloadInvoiceReport(
    @Query('siteId') siteId: string | undefined,
    @Query('vendorId') vendorId: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateInvoiceReport({ siteId, vendorId, dateFrom, dateTo, status });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `invoices-report-${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
