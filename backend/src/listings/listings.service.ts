import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService }   from '../prisma/prisma.service'
import { MatchingService } from '../matching/matching.service'
import { UploadService }   from '../upload/upload.service'
import { AiService }       from '../ai/ai.service'
import { transitionListing } from '../common/state-machines'
import { CreateListingDto, UpdateListingDto } from './dto/listings.dto'

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name)

  constructor(
    private readonly prisma:    PrismaService,
    private readonly matching:  MatchingService,
    private readonly upload:    UploadService,
    private readonly ai:        AiService,
  ) {}

  async create(userId: string, dto: CreateListingDto) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    })
    if (!sellerProfile) throw new NotFoundException('Seller profile not found.')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    return this.prisma.productListing.create({
      data: {
        sellerProfileId: sellerProfile.id,
        title: dto.title,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        description: dto.description,
        condition: dto.condition,
        conditionNotes: dto.conditionNotes,
        quantityAvailable: dto.quantityAvailable,
        quantityRemaining: dto.quantityAvailable,
        priceExpectation: dto.priceExpectation,
        priceFlexible: dto.priceFlexible ?? false,
        location: dto.location,
        availabilityWindow: dto.availabilityWindow,
        status: 'draft',
        expiresAt,
      },
    })
  }

  async list(userId: string) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    })
    if (!sellerProfile) throw new NotFoundException('Seller profile not found.')

    return this.prisma.productListing.findMany({
      where:   { sellerProfileId: sellerProfile.id },
      include: {
        proofAssets: { select: { id: true, fileUrl: true, assetType: true }, orderBy: { createdAt: 'asc' } },
        matches:     { select: { id: true, matchScore: true, matchConfidence: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const listing = await this.prisma.productListing.findUnique({
      where: { id },
      include: { proofAssets: true, matches: true },
    })
    if (!listing) throw new NotFoundException('Listing not found.')
    return listing
  }

  async findOneOwned(userId: string, id: string) {
    const listing = await this.findOne(id)
    const sellerProfile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    })
    if (!sellerProfile || listing.sellerProfileId !== sellerProfile.id)
      throw new ForbiddenException('Access denied.')
    return listing
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.findOneOwned(userId, id)

    if (listing.status !== 'draft') {
      throw new UnprocessableEntityException(
        `Cannot edit listing with status '${listing.status}'. Only draft listings can be edited.`,
      )
    }

    return this.prisma.productListing.update({
      where: { id },
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        description: dto.description,
        condition: dto.condition,
        conditionNotes: dto.conditionNotes,
        quantityAvailable: dto.quantityAvailable,
        quantityRemaining: dto.quantityAvailable,
        priceExpectation: dto.priceExpectation,
        priceFlexible: dto.priceFlexible,
        location: dto.location,
        availabilityWindow: dto.availabilityWindow,
      },
    })
  }

  async publish(userId: string, id: string) {
    const listing = await this.findOneOwned(userId, id)


    const nextStatus = transitionListing(listing.status, 'active')

    const published = await this.prisma.productListing.update({
      where: { id },
      data: { status: nextStatus },
    })

    // fire-and-forget
    this.matching.runForListing(id).catch(() => null)

    return published
  }

  async remove(userId: string, id: string) {
    const listing = await this.findOneOwned(userId, id)
    const nextStatus = transitionListing(listing.status, 'removed')

    return this.prisma.productListing.update({
      where: { id },
      data: { status: nextStatus },
    })
  }

  // ─── LISTING IMAGES ───────────────────────────────────────────────────────

  async listImages(userId: string, listingId: string) {
    await this.findOneOwned(userId, listingId)
    return this.prisma.proofAsset.findMany({
      where: { parentListingId: listingId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async removeImage(userId: string, listingId: string, assetId: string) {
    await this.findOneOwned(userId, listingId)

    const asset = await this.prisma.proofAsset.findUnique({ where: { id: assetId } })
    if (!asset || asset.parentListingId !== listingId)
      throw new NotFoundException('Image not found.')

    // Delete from MinIO — key is embedded in the fileUrl path after the bucket
    // Best effort: extract key from URL or store key separately
    // For now derive key from fileUrl: "http://host:port/bucket/KEY"
    try {
      const url = new URL(asset.fileUrl)
      // path = /bucket-name/folder/uuid.ext → strip leading slash + bucket segment
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const key = parts.slice(1).join('/')
        await this.upload.delete(key)
      }
    } catch {
      this.logger.warn(`Could not delete MinIO object for asset ${assetId}`)
    }

    await this.prisma.proofAsset.delete({ where: { id: assetId } })
    await this.recalcProofScore(listingId)

    return { ok: true }
  }

  async addImage(userId: string, listingId: string, file: Express.Multer.File) {
    await this.findOneOwned(userId, listingId)

    const isVideo = file.mimetype.startsWith('video/')
    const folder  = isVideo ? 'listings/videos' : 'listings/images'

    const key = await this.upload.upload(file.buffer, {
      mimeType:     file.mimetype,
      folder,
      originalName: file.originalname,
    })
    const url = await this.upload.getSignedUrl(key, 3600 * 24 * 7) // 7-day URL

    const asset = await this.prisma.proofAsset.create({
      data: {
        uploaderUserId:  userId,
        assetType:       isVideo ? 'video' : 'photo',
        fileUrl:         url,
        context:         'initial_listing',
        parentListingId: listingId,
      },
    })

    // Fire-and-forget AI analysis for images only
    if (!isVideo) {
      this.analyzeWithFlorence(asset.id, url).catch(() => null)
    }

    // Recalculate proof completeness score
    await this.recalcProofScore(listingId)

    return { ...asset, mediaKey: key }
  }

  private async analyzeWithFlorence(assetId: string, imageUrl: string) {
    try {
      const aiAttributes = await this.ai.visionExtract(imageUrl, ['detailed_caption', 'ocr', 'object_detection']) as any
      await this.prisma.proofAsset.update({
        where: { id: assetId },
        data:  { aiAttributes },
      })
      this.logger.log(`AI analysis saved for asset ${assetId}`)
    } catch (err) {
      this.logger.warn(`Florence-2 analysis failed for asset ${assetId}: ${err}`)
    }
  }

  private async recalcProofScore(listingId: string) {
    const assets = await this.prisma.proofAsset.findMany({
      where: { parentListingId: listingId },
    })
    const photoCount = assets.filter(a => a.assetType === 'photo').length
    const videoCount = assets.filter(a => a.assetType === 'video').length
    const hasAI      = assets.some(a => a.aiAttributes !== null)

    // Scoring: 20pts per photo (max 60), 20pts for video, 20pts for AI analysis
    const score = Math.min(photoCount * 20, 60) + (videoCount > 0 ? 20 : 0) + (hasAI ? 20 : 0)

    await this.prisma.productListing.update({
      where: { id: listingId },
      data:  { proofCompletenessScore: Math.min(score, 100) },
    })
  }
}
