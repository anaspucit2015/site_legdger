import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './vendors.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({ data: dto });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({ orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.vendor.count(),
    ]);
    return { data, total, page, limit };
  }

  findActive() {
    return this.prisma.vendor.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  private async checkNoOpenRecords(vendorId: string) {
    const [invoiceCount, billCount] = await Promise.all([
      this.prisma.invoice.count({
        where: { vendorId, status: { in: ['pending', 'approved'] } },
      }),
      this.prisma.bill.count({
        where: { vendorId, status: { in: ['pending', 'approved'] } },
      }),
    ]);
    if (invoiceCount > 0 || billCount > 0) {
      throw new BadRequestException(
        `Cannot perform this action — vendor has ${invoiceCount + billCount} invoice(s)/bill(s) that are still pending or approved. All must be paid or rejected first.`,
      );
    }
  }

  async deactivate(id: string) {
    await this.findOne(id);
    await this.checkNoOpenRecords(id);
    return this.prisma.vendor.update({ where: { id }, data: { isActive: false } });
  }

  async archive(id: string) {
    await this.findOne(id);
    await this.checkNoOpenRecords(id);
    return this.prisma.vendor.update({ where: { id }, data: { isArchived: true } });
  }
}
