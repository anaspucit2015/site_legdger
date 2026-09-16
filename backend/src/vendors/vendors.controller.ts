import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { ApplyAdvanceDto, CreateVendorDto, GiveAdvanceDto, PayVendorDto, ReverseTransactionDto, UpdateVendorDto } from './vendors.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendorsService.create(dto);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.vendorsService.findAll(Number(page) || 1, Number(limit) || 20);
  }

  // Must come before /:id routes
  @Get('active')
  findActive() {
    return this.vendorsService.findActive();
  }

  // ─── Transaction reverse — literal path must come before /:id ─────────────
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post('transactions/:txnId/reverse')
  reverseTransaction(
    @Param('txnId') txnId: string,
    @Body() dto: ReverseTransactionDto,
    @Req() req: any,
  ) {
    return this.vendorsService.reverseTransaction(txnId, dto.reason, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.vendorsService.deactivate(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.vendorsService.archive(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/advance')
  giveAdvance(@Param('id') id: string, @Body() dto: GiveAdvanceDto, @Req() req: any) {
    return this.vendorsService.giveAdvance(id, dto, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/apply-advance')
  applyAdvance(@Param('id') id: string, @Body() dto: ApplyAdvanceDto, @Req() req: any) {
    return this.vendorsService.applyAdvance(id, dto, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post(':id/pay')
  payVendor(@Param('id') id: string, @Body() dto: PayVendorDto, @Req() req: any) {
    return this.vendorsService.payVendor(id, dto, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Get(':id/transactions')
  getTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorsService.getTransactions(id, Number(page) || 1, Number(limit) || 20);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Get(':id/statement')
  getStatement(@Param('id') id: string) {
    return this.vendorsService.getStatement(id);
  }
}
