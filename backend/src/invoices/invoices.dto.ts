import { IsDecimal, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  siteId: string;

  @IsString()
  vendorId: string;

  // Either taskId OR all three customTask* fields must be provided
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

  // Only for admin-created tasks with isCustom=true and no unitCost
  @IsOptional()
  @IsDecimal()
  amount?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  // Admin-only: set invoice status at creation time
  @IsOptional()
  @IsIn(['pending', 'approved', 'paid'])
  status?: 'pending' | 'approved' | 'paid';
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

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
