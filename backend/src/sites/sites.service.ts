import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto, UpdateSiteDto } from './sites.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSiteDto) {
    return this.prisma.site.create({ data: dto });
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

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);
    return this.prisma.site.update({ where: { id }, data: dto });
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
