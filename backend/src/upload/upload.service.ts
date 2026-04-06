import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name)
  private s3: S3Client
  private bucket: string

  constructor(private config: ConfigService) {
    const endpoint = `${config.get('MINIO_USE_SSL', 'false') === 'true' ? 'https' : 'http'}://${config.get('MINIO_ENDPOINT', 'localhost')}:${config.get('MINIO_PORT', '9000')}`

    this.s3 = new S3Client({
      endpoint,
      region: 'us-east-1', // MinIO requires a region value
      credentials: {
        accessKeyId:     config.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: config.get('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true, // Required for MinIO
    })

    this.bucket = config.get('MINIO_BUCKET', 'marketplace-assets')
  }

  async onModuleInit() {
    await this.ensureBucketExists()
  }

  private async ensureBucketExists() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }))
      this.logger.log(`Created MinIO bucket: ${this.bucket}`)
    }
  }

  /** Upload a file buffer and return the stored object key */
  async upload(
    buffer: Buffer,
    options: { mimeType: string; folder?: string; originalName?: string },
  ): Promise<string> {
    const ext   = options.originalName?.split('.').pop() ?? 'bin'
    const key   = `${options.folder ?? 'uploads'}/${randomUUID()}.${ext}`

    await this.s3.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        buffer,
        ContentType: options.mimeType,
      }),
    )

    return key
  }

  /** Generate a pre-signed URL valid for the given seconds (default 1 hour) */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.s3, command, { expiresIn })
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
