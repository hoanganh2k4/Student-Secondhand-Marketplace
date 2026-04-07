'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Clock, Loader2, Target } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  active:          'bg-[#DCFCE7] text-[#16A34A]',
  draft:           'bg-[#F3F4F6] text-[#6B7280]',
  matched:         'bg-[#EFF6FF] text-[#2563EB]',
  in_conversation: 'bg-[#FEF3C7] text-[#D97706]',
  fulfilled:       'bg-[#F0FDF4] text-[#16A34A]',
  expired:         'bg-[#FEF2F2] text-[#DC2626]',
  cancelled:       'bg-[#F3F4F6] text-[#9CA3AF]',
}

export default function DemandsPage() {
  const [demands, setDemands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proxy/demands').then(r => r.json()).then(d => {
      setDemands(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-[20px] font-semibold text-[#111827]">My Demands</h1>
        <Link
          href="/demands/new"
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

        {!loading && demands.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-16 text-center">
            <p className="text-[16px] font-semibold text-[#111827] mb-2">No demands yet</p>
            <p className="text-[14px] text-[#4B5563] mb-6">
              Post what you&apos;re looking for and get matched with sellers automatically.
            </p>
            <Link
              href="/demands/new"
              className="inline-flex items-center gap-2 h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl px-6 text-[14px] font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Post a Demand
            </Link>
          </div>
        )}

        {demands.map(d => (
          <Link key={d.id} href={`/demands/${d.id}`}>
            <div className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#2563EB] transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-semibold text-[#111827] line-clamp-1">{d.title}</h3>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[d.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[13px] text-[#4B5563] mb-3 line-clamp-2">{d.description ?? 'No description'}</p>
              <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                <span>Budget: {Number(d.budgetMin).toLocaleString()} – {Number(d.budgetMax).toLocaleString()} ₫</span>
                <div className="flex items-center gap-2">
                  {(d.matches?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1 bg-[#EFF6FF] text-[#2563EB] px-1.5 py-0.5 rounded-full text-[11px] font-semibold">
                      <Target className="w-3 h-3" />
                      {d.matches.length}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(d.expiresAt).toLocaleDateString()}
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
