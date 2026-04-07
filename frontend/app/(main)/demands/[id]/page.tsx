'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, MapPin, Loader2, Target, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  active:          'bg-[#DCFCE7] text-[#16A34A]',
  matched:         'bg-[#EFF6FF] text-[#2563EB]',
  in_conversation: 'bg-[#FEF3C7] text-[#D97706]',
  fulfilled:       'bg-[#F0FDF4] text-[#16A34A]',
  expired:         'bg-[#FEF2F2] text-[#DC2626]',
  cancelled:       'bg-[#F3F4F6] text-[#9CA3AF]',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'text-[#16A34A]',
  medium: 'text-[#D97706]',
  low:    'text-[#DC2626]',
}

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [demand,      setDemand]      = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [cancelling,  setCancelling]  = useState(false)
  const [removing,    setRemoving]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch(`/api/proxy/demands/${id}`).then(r => r.json()).then(setDemand).finally(() => setLoading(false))
  }, [id])

  async function handleCancel() {
    setCancelling(true)
    try {
      await fetch(`/api/proxy/demands/${id}`, { method: 'DELETE' })
      router.push('/demands')
    } finally {
      setCancelling(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetch(`/api/proxy/demands/${id}`, { method: 'DELETE' })
      router.push('/demands')
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

  if (!demand) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <p className="text-[#6B7280] mb-4">Demand not found.</p>
      <Link href="/demands" className="text-[#2563EB] text-[14px]">Go back</Link>
    </div>
  )

  const matches = demand.matches ?? []

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/demands" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[18px] font-semibold text-[#111827] flex-1 truncate">{demand.title}</h1>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[demand.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
          {demand.status.replace(/_/g, ' ')}
        </span>
        {!['cancelled', 'fulfilled', 'expired'].includes(demand.status) && (
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
                <p className="text-[15px] font-semibold text-[#111827]">Cancel this demand?</p>
                <p className="text-[13px] text-[#6B7280]">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 border border-[#D1D5DB] text-[#374151] rounded-xl text-[14px] font-medium"
              >
                Keep
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 h-11 bg-[#DC2626] hover:bg-[#b91c1c] disabled:bg-[#FCA5A5] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Demand'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 space-y-6">
        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Budget</span>
            <span className="font-semibold text-[#111827]">
              {Number(demand.budgetMin).toLocaleString()} – {Number(demand.budgetMax).toLocaleString()} ₫
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Condition</span>
            <span className="font-medium text-[#111827]">{(demand.preferredCondition ?? 'any').replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Quantity</span>
            <span className="font-medium text-[#111827]">{demand.quantityNeeded}</span>
          </div>
          {demand.location && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#4B5563]">Location</span>
              <span className="font-medium text-[#111827] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{demand.location}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Urgency</span>
            <span className="font-medium text-[#111827]">{demand.urgency.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#4B5563]">Expires</span>
            <span className="font-medium text-[#111827] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(demand.expiresAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {demand.description && (
          <div>
            <p className="text-[13px] font-medium text-[#374151] mb-1">Description</p>
            <p className="text-[14px] text-[#4B5563] leading-relaxed">{demand.description}</p>
          </div>
        )}

        {/* Matches */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Matches ({matches.length})
            </h2>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-10 text-center">
              <p className="text-[14px] text-[#4B5563]">No matches yet. We&apos;ll notify you when sellers are found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((m: any) => (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#2563EB] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[14px] font-semibold text-[#111827]">Match #{m.id.slice(0, 8)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[12px] font-bold ${CONFIDENCE_COLOR[m.matchConfidence]}`}>
                          {m.matchScore}%
                        </span>
                        <span className="text-[11px] text-[#6B7280] capitalize">{m.matchConfidence}</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#F3F4F6] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-[#2563EB]"
                        style={{ width: `${m.matchScore}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Cancel */}
        {['active', 'waiting', 'matched'].includes(demand.status) && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full h-11 border border-[#DC2626] text-[#DC2626] rounded-xl text-[14px] font-medium hover:bg-[#FEF2F2] transition-colors"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Demand'}
          </button>
        )}
      </div>
    </div>
  )
}
