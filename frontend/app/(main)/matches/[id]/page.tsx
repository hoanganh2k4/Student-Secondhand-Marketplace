'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, CheckCircle, XCircle, MessageSquare, Clock } from 'lucide-react'

const SCORE_LABELS: Record<string, string> = {
  category:   'Category match',
  budget:     'Budget overlap',
  condition:  'Condition',
  location:   'Location',
  quantity:   'Quantity',
  aiSemantic: 'AI semantic',
  textScore:  'Text similarity',
  finalScore: 'Final score',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   'bg-[#DCFCE7] text-[#16A34A]',
  medium: 'bg-[#FEF3C7] text-[#D97706]',
  low:    'bg-[#FEF2F2] text-[#DC2626]',
}

const STATUS_COLOR: Record<string, string> = {
  proposed:         'bg-[#F3F4F6] text-[#6B7280]',
  buyer_confirmed:  'bg-[#EFF6FF] text-[#2563EB]',
  seller_confirmed: 'bg-[#EFF6FF] text-[#2563EB]',
  active:           'bg-[#DCFCE7] text-[#16A34A]',
  closed_success:   'bg-[#F0FDF4] text-[#16A34A]',
  closed_failed:    'bg-[#FEF2F2] text-[#DC2626]',
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router   = useRouter()
  const [match,   setMatch]   = useState<any>(null)
  const [myId,    setMyId]    = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(false)

  async function load() {
    const [matchRes, meRes] = await Promise.all([
      fetch(`/api/proxy/matches/${id}`),
      fetch('/api/proxy/auth/me'),
    ])
    if (matchRes.ok) setMatch(await matchRes.json())
    if (meRes.ok) { const me = await meRes.json(); setMyId(me.id) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function act(action: 'acknowledge' | 'decline') {
    setActing(true)
    try {
      const res = await fetch(`/api/proxy/matches/${id}/${action}`, { method: 'POST' })
      if (res.ok) {
        if (action === 'decline') {
          router.push('/demands')
        } else {
          await load()
        }
      }
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )
  if (!match) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <p className="text-[#6B7280] mb-4">Match not found.</p>
      <Link href="/" className="text-[#2563EB] text-[14px]">Go home</Link>
    </div>
  )

  const rawBreakdown: Record<string, unknown> = match.scoreBreakdown ?? {}
  // Keep only numeric entries — skip nested objects like { penalties: {...} }
  const breakdown: Record<string, number> = Object.fromEntries(
    Object.entries(rawBreakdown).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  )
  const demand  = match.demandRequest
  const listing = match.productListing

  const buyerUserId  = demand?.buyerProfile?.userId
  const sellerUserId = listing?.sellerProfile?.userId
  const iAmBuyer  = myId === buyerUserId
  const iAmSeller = myId === sellerUserId

  const iHaveAcknowledged = iAmBuyer
    ? match.buyerAcknowledged
    : iAmSeller
      ? match.sellerAcknowledged
      : false

  const hasConversation    = !!match.conversation
  const canStillAct = ['proposed', 'buyer_confirmed', 'seller_confirmed'].includes(match.status) && !hasConversation

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[18px] font-semibold text-[#111827] flex-1">Match Details</h1>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[match.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
          {match.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Score overview */}
        <div className="rounded-2xl bg-[#EFF6FF] p-5 text-center">
          <div className="text-[48px] font-bold text-[#2563EB] leading-none mb-1">{match.matchScore}%</div>
          <span className={`inline-block text-[12px] font-medium px-3 py-1 rounded-full ${CONFIDENCE_STYLE[match.matchConfidence] ?? ''}`}>
            {match.matchConfidence} confidence
          </span>
        </div>

        {/* Acknowledgement status */}
        {canStillAct && (
          <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 space-y-2">
            <p className="text-[13px] font-medium text-[#374151]">Acceptance status</p>
            <div className="flex gap-4 text-[13px]">
              <span className={match.buyerAcknowledged ? 'text-[#16A34A] font-medium' : 'text-[#9CA3AF]'}>
                {match.buyerAcknowledged ? '✓' : '○'} Buyer
              </span>
              <span className={match.sellerAcknowledged ? 'text-[#16A34A] font-medium' : 'text-[#9CA3AF]'}>
                {match.sellerAcknowledged ? '✓' : '○'} Seller
              </span>
            </div>
          </div>
        )}

        {/* Score breakdown */}
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827] mb-3">Score Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(breakdown).filter(([k]) => k !== 'total').map(([key, val]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="text-[#4B5563]">{SCORE_LABELS[key] ?? key}</span>
                  <span className="font-semibold text-[#111827]">{val}%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                  <div className="h-2 rounded-full bg-[#2563EB] transition-all" style={{ width: `${Math.min(100, val)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demand summary */}
        {demand && (
          <div className="rounded-xl border border-[#E5E7EB] p-4">
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">Demand</p>
            <p className="text-[15px] font-semibold text-[#111827] mb-1">{demand.title}</p>
            <p className="text-[13px] text-[#4B5563]">
              Budget: {Number(demand.budgetMin).toLocaleString()} – {Number(demand.budgetMax).toLocaleString()} ₫
            </p>
          </div>
        )}

        {/* Listing summary */}
        {listing && (
          <div className="rounded-xl border border-[#E5E7EB] p-4">
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">Listing</p>
            <p className="text-[15px] font-semibold text-[#111827] mb-1">{listing.title}</p>
            <p className="text-[13px] text-[#4B5563]">
              Price: {Number(listing.priceExpectation).toLocaleString()} ₫ · {listing.condition?.replace('_', ' ')}
            </p>
          </div>
        )}

        {/* Missing flags */}
        {match.missingInfoFlags?.length > 0 && (
          <div className="rounded-xl bg-[#FEF9C3] p-4">
            <p className="text-[13px] font-medium text-[#CA8A04] mb-2">Missing information</p>
            <ul className="space-y-1">
              {match.missingInfoFlags.map((f: string) => (
                <li key={f} className="text-[13px] text-[#92400E]">• {f.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {hasConversation && match.conversation?.id && (
          <Link href={`/conversations/${match.conversation.id}`}>
            <div className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors">
              <MessageSquare className="w-5 h-5" />
              Open Conversation
            </div>
          </Link>
        )}

        {/* Already accepted — waiting for other side */}
        {canStillAct && iHaveAcknowledged && (
          <div className="w-full h-12 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280] text-[14px] flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Đã chấp nhận. Đang chờ bên kia…
          </div>
        )}

        {/* Can accept / decline */}
        {canStillAct && !iHaveAcknowledged && (iAmBuyer || iAmSeller) && (
          <div className="flex gap-3">
            <button
              onClick={() => act('decline')}
              disabled={acting}
              className="flex-1 h-12 border border-[#DC2626] text-[#DC2626] rounded-xl text-[14px] font-medium hover:bg-[#FEF2F2] transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Từ chối
            </button>
            <button
              onClick={() => act('acknowledge')}
              disabled={acting}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Chấp nhận</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
