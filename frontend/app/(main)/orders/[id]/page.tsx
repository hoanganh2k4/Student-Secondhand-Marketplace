'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle, Star } from 'lucide-react'
import { useOrderSocket } from '@/hooks/useOrderSocket'

const STATUS_STEP: Record<string, number> = {
  created: 0, in_progress: 1, completed: 2, cancelled: -1, disputed: -1,
}

const STATUS_COLOR: Record<string, string> = {
  created:     'bg-[#EFF6FF] text-[#2563EB]',
  in_progress: 'bg-[#FEF3C7] text-[#D97706]',
  completed:   'bg-[#DCFCE7] text-[#16A34A]',
  cancelled:   'bg-[#F3F4F6] text-[#9CA3AF]',
  disputed:    'bg-[#FEF2F2] text-[#DC2626]',
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [order,    setOrder]    = useState<any>(null)
  const [myId,     setMyId]     = useState<string>('')
  const [loading,  setLoading]  = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [rating,   setRating]   = useState(0)
  const [comment,  setComment]  = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [disputeDesc, setDisputeDesc] = useState('')

  async function load() {
    const [orderRes, meRes] = await Promise.all([
      fetch(`/api/proxy/orders/${id}`),
      fetch('/api/proxy/auth/me'),
    ])
    if (orderRes.ok) setOrder(await orderRes.json())
    if (meRes.ok) { const me = await meRes.json(); setMyId(me.id) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Realtime: merge incoming partial update into order state
  useOrderSocket(id ?? null, (updated) => {
    setOrder((prev: any) => prev ? { ...prev, ...updated } : prev)
  })

  async function confirm() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/proxy/orders/${id}/confirm`, { method: 'POST' })
      if (res.ok) await load()
    } finally {
      setConfirming(false)
    }
  }

  async function submitReview() {
    if (!rating) return
    setReviewing(true)
    try {
      const res = await fetch(`/api/proxy/orders/${id}/review`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating, comment }),
      })
      if (res.ok) {
        setShowReview(false)
        await load()
      }
    } finally {
      setReviewing(false)
    }
  }

  async function submitDispute() {
    if (!disputeDesc.trim()) return
    const res = await fetch(`/api/proxy/orders/${id}/dispute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ disputeType: 'other', description: disputeDesc }),
    })
    if (res.ok) {
      setShowDispute(false)
      await load()
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )
  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <p className="text-[#6B7280] mb-4">Order not found.</p>
      <Link href="/orders" className="text-[#2563EB] text-[14px]">Go back</Link>
    </div>
  )

  const stepIdx   = STATUS_STEP[order.status] ?? 0
  const iAmBuyer  = myId === order.buyerUserId
  const iAmSeller = myId === order.sellerUserId
  const iHaveConfirmed = iAmBuyer ? order.buyerConfirmedComplete : order.sellerConfirmedComplete
  const canConfirm = ['created', 'in_progress'].includes(order.status) && !iHaveConfirmed

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/orders" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[18px] font-semibold text-[#111827] flex-1">Order #{id.slice(0, 8)}</h1>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? ''}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Timeline */}
        {order.status !== 'cancelled' && order.status !== 'disputed' && (
          <div className="flex items-center gap-2">
            {['Created', 'In Progress', 'Completed'].map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i <= stepIdx ? 'bg-[#2563EB] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'}`}>
                  {i < stepIdx ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-[11px] ${i === stepIdx ? 'text-[#2563EB] font-medium' : 'text-[#9CA3AF]'}`}>{label}</span>
                {i < 2 && <div className="flex-1 h-px bg-[#E5E7EB] mx-1" />}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="rounded-xl border border-[#E5E7EB] p-4 space-y-2">
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4B5563]">Item</span>
            <span className="font-medium text-[#111827]">{order.match?.productListing?.title ?? '—'}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4B5563]">Quantity</span>
            <span className="font-medium text-[#111827]">{order.quantity}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4B5563]">Total</span>
            <span className="font-bold text-[#111827]">{Number(order.finalPrice).toLocaleString()} ₫</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4B5563]">Fulfillment</span>
            <span className="font-medium text-[#111827]">{order.fulfillmentMethod}</span>
          </div>
          {order.meetupDetails && (
            <div className="flex justify-between text-[13px]">
              <span className="text-[#4B5563]">Meetup</span>
              <span className="font-medium text-[#111827]">{order.meetupDetails}</span>
            </div>
          )}
        </div>

        {/* Confirmation status */}
        {['created', 'in_progress'].includes(order.status) && (
          <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 space-y-2">
            <p className="text-[13px] font-medium text-[#374151]">Xác nhận hoàn thành</p>
            <div className="flex gap-4 text-[13px]">
              <span className={order.buyerConfirmedComplete ? 'text-[#16A34A] font-medium' : 'text-[#9CA3AF]'}>
                {order.buyerConfirmedComplete ? '✓' : '○'} Người mua
              </span>
              <span className={order.sellerConfirmedComplete ? 'text-[#16A34A] font-medium' : 'text-[#9CA3AF]'}>
                {order.sellerConfirmedComplete ? '✓' : '○'} Người bán
              </span>
            </div>
            {iHaveConfirmed && (
              <p className="text-[12px] text-[#16A34A]">Bạn đã xác nhận. Đang chờ phía còn lại xác nhận…</p>
            )}
          </div>
        )}

        {/* Existing reviews */}
        {order.ratingReviews?.length > 0 && (
          <div>
            <p className="text-[14px] font-semibold text-[#111827] mb-2">Reviews</p>
            {order.ratingReviews.map((r: any) => (
              <div key={r.id} className="border border-[#E5E7EB] rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                    ))}
                  </div>
                  <span className="text-[12px] text-[#6B7280] capitalize">{r.roleOfReviewer}</span>
                </div>
                {r.comment && <p className="text-[13px] text-[#4B5563]">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Review form */}
        {showReview && (
          <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-3">
            <p className="text-[14px] font-semibold text-[#111827]">Leave a Review</p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} onClick={() => setRating(i + 1)}>
                  <Star className={`w-7 h-7 ${i < rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder="Write a comment (optional)…"
              className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReview(false)} className="flex-1 py-2 border border-[#D1D5DB] rounded-xl text-[14px] text-[#374151]">
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={!rating || reviewing}
                className="flex-1 py-2 bg-[#2563EB] text-white rounded-xl text-[14px] font-semibold disabled:bg-[#93C5FD]"
              >
                {reviewing ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* Dispute form */}
        {showDispute && (
          <div className="border border-[#FCA5A5] rounded-xl p-4 space-y-3 bg-[#FEF2F2]">
            <p className="text-[14px] font-semibold text-[#DC2626]">File a Dispute</p>
            <textarea
              rows={3}
              placeholder="Describe the issue…"
              className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              value={disputeDesc}
              onChange={e => setDisputeDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowDispute(false)} className="flex-1 py-2 border border-[#D1D5DB] rounded-xl text-[14px] text-[#374151] bg-white">
                Cancel
              </button>
              <button
                onClick={submitDispute}
                disabled={!disputeDesc.trim()}
                className="flex-1 py-2 bg-[#DC2626] text-white rounded-xl text-[14px] font-semibold disabled:bg-[#FCA5A5]"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {canConfirm && (
            <button
              onClick={confirm}
              disabled={confirming}
              className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {confirming ? 'Đang xác nhận…' : 'Xác nhận hoàn thành'}
            </button>
          )}

          {order.status === 'completed' && !showReview && order.ratingReviews?.length === 0 && (
            <button
              onClick={() => setShowReview(true)}
              className="w-full h-12 border border-[#F59E0B] text-[#D97706] hover:bg-[#FFFBEB] rounded-xl text-[15px] font-medium flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4" /> Leave a Review
            </button>
          )}

          {order.status === 'completed' && !showDispute && !order.dispute && (
            <button
              onClick={() => setShowDispute(true)}
              className="w-full h-12 border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl text-[14px] font-medium flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> File a Dispute
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
