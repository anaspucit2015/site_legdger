import { IsDecimal, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  siteId: string;

  @IsString()
  taskId: string;

  @IsDecimal()
  quantity: string;

  // Custom task fields (only when task.isCustom = true)
  @IsOptional()
  @IsDecimal()
  amount?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDecimal()
  quantity?: string;

  @IsOptional()
  @IsDecimal()
  amount?: string;

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

export class ApproveInvoiceDto {
  // no body needed — just the action
}

export class RejectInvoiceDto {
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
