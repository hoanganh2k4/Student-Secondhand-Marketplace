'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImageIcon, Loader2, Target, CheckCircle, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  draft:   'bg-[#F3F4F6] text-[#6B7280]',
  active:  'bg-[#DCFCE7] text-[#16A34A]',
  expired: 'bg-[#FEF2F2] text-[#DC2626]',
  removed: 'bg-[#F3F4F6] text-[#9CA3AF]',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'text-[#16A34A]',
  medium: 'text-[#D97706]',
  low:    'text-[#DC2626]',
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router   = useRouter()
  const [listing,    setListing]    = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [pubError,   setPubError]   = useState('')
  const [removing,   setRemoving]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch(`/api/proxy/listings/${id}`).then(r => r.json()).then(setListing).finally(() => setLoading(false))
  }, [id])

  async function handlePublish() {
    setPublishing(true)
    setPubError('')
    try {
      const res = await fetch(`/api/proxy/listings/${id}/publish`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setPubError(d.message ?? 'Failed to publish.')
        return
      }
      const updated = await res.json()
      setListing(updated)
    } finally {
      setPublishing(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const res = await fetch(`/api/proxy/listings/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        router.push('/listings')
      }
    } finally {
      setRemoving(false)
      setShowConfirm(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )
  if (!listing) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <p className="text-[#6B7280] mb-4">Listing not found.</p>
      <Link href="/listings" className="text-[#2563EB] text-[14px]">Go back</Link>
    </div>
  )

  const proofScore   = listing.proofCompletenessScore ?? 0
  const canPublish   = listing.status === 'draft' && proofScore >= 60
  const matches      = listing.matches ?? []

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/listings" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[18px] font-semibold text-[#111827] flex-1 truncate">{listing.title}</h1>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[listing.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
          {listing.status}
        </span>
        {listing.status !== 'removed' && (
          <button
            onClick={() => setShowConfirm(true)}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Confirm remove dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-8">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111827]">Remove listing?</p>
                <p className="text-[13px] text-[#6B7280]">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 border border-[#D1D5DB] text-[#374151] rounded-xl text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 h-11 bg-[#DC2626] hover:bg-[#b91c1c] disabled:bg-[#FCA5A5] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 space-y-6">
        {/* Photos */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {listing.proofAssets?.length > 0 ? listing.proofAssets.map((a: any) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a.id} src={a.fileUrl} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
          )) : (
            <div className="w-24 h-24 rounded-xl bg-[#F3F4F6] flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-[#D1D5DB]" />
            </div>
          )}
        </div>

        {/* Proof completeness */}
        <div>
          <div className="flex items-center justify-between text-[13px] mb-1.5">
            <span className="text-[#4B5563] font-medium">Proof Completeness</span>
            <span className={`font-semibold ${proofScore >= 60 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{proofScore}%</span>
          </div>
          <div className="w-full bg-[#F3F4F6] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${proofScore >= 60 ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
              style={{ width: `${proofScore}%` }}
            />
          </div>
          {proofScore < 60 && (
            <p className="text-[12px] text-[#DC2626] mt-1">Upload at least 2 photos to publish.</p>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Price</span>
            <span className="font-semibold text-[#111827]">
              {Number(listing.priceExpectation).toLocaleString()} ₫
              {listing.priceFlexible && <span className="ml-1 text-[11px] text-[#6B7280]">(flexible)</span>}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Condition</span>
            <span className="font-medium text-[#111827]">{listing.condition.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Quantity</span>
            <span className="font-medium text-[#111827]">{listing.quantityRemaining} / {listing.quantityAvailable}</span>
          </div>
          {listing.location && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#4B5563]">Location</span>
              <span className="font-medium text-[#111827]">{listing.location}</span>
            </div>
          )}
        </div>

        {listing.description && (
          <div>
            <p className="text-[13px] font-medium text-[#374151] mb-1">Description</p>
            <p className="text-[14px] text-[#4B5563] leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* Matches */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-[16px] font-semibold text-[#111827]">Matches ({matches.length})</h2>
          </div>
          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-8 text-center">
              <p className="text-[14px] text-[#4B5563]">
                {listing.status === 'draft' ? 'Publish this listing to start getting matches.' : 'No matches yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((m: any) => (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div className="border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB] transition-colors flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[#111827]">Match #{m.id.slice(0, 8)}</span>
                    <span className={`text-[13px] font-bold ${CONFIDENCE_COLOR[m.matchConfidence]}`}>{m.matchScore}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Publish */}
        {listing.status === 'draft' && (
          <div>
            {pubError && <p className="text-[13px] text-[#DC2626] mb-2">{pubError}</p>}
            <button
              onClick={handlePublish}
              disabled={!canPublish || publishing}
              className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {publishing ? 'Publishing…' : 'Publish Listing'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
