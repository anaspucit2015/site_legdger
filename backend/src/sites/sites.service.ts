import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto, UpdateSiteDto } from './sites.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSiteDto) {
    // Opening balance is fixed at creation -- whatever starting balance is entered here
    // becomes the permanent historical baseline, separate from the live currentBalance.
    return this.prisma.site.create({
      data: { ...dto, openingBalance: dto.currentBalance ?? 0 },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.site.findMany({ orderBy: { siteCode: 'asc' }, skip, take: limit }),
      this.prisma.site.count(),
    ]);
    return { data, total, page, limit };
  }

  findActive() {
    return this.prisma.site.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async update(id: string, dto: UpdateSiteDto, performedById: string) {
    const existing = await this.findOne(id);

    if (dto.openingBalance === undefined) {
      return this.prisma.site.update({ where: { id }, data: dto });
    }

    // Edit Balance corrects the opening balance baseline -- this is what Total to date
    // is computed from. The live currentBalance field is not touched here.
    const { openingBalance, reason, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.site.update({
        where: { id },
        data: { ...rest, openingBalance },
      });
      await tx.balanceAdjustment.create({
        data: {
          entityType: 'SITE',
          siteId: id,
          previousOpeningBalance: existing.openingBalance,
          newOpeningBalance: openingBalance,
          previousCurrentBalance: existing.currentBalance,
          newCurrentBalance: existing.currentBalance,
          reason: reason ?? null,
          performedById,
        },
      });
      return updated;
    });
  }

  async getBalanceAdjustments(id: string, page = 1, limit = 20) {
    await this.findOne(id);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.balanceAdjustment.findMany({
        where: { siteId: id },
        include: { performedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.balanceAdjustment.count({ where: { siteId: id } }),
    ]);
    return { data, total, page, limit };
  }

  private async checkNoOpenRecords(siteId: string) {
    const [invoiceCount, billCount] = await Promise.all([
      this.prisma.invoice.count({
        where: { siteId, status: { in: ['pending', 'approved'] } },
      }),
      this.prisma.bill.count({
        where: { siteId, status: { in: ['pending', 'approved'] } },
      }),
    ]);
    if (invoiceCount > 0 || billCount > 0) {
      throw new BadRequestException(
        `Cannot perform this action — site has ${invoiceCount + billCount} invoice(s)/bill(s) that are still pending or approved. All must be paid or rejected first.`,
      );
    }
  }

  async deactivate(id: string) {
    await this.findOne(id);
    await this.checkNoOpenRecords(id);
    return this.prisma.site.update({ where: { id }, data: { isActive: false } });
  }

  async archive(id: string) {
    await this.findOne(id);
    await this.checkNoOpenRecords(id);
    return this.prisma.site.update({ where: { id }, data: { isArchived: true } });
  }
}
