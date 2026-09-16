import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { TasksModule } from './tasks/tasks.module';
import { InvoicesModule } from './invoices/invoices.module';
import { BillsModule } from './bills/bills.module';
import { ReportsModule } from './reports/reports.module';
import { UploadsModule } from './uploads/uploads.module';
import { VendorsModule } from './vendors/vendors.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, SitesModule, TasksModule, InvoicesModule, BillsModule, ReportsModule, UploadsModule, VendorsModule],
})
export class AppModule {}
