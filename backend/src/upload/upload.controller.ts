import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger'
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UploadService } from './upload.service'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
const MAX_SIZE_BYTES = 20 * 1024 * 1024

@ApiBearerAuth('access-token')
@ApiTags('Upload')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file to MinIO',
    description: 'Returns a MinIO object key and a signed download URL (valid 1 hour). Use the key as mediaKey when sending image/video messages. Supported: JPEG, PNG, WEBP, MP4, PDF. Max 20 MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload (max 20 MB)' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded — returns key and signed URL',
    schema: {
      example: {
        key: 'assets/2026/04/11/abc123-photo.jpg',
        url: 'http://localhost:9000/marketplace-assets/assets/2026/04/11/abc123-photo.jpg?X-Amz-Signature=...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file, unsupported type, or exceeds 20 MB', schema: { example: { statusCode: 400, message: 'File type not allowed: application/pdf', error: 'Bad Request' } } })
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided.')
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype))
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`)
    if (file.size > MAX_SIZE_BYTES)
      throw new BadRequestException('File exceeds 20 MB limit.')

    const key = await this.uploadService.upload(file.buffer, {
      mimeType:     file.mimetype,
      folder:       'assets',
      originalName: file.originalname,
    })
    const url = await this.uploadService.getSignedUrl(key)
    return { key, url }
  }
}
