# Object: ProofAsset

> Table: `proof_assets`
> A photo, video, or document uploaded as evidence for a listing or evidence request.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| uploaderUserId | String | FK → User |
| assetType | `photo \| video \| document` | |
| fileUrl | String | Supabase Storage URL |
| thumbnailUrl | String? | Auto-generated for photos/videos |
| context | `initial_listing \| evidence_response \| demand_reference` | |
| parentListingId | String? | FK → ProductListing |
| parentDemandId | String? | FK → DemandRequest |
| evidenceRequestId | String? | FK → EvidenceRequest |
| qualityScore | Int? | 0–100, computed (blur, brightness) |
| flagged | Boolean | Admin-flagged for review |
| createdAt | DateTime | |

---

## Quality Score

`qualityScore < 30` triggers a re-upload prompt in the UI.
MVP: static placeholder value = 90 for all uploads.
Phase 2: Google Vision API for blur detection + object presence check.

---

## Storage Policy

Files uploaded to Supabase Storage bucket `proof-assets`.
Path format: `{userId}/{listingId or demandId}/{timestamp}-{filename}`

Users can only upload to their own `userId/` prefix (bucket policy).

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-PA1 | Max file size: 10MB for photos, 60 seconds for videos |
| R-PA2 | External URL links not accepted as proof |
| R-PA3 | `qualityScore < 30` shows re-upload warning |
| R-PA4 | Flagged assets hidden from buyer view until admin review |
| R-PA5 | Proof snapshot copied to Order at Offer acceptance (immutable record) |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload asset, returns `fileUrl` |

---

## Related Objects

- [product-listing.md](product-listing.md) — Initial listing proof
- [conversation.md](conversation.md) — Evidence responses
- [order.md](order.md) — Snapshotted at offer acceptance
