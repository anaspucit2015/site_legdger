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
import { BillsService } from './bills.service';
import { CreateBillDto, UpdateBillDto, RejectBillDto, ReleasePaymentDto } from './bills.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private billsService: BillsService) {}

  // ─── Submit bill (site_supervisor, admin, accountant) ────────────────────
  @UseGuards(RolesGuard)
  @Roles('site_supervisor', 'admin', 'accountant')
  @Post()
  create(@Body() dto: CreateBillDto, @Req() req: any) {
    return this.billsService.create(dto, req.user.id, req.user.role);
  }

  // ─── Read: role-based visibility ─────────────────────────────────────────
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
      return this.billsService.findAll({ submittedById: req.user.id, siteId, status }, p, l);
    }

    if (role === 'admin' || role === 'accountant') {
      return this.billsService.findAll({ siteId, vendorId, status }, p, l);
    }

    // site_supervisor: no siteId → own bills; with siteId → all bills for that site
    if (!siteId) return this.billsService.findAll({ submittedById: req.user.id, status }, p, l);
    return this.billsService.findAll({ siteId, status }, p, l);
  }

  // ─── Admin: pending delete requests queue ────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('delete-requests')
  findPendingDeleteRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billsService.findPendingDeleteRequests(Number(page) || 1, Number(limit) || 20);
  }

  // ─── Single bill ──────────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billsService.findOne(id);
  }

  // ─── Admin: update bill metadata (pending only) ──────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateBillDto) {
    return this.billsService.adminUpdate(id, dto);
  }

  // ─── Admin: direct delete (pending or approved) ───────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  adminDelete(@Param('id') id: string) {
    return this.billsService.adminDelete(id);
  }

  // ─── Site Supervisor / Accountant: request delete ────────────────────────
  @UseGuards(RolesGuard)
  @Roles('site_supervisor', 'accountant')
  @Post(':id/delete-request')
  requestDelete(@Param('id') id: string, @Req() req: any) {
    return this.billsService.requestDelete(id, req.user.id);
  }

  // ─── Admin / Accountant: approve ─────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.billsService.approve(id, req.user.id);
  }

  // ─── Admin / Accountant: reject ──────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectBillDto, @Req() req: any) {
    return this.billsService.reject(id, dto, req.user.id);
  }

  // ─── Admin: resolve delete request ───────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/delete-request/resolve')
  resolveDeleteRequest(
    @Param('id') id: string,
    @Query('approve') approve: string,
    @Req() req: any,
  ) {
    return this.billsService.resolveDeleteRequest(id, approve === 'true', req.user.id);
  }

  // ─── Accountant: release payment ─────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('accountant')
  @Post(':id/pay')
  releasePayment(@Param('id') id: string, @Body() dto: ReleasePaymentDto, @Req() req: any) {
    return this.billsService.releasePayment(id, dto, req.user.id);
  }
}
