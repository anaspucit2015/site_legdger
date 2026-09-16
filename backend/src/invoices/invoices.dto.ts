import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @IsOptional() @IsString() taskId?: string;
  @IsOptional() @IsString() customTaskName?: string;
  @IsOptional() @IsString() customTaskUnit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() customTaskUnitCost?: number;
  @IsString() siteId: string;
  @IsOptional() @IsString() vendorId?: string;
  @Type(() => Number) @IsNumber() quantity: number;
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
}

export class RejectInvoiceDto {
  @IsString() rejectionReason: string;
  @IsOptional() @IsString() rejectionReasonOther?: string;
}

export class VoidInvoiceDto {
  @IsString() reason: string;
}
