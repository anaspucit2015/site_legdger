import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { MaxLength } from 'class-validator';

export class CreateVendorDto {
  @IsString() name: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountTitle?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() branchCode?: string;
  @IsOptional() @IsNumber() currentBalance?: number;
}

export class UpdateVendorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountTitle?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() branchCode?: string;
  @IsOptional() @IsNumber() currentBalance?: number;
  @IsOptional() isActive?: boolean;
}

export class GiveAdvanceDto {
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() notes?: string;
}

export class ApplyAdvanceDto {
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() notes?: string;
}

export class PayVendorDto {
  @IsNumber() @IsPositive() amount: number;
  @IsIn(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'JAZZCASH_EASYPAISA'])
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA';
  @IsOptional() @IsString() paymentRef?: string;
  @IsOptional() @IsString() @MaxLength(500) invoiceReferenceNote?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReverseTransactionDto {
  @IsString() reason: string;
}
