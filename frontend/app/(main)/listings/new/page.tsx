'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, ImagePlus, X, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'

const CONDITIONS = ['poor', 'fair', 'good', 'very_good', 'like_new'] as const

interface UploadedAsset {
  id:           string
  fileUrl:      string
  assetType:    'photo' | 'video'
  aiAttributes: Record<string, string> | null
  localPreview: string   // object URL for preview
  uploading:    boolean
  error:        string
}

export default function CreateListingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { categories, loading: catsLoading } = useCategories()
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Step 1 + 2 form
  const [form, setForm] = useState({
    title:              '',
    categoryId:         '',
    description:        '',
    condition:          'good' as typeof CONDITIONS[number],
    conditionNotes:     '',
    quantityAvailable:  '1',
    priceExpectation:   '',
    priceFlexible:      false,
    location:           '',
    availabilityWindow: '',
  })

  // Step 3 state
  const [listingId,   setListingId]   = useState('')
  const [assets,      setAssets]      = useState<UploadedAsset[]>([])
  const [proofScore,  setProofScore]  = useState(0)
  const [publishing,  setPublishing]  = useState(false)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  // ── Step 2 submit: create draft ───────────────────────────────────────────
  async function createDraft() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/proxy/listings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantityAvailable: Number(form.quantityAvailable),
          priceExpectation:  Number(form.priceExpectation),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.message ?? 'Failed to create listing.')
        return
      }
      const listing = await res.json()
      setListingId(listing.id)
      setStep(3)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: pick files ────────────────────────────────────────────────────
  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''   // allow re-selecting same file

    files.forEach(file => {
      const isVideo   = file.type.startsWith('video/')
      const localPreview = URL.createObjectURL(file)
      const tempId    = crypto.randomUUID()

      const placeholder: UploadedAsset = {
        id:           tempId,
        fileUrl:      '',
        assetType:    isVideo ? 'video' : 'photo',
        aiAttributes: null,
        localPreview,
        uploading:    true,
        error:        '',
      }
      setAssets(prev => [...prev, placeholder])
      uploadFile(file, tempId, localPreview, isVideo)
    })
  }

  const uploadFile = useCallback(async (
    file:         File,
    tempId:       string,
    localPreview: string,
    isVideo:      boolean,
  ) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/proxy/listings/${listingId}/images`, {
        method: 'POST',
        body:   formData,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setAssets(prev => prev.map(a => a.id === tempId
          ? { ...a, uploading: false, error: d.message ?? 'Upload failed' }
          : a))
        return
      }
      const asset = await res.json()
      setAssets(prev => prev.map(a => a.id === tempId ? {
        ...a,
        id:          asset.id,
        fileUrl:     asset.fileUrl,
        aiAttributes: asset.aiAttributes,
        uploading:   false,
        error:       '',
      } : a))
      // Refresh proof score
      refreshScore()
      // Poll for AI attributes (Florence-2 runs async)
      if (!isVideo) pollAI(asset.id)
    } catch {
      setAssets(prev => prev.map(a => a.id === tempId
        ? { ...a, uploading: false, error: 'Network error' }
        : a))
    }
  }, [listingId])

  async function refreshScore() {
    const res = await fetch(`/api/proxy/listings/${listingId}`)
    if (res.ok) {
      const l = await res.json()
      setProofScore(l.proofCompletenessScore ?? 0)
    }
  }

  async function pollAI(assetId: string) {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const res = await fetch(`/api/proxy/listings/${listingId}/images`)
      if (!res.ok) break
      const images: any[] = await res.json()
      const updated = images.find(img => img.id === assetId)
      if (updated?.aiAttributes) {
        setAssets(prev => prev.map(a =>
          a.id === assetId ? { ...a, aiAttributes: updated.aiAttributes } : a
        ))
        refreshScore()
        break
      }
    }
  }

  async function removeAsset(assetId: string) {
    // Optimistically remove from UI first
    setAssets(prev => {
      const asset = prev.find(a => a.id === assetId)
      if (asset?.localPreview) URL.revokeObjectURL(asset.localPreview)
      return prev.filter(a => a.id !== assetId)
    })

    // If the asset has been uploaded to backend, delete it
    const asset = assets.find(a => a.id === assetId)
    if (asset?.fileUrl) {
      // Has a real backend record — call delete
      await fetch(`/api/proxy/listings/${listingId}/images/${assetId}`, {
        method: 'DELETE',
      }).catch(() => null)
    }

    // Refresh score from backend
    await refreshScore()
  }

  async function publish() {
    setPublishing(true)
    try {
      const res = await fetch(`/api/proxy/listings/${listingId}/publish`, { method: 'POST' })
      if (res.ok) {
        router.push(`/listings/${listingId}`)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.message ?? 'Publish failed.')
      }
    } finally {
      setPublishing(false)
    }
  }

  const photoCount  = assets.filter(a => a.assetType === 'photo' && !a.error).length
  const hasVideo    = assets.some(a => a.assetType === 'video' && !a.error)
  const anyUploading = assets.some(a => a.uploading)
  const canPublish  = proofScore >= 60 && !anyUploading

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/listings" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[18px] font-semibold text-[#111827]">New Listing</h1>
        <span className="ml-auto text-[13px] text-[#6B7280]">Step {step}/3</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#F3F4F6]">
        <div className="h-1 bg-[#2563EB] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">

        {/* ── STEP 1: Basic info ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                What are you selling? <span className="text-[#DC2626]">*</span>
              </label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., MacBook Air M1 2020"
                value={form.title}
                onChange={set('title')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                Category <span className="text-[#DC2626]">*</span>
              </label>
              <select
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                value={form.categoryId}
                onChange={set('categoryId')}
                disabled={catsLoading}
              >
                <option value="">{catsLoading ? 'Loading…' : 'Select a category'}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Description</label>
              <textarea
                rows={3}
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                placeholder="Describe your item, include any defects or extras..."
                value={form.description}
                onChange={set('description')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                Condition <span className="text-[#DC2626]">*</span>
              </label>
              <select
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                value={form.condition}
                onChange={set('condition')}
              >
                {CONDITIONS.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Condition Notes</label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Minor scratches on the lid"
                value={form.conditionNotes}
                onChange={set('conditionNotes')}
              />
            </div>
          </>
        )}

        {/* ── STEP 2: Pricing + location ─────────────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                Price (₫) <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="number"
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="0"
                value={form.priceExpectation}
                onChange={set('priceExpectation')}
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-[#D1D5DB] text-[#2563EB]"
                checked={form.priceFlexible}
                onChange={set('priceFlexible')}
              />
              <span className="text-[14px] text-[#374151]">Price is negotiable</span>
            </label>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Quantity</label>
              <input
                type="number"
                min={1}
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                value={form.quantityAvailable}
                onChange={set('quantityAvailable')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Location</label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Hanoi, Ho Chi Minh City"
                value={form.location}
                onChange={set('location')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Availability</label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Weekends, after 5pm"
                value={form.availabilityWindow}
                onChange={set('availabilityWindow')}
              />
            </div>

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}
          </>
        )}

        {/* ── STEP 3: Upload photos / videos ─────────────────────────────── */}
        {step === 3 && (
          <>
            {/* Proof score bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-[#374151]">Proof Score</span>
                <span className={`text-[13px] font-bold ${proofScore >= 60 ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                  {proofScore}/100
                </span>
              </div>
              <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${proofScore >= 60 ? 'bg-[#16A34A]' : 'bg-[#F59E0B]'}`}
                  style={{ width: `${proofScore}%` }}
                />
              </div>
              <p className="text-[12px] text-[#6B7280] mt-1">
                {proofScore >= 60
                  ? 'Great! You can publish now.'
                  : `Need ${60 - proofScore} more points to publish. Add more photos (+20 each, max 60) or a video (+20).`}
              </p>
            </div>

            {/* Scoring guide */}
            <div className="bg-[#EFF6FF] rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2 text-[12px] text-[#374151]">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${photoCount >= 1 ? 'text-[#16A34A]' : 'text-[#D1D5DB]'}`} />
                Photo ×1 = +20pts {photoCount >= 2 && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />}
                {photoCount >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#374151]">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasVideo ? 'text-[#16A34A]' : 'text-[#D1D5DB]'}`} />
                Video = +20pts
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#374151]">
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />
                AI analysis (auto) = +20pts
              </div>
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#D1D5DB] rounded-xl py-8 flex flex-col items-center gap-2 text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
            >
              <ImagePlus className="w-7 h-7" />
              <span className="text-[14px] font-medium">Add Photos or Videos</span>
              <span className="text-[12px]">JPG, PNG, WebP, MP4 · Max 50 MB each</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={onFilePick}
            />

            {/* Asset grid */}
            {assets.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {assets.map(asset => (
                  <div key={asset.id} className="relative aspect-square rounded-xl overflow-hidden bg-[#F3F4F6]">
                    {/* Preview */}
                    {asset.assetType === 'video' ? (
                      <video
                        src={asset.localPreview}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.localPreview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Uploading overlay */}
                    {asset.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}

                    {/* Error overlay */}
                    {asset.error && (
                      <div className="absolute inset-0 bg-[#DC2626]/80 flex items-center justify-center p-1">
                        <p className="text-white text-[10px] text-center">{asset.error}</p>
                      </div>
                    )}

                    {/* AI badge */}
                    {asset.aiAttributes && !asset.uploading && (
                      <div className="absolute bottom-1 left-1 bg-[#7C3AED] rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                        <span className="text-[9px] text-white font-medium">AI</span>
                      </div>
                    )}

                    {/* Remove button */}
                    {!asset.uploading && (
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI attributes preview (first image with AI data) */}
            {(() => {
              const withAI = assets.find(a => a.aiAttributes)
              if (!withAI) return null
              const ai = withAI.aiAttributes!
              return (
                <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                    <span className="text-[12px] font-semibold text-[#7C3AED]">AI Analysis</span>
                  </div>
                  {ai['detailed_caption'] && (
                    <p className="text-[12px] text-[#374151]">
                      <span className="font-medium">Caption: </span>{ai['detailed_caption']}
                    </p>
                  )}
                  {ai['ocr'] && (
                    <p className="text-[12px] text-[#374151]">
                      <span className="font-medium">Text detected: </span>{ai['ocr']}
                    </p>
                  )}
                  {ai['object_detection'] && (
                    <p className="text-[12px] text-[#374151]">
                      <span className="font-medium">Objects: </span>{ai['object_detection']}
                    </p>
                  )}
                </div>
              )
            })()}

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}
          </>
        )}
      </div>

      {/* Footer buttons */}
      <div className="px-4 pb-8 pt-4 border-t border-[#E5E7EB]">
        {step === 1 && (
          <button
            onClick={() => setStep(2)}
            disabled={!form.title || !form.categoryId}
            className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {step === 2 && (
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 h-12 border border-[#D1D5DB] text-[#374151] rounded-xl text-[15px] font-medium">
              Back
            </button>
            <button
              onClick={createDraft}
              disabled={loading || !form.priceExpectation}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/listings/${listingId}`)}
              className="flex-1 h-12 border border-[#D1D5DB] text-[#374151] rounded-xl text-[15px] font-medium"
            >
              Save Draft
            </button>
            <button
              onClick={publish}
              disabled={!canPublish || publishing}
              className="flex-1 h-12 bg-[#16A34A] hover:bg-[#15803d] disabled:bg-[#86EFAC] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
