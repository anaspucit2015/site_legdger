import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto } from './vendors.dto';
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
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.vendorsService.findActive();
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
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.vendorsService.deactivate(id);
  }
}
