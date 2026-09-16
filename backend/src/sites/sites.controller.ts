import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './sites.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SitesController {
  constructor(private sitesService: SitesService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Post()
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  // All roles — list all sites
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.sitesService.findAll(Number(page) || 1, Number(limit) || 20);
  }

  // All roles — list active sites (used by vendor at invoice creation)
  @Get('active')
  findActive() {
    return this.sitesService.findActive();
  }

  // All roles — single site
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.sitesService.archive(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.sitesService.deactivate(id);
  }
}
