'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Loader2, Clock } from 'lucide-react'

const STAGE_COLOR: Record<string, string> = {
  verification:  'bg-[#EFF6FF] text-[#2563EB]',
  clarification: 'bg-[#FEF3C7] text-[#D97706]',
  negotiation:   'bg-[#F0FDF4] text-[#16A34A]',
  closed:        'bg-[#F3F4F6] text-[#9CA3AF]',
}

export default function ConversationsPage() {
  const [convs,   setConvs]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proxy/conversations').then(r => r.json()).then(d => {
      setConvs(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 z-10">
        <h1 className="text-[20px] font-semibold text-[#111827]">Conversations</h1>
      </div>

      <div className="px-4 py-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        )}

        {!loading && convs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-16 text-center">
            <MessageSquare className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[16px] font-semibold text-[#111827] mb-2">No conversations yet</p>
            <p className="text-[14px] text-[#4B5563]">Accept a match to start a conversation.</p>
          </div>
        )}

        {convs.map(c => {
          const lastMsg  = c.messages?.[0]
          const demandTitle  = c.match?.demandRequest?.title  ?? 'Demand'
          const listingTitle = c.match?.productListing?.title ?? 'Listing'

          return (
            <Link key={c.id} href={`/conversations/${c.id}`}>
              <div className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#2563EB] transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111827] truncate">{demandTitle}</p>
                    <p className="text-[12px] text-[#6B7280] truncate">↔ {listingTitle}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLOR[c.stage] ?? ''}`}>
                    {c.stage}
                  </span>
                </div>
                {lastMsg && (
                  <p className="text-[13px] text-[#4B5563] line-clamp-1 mt-1">{lastMsg.body}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[11px] font-medium ${c.status === 'closed' ? 'text-[#9CA3AF]' : 'text-[#16A34A]'}`}>
                    {c.status}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(c.lastActivityAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
