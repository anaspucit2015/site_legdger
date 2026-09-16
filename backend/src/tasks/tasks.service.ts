import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto, adminId: string) {
    return this.prisma.task.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        unitCost: dto.unitCost ?? null,
        isCustom: false,
        createdBy: adminId,
      },
      include: { rateHistory: true },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        include: { rateHistory: { orderBy: { changedAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count(),
    ]);
    return { data, total, page, limit };
  }

  findAllActive() {
    return this.prisma.task.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { rateHistory: { orderBy: { changedAt: 'desc' } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, adminId: string) {
    const task = await this.findOne(id);

    const rateChanged =
      dto.unitCost !== undefined &&
      dto.unitCost !== null &&
      String(task.unitCost ?? '') !== String(dto.unitCost);

    return this.prisma.$transaction(async (tx) => {
      if (rateChanged) {
        await tx.taskRateHistory.create({
          data: {
            taskId: id,
            oldRate: task.unitCost,
            newRate: dto.unitCost!,
            changedBy: adminId,
          },
        });
      }

      return tx.task.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.unit && { unit: dto.unit }),
          ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: { rateHistory: { orderBy: { changedAt: 'desc' } } },
      });
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.task.update({
      where: { id },
      data: { isActive: false },
    });
  }

  getRateHistory(taskId: string) {
    return this.prisma.taskRateHistory.findMany({
      where: { taskId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
