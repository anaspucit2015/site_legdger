import { Module } from '@nestjs/common';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
