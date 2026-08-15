import { IsDecimal, IsIn, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBillLineItemDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  customTaskName?: string;

  @IsOptional()
  @IsString()
  customTaskUnit?: string;

  @IsOptional()
  @IsDecimal()
  customTaskUnitCost?: string;

  @IsDecimal()
  quantity: string;
}

export class CreateBillDto {
  @IsString()
  siteId: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBillLineItemDto)
  lineItems: CreateBillLineItemDto[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'paid'])
  status?: 'pending' | 'approved' | 'paid';
}

export class UpdateBillDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

const REJECTION_REASONS = [
  'Duplicate submission',
  'Incorrect quantity',
  'Incorrect amount',
  'Missing receipt',
  'Task not authorized',
  'Other',
];

export class RejectBillDto {
  @IsIn(REJECTION_REASONS)
  rejectionReason: string;

  @IsOptional()
  @IsString()
  rejectionReasonOther?: string;
}

export class ReleasePaymentDto {
  @IsString()
  paymentRef: string;
}
