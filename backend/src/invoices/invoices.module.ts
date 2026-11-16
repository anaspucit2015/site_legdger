import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { BalanceService } from '../balance/balance.service';

@Module({
  imports: [],
  controllers: [InvoicesController],
  providers: [InvoicesService, BalanceService],
})
export class InvoicesModule {}
