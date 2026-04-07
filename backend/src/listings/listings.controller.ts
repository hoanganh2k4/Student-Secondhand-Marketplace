import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ListingsService } from './listings.service'
import { CreateListingDto, UpdateListingDto } from './dto/listings.dto'

const ALLOWED_IMAGE_VIDEO = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateListingDto) {
    return this.listingsService.create(req.user.id, dto)
  }

  @Get()
  list(@Request() req: any) {
    return this.listingsService.list(req.user.id)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id)
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(req.user.id, id, dto)
  }

  @Post(':id/publish')
  publish(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.publish(req.user.id, id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.remove(req.user.id, id)
  }

  // ─── LISTING IMAGES / VIDEOS ────────────────────────────────────────────────

  @Get(':id/images')
  listImages(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.listImages(req.user.id, id)
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  async addImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided.')
    if (!ALLOWED_IMAGE_VIDEO.includes(file.mimetype))
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`)
    if (file.size > MAX_SIZE)
      throw new BadRequestException('File exceeds 50 MB limit.')
    return this.listingsService.addImage(req.user.id, id, file)
  }

  @Delete(':id/images/:assetId')
  @HttpCode(HttpStatus.OK)
  removeImage(
    @Request() req: any,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.listingsService.removeImage(req.user.id, id, assetId)
  }
}
