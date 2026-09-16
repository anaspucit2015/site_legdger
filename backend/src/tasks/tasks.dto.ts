import { IsBoolean, IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsDecimal()
  unitCost?: string; // Decimal comes in as string from JSON
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsDecimal()
  unitCost?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
