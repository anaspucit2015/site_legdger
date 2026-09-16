import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { GetPresignedUrlDto } from './uploads.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  // ─── Get presigned PUT URL for direct-to-R2 upload ───────────────────────
  // All authenticated roles can request one (vendor, admin, accountant)
  @Post('presigned-url')
  getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    return this.uploadsService.getPresignedUrl(dto);
  }
}
