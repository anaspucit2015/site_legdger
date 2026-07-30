import { IsIn, IsString } from 'class-validator';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class GetPresignedUrlDto {
  @IsString()
  fileName: string;

  @IsIn(ALLOWED_TYPES, {
    message: `fileType must be one of: ${ALLOWED_TYPES.join(', ')}`,
  })
  fileType: string;
}
