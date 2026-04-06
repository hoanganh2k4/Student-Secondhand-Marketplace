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
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided.')

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`)
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 20 MB limit.')
    }

    const key = await this.uploadService.upload(file.buffer, {
      mimeType:     file.mimetype,
      folder:       'assets',
      originalName: file.originalname,
    })

    const url = await this.uploadService.getSignedUrl(key)

    return { key, url }
  }
}
