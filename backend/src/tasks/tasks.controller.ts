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
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  // Admin creates predefined tasks
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: any) {
    return this.tasksService.create(dto, req.user.id);
  }

  // All roles — all tasks (with ?active=true for vendor dropdown)
  @Get()
  findAll(@Query('active') active: string) {
    if (active === 'true') return this.tasksService.findAllActive();
    return this.tasksService.findAll();
  }

  // All roles — single task
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // Admin updates task — rate change triggers rate history log
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: any) {
    return this.tasksService.update(id, dto, req.user.id);
  }

  // Admin deactivates task
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.tasksService.deactivate(id);
  }

  // Rate history for a task
  @Get(':id/rate-history')
  getRateHistory(@Param('id') id: string) {
    return this.tasksService.getRateHistory(id);
  }
}
