'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Clock, Loader2, ImageIcon, Target } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  draft:           'bg-[#F3F4F6] text-[#6B7280]',
  active:          'bg-[#DCFCE7] text-[#16A34A]',
  matched:         'bg-[#EFF6FF] text-[#2563EB]',
  in_conversation: 'bg-[#FEF3C7] text-[#D97706]',
  partially_sold:  'bg-[#FEF9C3] text-[#CA8A04]',
  sold:            'bg-[#F0FDF4] text-[#16A34A]',
  expired:         'bg-[#FEF2F2] text-[#DC2626]',
  removed:         'bg-[#F3F4F6] text-[#9CA3AF]',
}

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/proxy/listings').then(r => r.json()).then(d => {
      setListings(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-[20px] font-semibold text-[#111827]">My Listings</h1>
        <Link
          href="/listings/new"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </Link>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-16 text-center">
            <p className="text-[16px] font-semibold text-[#111827] mb-2">No listings yet</p>
            <p className="text-[14px] text-[#4B5563] mb-6">
              List items you want to sell and get matched with buyers automatically.
            </p>
            <Link
              href="/listings/new"
              className="inline-flex items-center gap-2 h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl px-6 text-[14px] font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Listing
            </Link>
          </div>
        )}

        {listings.map(l => (
          <Link key={l.id} href={`/listings/${l.id}`}>
            <div className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#2563EB] transition-colors flex gap-4">
              <div className="w-16 h-16 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                {l.proofAssets?.[0]?.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.proofAssets[0].fileUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-[#D1D5DB]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-[15px] font-semibold text-[#111827] line-clamp-1">{l.title}</h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[l.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {l.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-[#2563EB] mb-1">
                  {Number(l.priceExpectation).toLocaleString()} ₫
                </p>
                <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                  <span>Proof: {l.proofCompletenessScore}%</span>
                  {(l.matches?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1 bg-[#EFF6FF] text-[#2563EB] px-1.5 py-0.5 rounded-full text-[11px] font-semibold">
                      <Target className="w-3 h-3" />
                      {l.matches.length} match{l.matches.length > 1 ? 'es' : ''}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(l.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
