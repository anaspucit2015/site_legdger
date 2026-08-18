import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  name: string;

  @IsString()
  contactPerson: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBalance?: number;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBalance?: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  isArchived?: boolean;
}
