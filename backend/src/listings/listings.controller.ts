import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger'
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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ListingsService } from './listings.service'
import { CreateListingDto, UpdateListingDto } from './dto/listings.dto'

const ALLOWED_IMAGE_VIDEO = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
]
const MAX_SIZE = 50 * 1024 * 1024

const LISTING_EXAMPLE = {
  id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  sellerProfileId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  title: 'MacBook Pro 2020 M1 13 inch',
  categoryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  description: 'MacBook Pro M1 2020, 8GB RAM, 256GB SSD. Máy nguyên seal, pin còn 98%.',
  condition: 'like_new',
  conditionNotes: 'Pin 98%, không trầy xước, đủ phụ kiện.',
  quantityAvailable: 1,
  quantityRemaining: 1,
  priceExpectation: '18500000',
  priceFlexible: true,
  location: 'Quận Bình Thạnh, TP.HCM',
  availabilityWindow: 'Thứ 2–6 sau 18h, cuối tuần cả ngày',
  status: 'draft',
  proofCompletenessScore: 0,
  expiresAt: '2026-05-11T00:00:00.000Z',
  createdAt: '2026-04-11T09:00:00.000Z',
}

const PROOF_ASSET_EXAMPLE = {
  id: 'asset-uuid-here',
  uploaderUserId: 'user-uuid-here',
  assetType: 'photo',
  fileUrl: 'http://localhost:9000/marketplace-assets/listings/macbook-abc123.jpg',
  thumbnailUrl: null,
  context: 'initial_listing',
  parentListingId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  qualityScore: 85,
  aiAttributes: { caption: 'A silver MacBook laptop on a white surface', ocr: 'MacBook Pro' },
  flagged: false,
  createdAt: '2026-04-11T09:05:00.000Z',
}

@ApiBearerAuth('access-token')
@ApiTags('Listings')
@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product listing', description: 'Creates listing in draft. Upload images via POST /listings/:id/images, then publish via POST /listings/:id/publish to trigger AI matching.' })
  @ApiResponse({ status: 201, description: 'Listing created in draft status', schema: { example: LISTING_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Validation error', schema: { example: { statusCode: 400, message: ['quantityAvailable must not be less than 1'], error: 'Bad Request' } } })
  create(@Request() req: any, @Body() dto: CreateListingDto) {
    return this.listingsService.create(req.user.id, dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all listings for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Array of listings',
    schema: {
      example: [
        { ...LISTING_EXAMPLE, status: 'active', proofCompletenessScore: 80 },
        { ...LISTING_EXAMPLE, id: 'other-uuid', title: 'iPhone 14 Pro 128GB', status: 'draft', priceExpectation: '22000000' },
      ],
    },
  })
  list(@Request() req: any) {
    return this.listingsService.list(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single listing with images and matches' })
  @ApiResponse({
    status: 200,
    description: 'Listing with proofAssets and matches',
    schema: {
      example: {
        ...LISTING_EXAMPLE,
        status: 'active',
        category: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'Laptop' },
        proofAssets: [PROOF_ASSET_EXAMPLE],
        matches: [{
          id: 'match-uuid',
          matchScore: 78,
          matchConfidence: 'high',
          status: 'proposed',
          demandRequest: { id: 'demand-uuid', title: 'Cần mua laptop sinh viên', budgetMax: '10000000' },
        }],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Listing not found', schema: { example: { statusCode: 404, message: 'Listing not found', error: 'Not Found' } } })
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing (draft only)' })
  @ApiResponse({ status: 200, description: 'Updated listing', schema: { example: { ...LISTING_EXAMPLE, priceExpectation: '17000000', priceFlexible: true } } })
  @ApiResponse({ status: 400, description: 'Cannot update — not in draft', schema: { example: { statusCode: 400, message: 'Only draft listings can be updated', error: 'Bad Request' } } })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(req.user.id, id, dto)
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish listing and trigger AI matching', description: 'Changes status to active and runs the matching engine against all active demands.' })
  @ApiResponse({
    status: 201,
    description: 'Published — matching ran',
    schema: {
      example: {
        listing: { ...LISTING_EXAMPLE, status: 'active' },
        matchesCreated: 2,
        matches: [
          { id: 'match-uuid-1', matchScore: 78, matchConfidence: 'high', demandRequestId: 'demand-uuid-1' },
          { id: 'match-uuid-2', matchScore: 61, matchConfidence: 'medium', demandRequestId: 'demand-uuid-2' },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already published or not in draft', schema: { example: { statusCode: 400, message: 'Listing is already active', error: 'Bad Request' } } })
  publish(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.publish(req.user.id, id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove / delete a listing' })
  @ApiResponse({
    status: 200,
    description: 'Listing removed',
    schema: { example: { deleted: true, id: 'd4e5f6a7-b8c9-0123-defa-234567890123' } },
  })
  @ApiResponse({ status: 404, description: 'Listing not found', schema: { example: { statusCode: 404, message: 'Listing not found', error: 'Not Found' } } })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.remove(req.user.id, id)
  }

  // ─── IMAGES / VIDEOS ────────────────────────────────────────────────────────

  @Get(':id/images')
  @ApiOperation({ summary: 'List all proof assets for a listing' })
  @ApiResponse({
    status: 200,
    description: 'Array of ProofAsset objects',
    schema: { example: [PROOF_ASSET_EXAMPLE] },
  })
  listImages(@Request() req: any, @Param('id') id: string) {
    return this.listingsService.listImages(req.user.id, id)
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image/video for a listing', description: 'Florence-2 auto-extracts caption + OCR for AI matching. Supported: JPEG, PNG, WEBP, MP4, MOV, WEBM. Max 50 MB.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image or video (max 50 MB)' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded — AI attributes extracted',
    schema: { example: PROOF_ASSET_EXAMPLE },
  })
  @ApiResponse({ status: 400, description: 'No file, unsupported type, or exceeds 50 MB', schema: { example: { statusCode: 400, message: 'Unsupported file type: application/pdf', error: 'Bad Request' } } })
  async addImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
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
  @ApiOperation({ summary: 'Delete a proof asset from a listing' })
  @ApiResponse({ status: 200, description: 'Asset deleted', schema: { example: { message: 'Asset deleted', assetId: 'asset-uuid-here' } } })
  removeImage(
    @Request() req: any,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.listingsService.removeImage(req.user.id, id, assetId)
  }
}
