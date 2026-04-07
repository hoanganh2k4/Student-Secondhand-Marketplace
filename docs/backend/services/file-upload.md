# File Upload and Proof Asset Management

> Route: `POST /upload` (NestJS, port 4000)
> Storage: MinIO (Docker, S3-compatible) — bucket `proof-assets`
> Record: Creates a `ProofAsset` row in the database after upload

---

## Upload Flow

1. Client sends `multipart/form-data` to `POST /api/upload` (NestJS).
2. NestJS validates file type and size via `FileInterceptor`.
3. File is streamed to MinIO under `{userId}/{timestamp}-{filename}`.
4. A `ProofAsset` record is created in the database with the MinIO URL.
5. The `ProofAsset` object is returned to the client.

---

## Upload Controller

```typescript
// backend/src/upload/upload.controller.ts
import {
  Controller, Post, UploadedFile, UseGuards,
  UseInterceptors, Request, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor }  from '@nestjs/platform-express'
import { JwtAuthGuard }     from '../auth/guards/jwt-auth.guard'
import { UploadService }    from './upload.service'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
const MAX_PHOTO_SIZE = 10 * 1024 * 1024  // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024  // 50 MB

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided')

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed')
    }

    const isVideo = file.mimetype.startsWith('video/')
    const limit   = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE
    if (file.size > limit) {
      throw new BadRequestException('File too large')
    }

    return this.uploadService.upload(req.user.id, file, req.body)
  }
}
```

---

## Upload Service

```typescript
// backend/src/upload/upload.service.ts
import { Injectable }        from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { ConfigService }     from '@nestjs/config'
import { PrismaService }     from '../prisma/prisma.service'

@Injectable()
export class UploadService {
  private s3: S3Client
  private bucket: string

  constructor(
    private config:  ConfigService,
    private prisma:  PrismaService,
  ) {
    this.bucket = this.config.get('MINIO_BUCKET')!   // 'proof-assets'
    this.s3 = new S3Client({
      endpoint:         this.config.get('MINIO_ENDPOINT'),  // 'http://localhost:9000'
      region:           'us-east-1',                        // any value for MinIO
      credentials: {
        accessKeyId:     this.config.get('MINIO_ACCESS_KEY')!,
        secretAccessKey: this.config.get('MINIO_SECRET_KEY')!,
      },
      forcePathStyle: true,  // required for MinIO
    })
  }

  async upload(
    userId:  string,
    file:    Express.Multer.File,
    body:    { context?: string; parentListingId?: string; evidenceRequestId?: string }
  ) {
    const key       = `${userId}/${Date.now()}-${file.originalname}`
    const isVideo   = file.mimetype.startsWith('video/')

    await this.s3.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
    }))

    const fileUrl = `${this.config.get('MINIO_ENDPOINT')}/${this.bucket}/${key}`

    const asset = await this.prisma.proofAsset.create({
      data: {
        uploaderUserId:    userId,
        assetType:         isVideo ? 'video' : 'photo',
        fileUrl,
        context:           body.context as any ?? 'initial_listing',
        parentListingId:   body.parentListingId  ?? undefined,
        evidenceRequestId: body.evidenceRequestId ?? undefined,
        qualityScore:      90,  // MVP: static; Phase 2: image analysis
      },
    })

    // Recompute completeness score if this asset belongs to a listing
    if (asset.parentListingId) {
      await this.recomputeProofCompleteness(asset.parentListingId)
    }

    return asset
  }

  private async recomputeProofCompleteness(listingId: string) {
    const assets = await this.prisma.proofAsset.findMany({
      where: { parentListingId: listingId, qualityScore: { gte: 30 } },
    })

    const photos = assets.filter(a => a.assetType === 'photo').length
    const videos = assets.filter(a => a.assetType === 'video').length

    let score = 0
    if      (photos >= 3) score = 80
    else if (photos === 2) score = 60
    else if (photos === 1) score = 30

    if (videos >= 1) score = Math.min(100, score + 20)

    await this.prisma.productListing.update({
      where: { id: listingId },
      data:  { proofCompletenessScore: score },
    })
  }
}
```

---

## MinIO Configuration

MinIO runs as a Docker container (defined in `docker-compose.yml`):

| Property | Value |
|----------|-------|
| API endpoint | `http://localhost:9000` |
| Console UI | `http://localhost:9001` |
| Default credentials | `minioadmin / minioadmin` |
| Bucket | `proof-assets` (create on first run) |

Create the bucket on first setup:

```bash
# Using MinIO Client (mc)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/proof-assets
mc anonymous set download local/proof-assets  # allow public reads
```

Or create it via the MinIO Console at `http://localhost:9001`.

---

## Proof Completeness Score

`proof_completeness_score` on `ProductListing` is a 0–100 integer computed from the listing's proof assets.

| Condition | Score contribution |
|-----------|-------------------|
| 0 photos | 0 |
| 1 photo, quality ≥ 30 | 30 |
| 2 photos, quality ≥ 30 | 60 |
| 3+ photos, quality ≥ 30 | 80 |
| Includes at least 1 video | +20 (capped at 100) |

A listing cannot be published (`draft → active`) if `proofCompletenessScore < 60`.

The score is recomputed automatically in `UploadService.recomputeProofCompleteness()` after each upload.

---

## Phase 2: Real Quality Scoring

Replace the static `qualityScore: 90` with a call to Florence-2-base or a vision API for blur/brightness/NSFW detection. This runs asynchronously after upload (via a queue) and patches the `ProofAsset.qualityScore` field, then triggers a score recompute.
