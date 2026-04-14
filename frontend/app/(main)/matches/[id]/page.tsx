'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, CheckCircle, XCircle, MessageSquare, Clock, TrendingUp, Eye, ImageIcon, Brain } from 'lucide-react'

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

function pct(val: number | null | undefined): number {
  if (val == null) return 0
  return val <= 1 ? Math.round(val * 100) : Math.round(val)
}

function ScoreBar({ label, value, color = '#2563EB', note }: {
  label: string; value: number; color?: string; note?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="text-[#4B5563]">{label}</span>
        <div className="flex items-center gap-2">
          {note && <span className="text-[11px] text-[#9CA3AF]">{note}</span>}
          <span className="font-semibold text-[#111827]">{value}%</span>
        </div>
      </div>
      <div className="w-full bg-[#F3F4F6] rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function StatBadge({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0 text-[13px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className={`font-medium ${ok === true ? 'text-[#16A34A]' : ok === false ? 'text-[#DC2626]' : 'text-[#111827]'}`}>
        {value}
      </span>
    </div>
  )
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [match,    setMatch]    = useState<any>(null)
  const [snapshot, setSnapshot] = useState<any>(null)
  const [myId,     setMyId]     = useState<string>('')
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState(false)

  async function load() {
    const [matchRes, meRes] = await Promise.all([
      fetch(`/api/proxy/matches/${id}`),
      fetch('/api/proxy/auth/me'),
    ])
    if (matchRes.ok) {
      const m = await matchRes.json()
      setMatch(m)
      // fetch snapshot in parallel (non-blocking)
      fetch(`/api/proxy/matches/${id}/snapshot`)
        .then(r => r.ok ? r.json() : null)
        .then(s => setSnapshot(s))
        .catch(() => null)
    }
    if (meRes.ok) { const me = await meRes.json(); setMyId(me.id) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function act(action: 'acknowledge' | 'decline') {
    setActing(true)
    try {
      const res = await fetch(`/api/proxy/matches/${id}/${action}`, { method: 'POST' })
      if (res.ok) {
        if (action === 'decline') router.push('/demands')
        else await load()
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

  const demand  = match.demandRequest
  const listing = match.productListing
  const iAmBuyer  = myId === demand?.buyerProfile?.userId
  const iAmSeller = myId === listing?.sellerProfile?.userId
  const iHaveAcknowledged = iAmBuyer ? match.buyerAcknowledged : iAmSeller ? match.sellerAcknowledged : false
  const hasConversation   = !!match.conversation
  const canStillAct = ['proposed', 'buyer_confirmed', 'seller_confirmed'].includes(match.status) && !hasConversation

  // Snapshot-derived values
  const fv       = snapshot?.featureVector ?? {}
  const penalties = snapshot?.penaltiesApplied ?? (match.scoreBreakdown?.penalties ?? {})
  const hasPenalty = Object.keys(penalties).length > 0
  const textScore  = snapshot?.textScore  ?? match.scoreBreakdown?.textScore
  const finalScore = snapshot?.finalScore ?? match.scoreBreakdown?.finalScore

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[18px] font-semibold text-[#111827] flex-1">Match Details</h1>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[match.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
          {match.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* ── Score overview ── */}
        <div className="rounded-2xl bg-[#EFF6FF] p-5 text-center">
          <div className="text-[52px] font-bold text-[#2563EB] leading-none mb-2">{match.matchScore}%</div>
          <span className={`inline-block text-[12px] font-medium px-3 py-1 rounded-full ${CONFIDENCE_STYLE[match.matchConfidence] ?? ''}`}>
            {match.matchConfidence} confidence
          </span>
          {snapshot && (
            <p className="text-[11px] text-[#6B7280] mt-2">
              Rank #{snapshot.rankPosition} / {snapshot.candidateSetSize} candidate{snapshot.candidateSetSize !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Acknowledgement ── */}
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

        {/* ── AI Score section ── */}
        <div className="rounded-xl border border-[#E5E7EB] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#6366F1]" />
            <h2 className="text-[14px] font-semibold text-[#111827]">AI Scoring</h2>
          </div>

          <ScoreBar
            label="Text similarity"
            value={pct(textScore)}
            note="SentenceTransformer"
          />

          {snapshot?.visualScore != null && (
            <ScoreBar
              label="Visual similarity"
              value={pct(snapshot.visualScore)}
              color="#8B5CF6"
              note="CLIP"
            />
          )}

          {hasPenalty && (
            <ScoreBar
              label="Final score (after penalties)"
              value={pct(finalScore)}
              color={pct(finalScore) >= 70 ? '#16A34A' : pct(finalScore) >= 50 ? '#D97706' : '#DC2626'}
            />
          )}

          {hasPenalty && (
            <div className="rounded-lg bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E] space-y-1">
              <p className="font-medium">Penalties applied:</p>
              {Object.entries(penalties).map(([k, v]: any) => (
                <p key={k}>• {k}: ×{v} ({Math.round((1 - v) * 100)}% reduction)</p>
              ))}
            </div>
          )}
        </div>

        {/* ── Feature breakdown ── */}
        {snapshot && (
          <div className="rounded-xl border border-[#E5E7EB] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-[14px] font-semibold text-[#111827]">Match Features</h2>
            </div>

            {/* Price */}
            {fv.priceRatio != null && (
              <ScoreBar
                label="Price fit"
                value={Math.min(100, Math.round((2 - fv.priceRatio) * 100))}
                color={fv.priceRatio <= 1 ? '#16A34A' : '#DC2626'}
                note={`${Math.round(fv.priceRatio * 100)}% of budget`}
              />
            )}

            {/* Condition */}
            {fv.conditionMatch != null && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#4B5563]">Condition match</span>
                <span className={`font-medium px-2 py-0.5 rounded-full text-[11px] ${fv.conditionMatch ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
                  {fv.conditionMatch ? '✓ Meets requirement' : `${Math.abs(fv.conditionGap ?? 0)} tier${Math.abs(fv.conditionGap ?? 0) !== 1 ? 's' : ''} below`}
                </span>
              </div>
            )}

            {/* Image / Vision */}
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#6B7280]" />
              <div className="flex gap-3 text-[13px]">
                <span className={fv.hasImage ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}>
                  {fv.hasImage ? '✓' : '○'} {snapshot.listingSnapshot?.imageCount ?? 0} image{(snapshot.listingSnapshot?.imageCount ?? 0) !== 1 ? 's' : ''}
                </span>
                <span className={fv.hasVision ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}>
                  {fv.hasVision ? '✓' : '○'} AI vision
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Demand vs Listing comparison ── */}
        {snapshot ? (
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[#E5E7EB]">
              <div className="p-4">
                <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-3">Demand</p>
                <p className="text-[14px] font-semibold text-[#111827] mb-2">{snapshot.demandSnapshot?.title}</p>
                <div className="space-y-1">
                  {snapshot.demandSnapshot?.budgetMax != null && (
                    <p className="text-[12px] text-[#4B5563]">Budget: {(snapshot.demandSnapshot.budgetMax / 1_000_000).toFixed(0)}M ₫</p>
                  )}
                  {snapshot.demandSnapshot?.preferredCondition && (
                    <p className="text-[12px] text-[#4B5563]">Min: {snapshot.demandSnapshot.preferredCondition.replace(/_/g, ' ')}</p>
                  )}
                  {snapshot.demandSnapshot?.location && (
                    <p className="text-[12px] text-[#4B5563]">{snapshot.demandSnapshot.location}</p>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-3">Listing</p>
                <p className="text-[14px] font-semibold text-[#111827] mb-2">{snapshot.listingSnapshot?.title}</p>
                <div className="space-y-1">
                  {snapshot.listingSnapshot?.price != null && (
                    <p className="text-[12px] text-[#4B5563]">Price: {(snapshot.listingSnapshot.price / 1_000_000).toFixed(0)}M ₫</p>
                  )}
                  {snapshot.listingSnapshot?.condition && (
                    <p className="text-[12px] text-[#4B5563]">{snapshot.listingSnapshot.condition.replace(/_/g, ' ')}</p>
                  )}
                  {snapshot.listingSnapshot?.location && (
                    <p className="text-[12px] text-[#4B5563]">{snapshot.listingSnapshot.location}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {demand && (
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">Demand</p>
                <p className="text-[15px] font-semibold text-[#111827] mb-1">{demand.title}</p>
                <p className="text-[13px] text-[#4B5563]">
                  Budget: {Number(demand.budgetMin).toLocaleString()} – {Number(demand.budgetMax).toLocaleString()} ₫
                </p>
              </div>
            )}
            {listing && (
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">Listing</p>
                <p className="text-[15px] font-semibold text-[#111827] mb-1">{listing.title}</p>
                <p className="text-[13px] text-[#4B5563]">
                  Price: {Number(listing.priceExpectation).toLocaleString()} ₫ · {listing.condition?.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Snapshot meta ── */}
        {snapshot && (
          <div className="rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-[#6B7280]" />
              <h2 className="text-[14px] font-semibold text-[#111827]">Model Info</h2>
            </div>
            <StatBadge label="Model version" value={snapshot.modelVersion} />
            <StatBadge label="Rank in run" value={`#${snapshot.rankPosition} of ${snapshot.candidateSetSize}`} />
            <StatBadge label="Has images" value={fv.hasImage ? 'Yes' : 'No'} ok={!!fv.hasImage} />
            <StatBadge label="AI vision extracted" value={fv.hasVision ? 'Yes' : 'No'} ok={!!fv.hasVision} />
            <StatBadge label="Budget provided" value={fv.hasBudget ? 'Yes' : 'No'} ok={!!fv.hasBudget} />
            <StatBadge label="Condition preference" value={fv.hasConditionPref ? 'Yes' : 'No'} ok={!!fv.hasConditionPref} />
          </div>
        )}

        {/* ── Missing flags ── */}
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

        {/* ── Actions ── */}
        {hasConversation && match.conversation?.id && (
          <Link href={`/conversations/${match.conversation.id}`}>
            <div className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors">
              <MessageSquare className="w-5 h-5" />
              Open Conversation
            </div>
          </Link>
        )}

        {canStillAct && iHaveAcknowledged && (
          <div className="w-full h-12 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280] text-[14px] flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Accepted. Waiting for the other party…
          </div>
        )}

        {canStillAct && !iHaveAcknowledged && (iAmBuyer || iAmSeller) && (
          <div className="flex gap-3">
            <button
              onClick={() => act('decline')}
              disabled={acting}
              className="flex-1 h-12 border border-[#DC2626] text-[#DC2626] rounded-xl text-[14px] font-medium hover:bg-[#FEF2F2] transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Decline
            </button>
            <button
              onClick={() => act('acknowledge')}
              disabled={acting}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Accept</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
