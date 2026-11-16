import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  name: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBalance?: number;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  isArchived?: boolean;
}
