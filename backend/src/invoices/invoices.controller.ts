import {
  Body,
  Controller,
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

  // ─── Vendor: Submit invoice ────────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('vendor')
  @Post()
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoicesService.create(dto, req.user.id);
  }

  // ─── Read: role-based visibility ──────────────────────────────────────────
  @Get()
  findAll(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
  ) {
    const { role } = req.user;

    if (role === 'admin') {
      return this.invoicesService.findAll({ siteId, vendorId, status });
    }

    if (role === 'accountant') {
      return this.invoicesService.findForAccountant({ siteId, status });
    }

    // vendor: no siteId → own invoices; with siteId → all invoices for that site
    if (!siteId) return this.invoicesService.findAll({ vendorId: req.user.id, status });
    return this.invoicesService.findBySite(siteId);
  }

  // ─── Admin: pending delete requests queue ─────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('delete-requests')
  findPendingDeleteRequests() {
    return this.invoicesService.findPendingDeleteRequests();
  }

  // ─── Single invoice ────────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // ─── Vendor: edit pending invoice ──────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('vendor')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @Req() req: any) {
    return this.invoicesService.update(id, dto, req.user.id);
  }

  // ─── Vendor: request delete ───────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('vendor')
  @Post(':id/delete-request')
  requestDelete(@Param('id') id: string, @Req() req: any) {
    return this.invoicesService.requestDelete(id, req.user.id);
  }

  // ─── Admin: approve ────────────────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.invoicesService.approve(id, req.user.id);
  }

  // ─── Admin: reject ─────────────────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
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
