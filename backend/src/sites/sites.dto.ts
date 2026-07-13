import { IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  name: string;

  @IsString()
  location: string;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  isActive?: boolean;
}
