import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  RejectInvoiceDto,
  ReleasePaymentDto,
  UpdateInvoiceDto,
} from './invoices.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  // ─── Submit invoice (site_supervisor, admin, accountant) ─────────────────
  @UseGuards(RolesGuard)
  @Roles('site_supervisor', 'admin', 'accountant')
  @Post()
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoicesService.create(dto, req.user.id, req.user.role);
  }

  // ─── Read: role-based visibility ──────────────────────────────────────────
  @Get()
  findAll(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { role } = req.user;
    const p = Number(page) || 1;
    const l = Number(limit) || 20;

    // mine=true → own submissions only, works for all roles
    if (mine === 'true') {
      return this.invoicesService.findAll({ submittedById: req.user.id, siteId, status }, p, l);
    }

    if (role === 'admin' || role === 'accountant') {
      return this.invoicesService.findAll({ siteId, vendorId, status }, p, l);
    }

    // site_supervisor: no siteId → own invoices; with siteId → all invoices for that site (Site Invoices page)
    if (!siteId) return this.invoicesService.findAll({ submittedById: req.user.id, status }, p, l);
    return this.invoicesService.findAll({ siteId, status }, p, l);
  }

  // ─── Balance summary (admin, accountant) ─────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Get('balance')
  getBalance(
    @Query('siteId')   siteId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.invoicesService.getBalance({ siteId, vendorId });
  }

  // ─── Admin: pending delete requests queue ─────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('delete-requests')
  findPendingDeleteRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findPendingDeleteRequests(Number(page) || 1, Number(limit) || 20);
  }

  // ─── Single invoice ────────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // ─── Admin / Site Supervisor: edit pending invoice ───────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'site_supervisor')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @Req() req: any) {
    return this.invoicesService.update(id, dto, req.user.id, req.user.role);
  }

  // ─── Admin: direct delete (pending or approved) ───────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  adminDelete(@Param('id') id: string) {
    return this.invoicesService.adminDelete(id);
  }

  // ─── Site Supervisor / Accountant: request delete ────────────────────────
  @UseGuards(RolesGuard)
  @Roles('site_supervisor', 'accountant')
  @Post(':id/delete-request')
  requestDelete(@Param('id') id: string, @Req() req: any) {
    return this.invoicesService.requestDelete(id, req.user.id);
  }

  // ─── Admin / Accountant: approve ─────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.invoicesService.approve(id, req.user.id);
  }

  // ─── Admin / Accountant: reject ──────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectInvoiceDto, @Req() req: any) {
    return this.invoicesService.reject(id, dto, req.user.id);
  }

  // ─── Admin: resolve delete request ────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/delete-request/resolve')
  resolveDeleteRequest(
    @Param('id') id: string,
    @Query('approve') approve: string,
    @Req() req: any,
  ) {
    return this.invoicesService.resolveDeleteRequest(id, approve === 'true', req.user.id);
  }

  // ─── Accountant: release payment ──────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('accountant')
  @Post(':id/pay')
  releasePayment(@Param('id') id: string, @Body() dto: ReleasePaymentDto, @Req() req: any) {
    return this.invoicesService.releasePayment(id, dto, req.user.id);
  }
}
