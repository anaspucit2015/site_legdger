import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { GetPresignedUrlDto } from './uploads.dto';

@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!endpoint || !bucket || !publicUrl) {
      throw new Error('R2_ENDPOINT, R2_BUCKET_NAME, and R2_PUBLIC_URL must be set');
    }

    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, ''); // strip trailing slash

    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
      // Disable automatic checksum injection — R2 doesn't support CRC32 in presigned PUTs
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async getPresignedUrl(dto: GetPresignedUrlDto): Promise<{ presignedUrl: string; objectUrl: string }> {
    const sanitizedName = dto.fileName
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    const key = `receipts/${randomUUID()}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.fileType,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const objectUrl = `${this.publicUrl}/${key}`;

    return { presignedUrl, objectUrl };
  }
}
