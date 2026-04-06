# File Upload and Proof Asset Management

> Route: `POST /api/upload`
> Storage: Supabase Storage, bucket `proof-assets`
> Record: Creates a `ProofAsset` row in the database after upload

---

## Upload Flow

1. Client sends `multipart/form-data` to `POST /api/upload`.
2. Server validates file type and size.
3. File is uploaded to Supabase Storage under `{userId}/{timestamp}-{filename}`.
4. A `ProofAsset` record is created in the database with the public URL.
5. The `ProofAsset` object is returned to the client.

---

## Upload Route

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/utils/auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
const MAX_SIZE = {
  photo: 10 * 1024 * 1024,  // 10 MB
  video: 50 * 1024 * 1024,  // 50 MB
}

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  const formData = await req.formData()

  const file              = formData.get('file') as File
  const context           = formData.get('context') as string            // 'initial_listing' | 'evidence_response' | 'demand_reference'
  const parentListingId   = formData.get('parentListingId') as string | null
  const evidenceRequestId = formData.get('evidenceRequestId') as string | null

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video')
  const limit   = isVideo ? MAX_SIZE.video : MAX_SIZE.photo
  if (file.size > limit) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const path     = `${user.id}/${Date.now()}-${file.name}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('proof-assets')
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('proof-assets')
    .getPublicUrl(path)

  const asset = await prisma.proofAsset.create({
    data: {
      uploaderUserId:    user.id,
      assetType:         isVideo ? 'video' : 'photo',
      fileUrl:           publicUrl,
      context:           context as any,
      parentListingId:   parentListingId ?? undefined,
      evidenceRequestId: evidenceRequestId ?? undefined,
      qualityScore:      90, // MVP: static; replace with image analysis in Phase 2
    }
  })

  return NextResponse.json(asset, { status: 201 })
}
```

---

## Supabase Storage Bucket Policy

Bucket name: `proof-assets`

| Operation | Policy |
|-----------|--------|
| Read | Any authenticated user (public reads within the app) |
| Insert | Authenticated user; path must start with their `user_id/` |
| Update | Not allowed |
| Delete | Uploader (`uploaderUserId = auth.uid()`) or admin (service role) |

SQL policy for insert restriction:

```sql
CREATE POLICY "Users upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proof-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Proof Completeness Score

`proof_completeness_score` on `ProductListing` is a 0–100 integer computed from the listing's proof assets. In MVP this is a simple rule:

| Condition | Score contribution |
|-----------|-------------------|
| 0 photos | 0 |
| 1 photo, quality ≥ 30 | 30 |
| 2 photos, quality ≥ 30 | 60 |
| 3+ photos, quality ≥ 30 | 80 |
| Includes at least 1 video | +20 |

Update the score whenever a `ProofAsset` is added to a listing:

```typescript
// Called after ProofAsset is created for a listing
async function recomputeProofCompleteness(listingId: string) {
  const assets = await prisma.proofAsset.findMany({
    where: { parentListingId: listingId, qualityScore: { gte: 30 } }
  })
  const photos = assets.filter(a => a.assetType === 'photo').length
  const videos = assets.filter(a => a.assetType === 'video').length

  let score = 0
  if (photos >= 3) score = 80
  else if (photos === 2) score = 60
  else if (photos === 1) score = 30

  if (videos >= 1) score = Math.min(100, score + 20)

  await prisma.productListing.update({
    where: { id: listingId },
    data:  { proofCompletenessScore: score }
  })
}
```

A listing cannot be published (`draft → active`) if `proofCompletenessScore < 60`.

---

## Phase 2: Real Quality Scoring

Replace the static `qualityScore: 90` with a call to an image analysis API (e.g., Google Vision `SAFE_SEARCH_DETECTION` + blur/brightness heuristics). This runs asynchronously after upload and patches the `ProofAsset` record.
