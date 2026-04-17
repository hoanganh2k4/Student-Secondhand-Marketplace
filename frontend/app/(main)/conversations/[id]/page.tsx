'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Send, Loader2, ShoppingBag,
  CheckCircle2, XCircle, Paperclip, X, Play,
} from 'lucide-react'
import { useConversationSocket } from '@/hooks/useConversationSocket'

const STAGE_STEPS = ['verification', 'clarification', 'negotiation']

const STAGE_COLOR: Record<string, string> = {
  verification:  'bg-[#EFF6FF] text-[#2563EB]',
  clarification: 'bg-[#FEF3C7] text-[#D97706]',
  negotiation:   'bg-[#DCFCE7] text-[#16A34A]',
  closed:        'bg-[#F3F4F6] text-[#9CA3AF]',
}

interface PendingMedia { file: File; preview: string; type: 'image' | 'video' }

interface SellerForm  { price: string; quantity: string }
interface BuyerForm   { phone: string; email: string; deliveryAddress: string; fulfillmentMethod: string }

// ── Order-request card rendered inside the message list ─────────────────────
function OrderRequestCard({
  orderRequest,
  myUserId,
  iAmSeller,         // true = I am the seller, false = I am the buyer
  onAccept,
  onReject,
  onSellerFill,
  onBuyerFill,
}: {
  orderRequest: any
  myUserId: string
  iAmSeller: boolean
  onAccept: () => void
  onReject: () => void
  onSellerFill: (f: SellerForm) => Promise<void>
  onBuyerFill:  (f: BuyerForm)  => Promise<void>
}
) {
  const iAmInitiator = myUserId === orderRequest.initiatedByUserId
  const [sellerForm, setSellerForm] = useState<SellerForm>({ price: '', quantity: String(orderRequest.quantity ?? 1) })
  const [buyerForm,  setBuyerForm]  = useState<BuyerForm>({
    phone: '', email: '', deliveryAddress: '', fulfillmentMethod: 'delivery',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)

  const status = orderRequest.status as string

  async function handleSellerSubmit() {
    if (!sellerForm.price || submitting) return
    setFormError(null)
    setSubmitting(true)
    try { await onSellerFill(sellerForm) }
    catch (e: any) { setFormError(e?.message ?? 'Something went wrong.') }
    finally { setSubmitting(false) }
  }

  async function handleBuyerSubmit() {
    if (!buyerForm.phone || !buyerForm.email || !buyerForm.deliveryAddress || submitting) return
    setFormError(null)
    setSubmitting(true)
    try { await onBuyerFill(buyerForm) }
    catch (e: any) { setFormError(e?.message ?? 'Something went wrong.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="my-2 mx-auto w-full max-w-sm border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="bg-[#2563EB] px-4 py-2.5 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-white" />
        <span className="text-[13px] font-semibold text-white">Order Request</span>
        <span className="ml-auto text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full capitalize">
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* ── PENDING ────────────────────────────────────────────── */}
        {status === 'pending' && iAmInitiator && (
          <p className="text-[13px] text-[#6B7280] text-center py-1">Waiting for the other party to respond…</p>
        )}
        {status === 'pending' && !iAmInitiator && (
          <>
            <p className="text-[13px] text-[#374151]">The other party wants to create an order. Do you accept?</p>
            <div className="flex gap-2">
              <button onClick={onReject}
                className="flex-1 py-2 border border-[#DC2626] text-[#DC2626] rounded-xl text-[13px] font-medium flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={onAccept}
                className="flex-1 py-2 bg-[#16A34A] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Accept
              </button>
            </div>
          </>
        )}

        {/* ── REJECTED ────────────────────────────────────────────── */}
        {status === 'rejected' && (
          <p className="text-[13px] text-[#DC2626] text-center">Order request was rejected.</p>
        )}

        {/* ── SELLER fills price (accepted or buyer already filled) ── */}
        {iAmSeller && (status === 'accepted' || status === 'buyer_filled') && (
          <>
            <p className="text-[13px] text-[#374151] font-medium">Set selling price:</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-[#6B7280]">Price (₫) *</label>
                <input type="number" placeholder="0"
                  className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  value={sellerForm.price}
                  onChange={e => setSellerForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="w-20">
                <label className="text-[11px] text-[#6B7280]">Quantity</label>
                <input type="number" min="1"
                  className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  value={sellerForm.quantity}
                  onChange={e => setSellerForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            {sellerForm.price && (
              <p className="text-[13px] text-[#374151]">
                Total: {(Number(sellerForm.price) * Number(sellerForm.quantity)).toLocaleString()} ₫
              </p>
            )}
            {formError && <p className="text-[12px] text-[#DC2626]">{formError}</p>}
            <button onClick={handleSellerSubmit} disabled={!sellerForm.price || submitting}
              className="w-full py-2 bg-[#2563EB] text-white rounded-xl text-[13px] font-semibold disabled:bg-[#93C5FD] flex items-center justify-center">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Price'}
            </button>
          </>
        )}

        {/* Seller filled, waiting for buyer */}
        {iAmSeller && status === 'seller_filled' && (
          <p className="text-[13px] text-[#6B7280] text-center py-1">Price confirmed. Waiting for buyer to fill in delivery details…</p>
        )}

        {/* ── BUYER fills delivery info (accepted or seller already filled) ── */}
        {!iAmSeller && (status === 'accepted' || status === 'seller_filled') && (
          <>
            <p className="text-[13px] text-[#374151] font-medium">Enter delivery information:</p>
            {orderRequest.price && (
              <p className="text-[13px] font-semibold text-[#2563EB]">
                Price: {Number(orderRequest.price).toLocaleString()} ₫ × {orderRequest.quantity ?? 1} = {(Number(orderRequest.price) * (orderRequest.quantity ?? 1)).toLocaleString()} ₫
              </p>
            )}
            <input type="tel" placeholder="Phone number *"
              className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              value={buyerForm.phone} onChange={e => setBuyerForm(f => ({ ...f, phone: e.target.value }))} />
            <input type="email" placeholder="Email *"
              className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              value={buyerForm.email} onChange={e => setBuyerForm(f => ({ ...f, email: e.target.value }))} />
            <input type="text" placeholder="Delivery address *"
              className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              value={buyerForm.deliveryAddress} onChange={e => setBuyerForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
            <select className="w-full border border-[#D1D5DB] rounded-xl px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              value={buyerForm.fulfillmentMethod} onChange={e => setBuyerForm(f => ({ ...f, fulfillmentMethod: e.target.value }))}>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
              <option value="flexible">Flexible</option>
            </select>
            {formError && <p className="text-[12px] text-[#DC2626]">{formError}</p>}
            <button onClick={handleBuyerSubmit}
              disabled={!buyerForm.phone || !buyerForm.email || !buyerForm.deliveryAddress || submitting}
              className="w-full py-2 bg-[#2563EB] text-white rounded-xl text-[13px] font-semibold disabled:bg-[#93C5FD] flex items-center justify-center">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Delivery Info'}
            </button>
          </>
        )}

        {/* Buyer filled, waiting for seller */}
        {!iAmSeller && status === 'buyer_filled' && (
          <p className="text-[13px] text-[#6B7280] text-center py-1">Delivery info filled. Waiting for seller to confirm price…</p>
        )}

        {/* ── COMPLETED ────────────────────────────────────────────── */}
        {status === 'completed' && (
          <div className="flex items-center gap-2 text-[#16A34A]">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-[13px] font-semibold">Order created successfully!</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>()
  const router    = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [conv,    setConv]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [myId,    setMyId]    = useState<string>('')
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)

  const [pendingMedia,   setPendingMedia]   = useState<PendingMedia | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [convRes, meRes] = await Promise.all([
      fetch(`/api/proxy/conversations/${id}`),
      fetch('/api/proxy/auth/me'),
    ])
    if (convRes.ok) {
      const fresh = await convRes.json()
      // Merge: keep any WS-pushed messages not yet in the HTTP response
      setConv((prev: any) => {
        if (!prev) return fresh
        const freshIds = new Set((fresh.messages ?? []).map((m: any) => m.id))
        const extra = (prev.messages ?? []).filter((m: any) => !freshIds.has(m.id))
        return { ...fresh, messages: [...(fresh.messages ?? []), ...extra] }
      })
    }
    if (meRes.ok) { const me = await meRes.json(); setMyId(me.id) }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv?.messages])

  // ── Realtime WebSocket ───────────────────────────────────────────────────
  useConversationSocket(id ?? null, {
    new_message: (msg) => {
      setConv((prev: any) => {
        if (!prev) return prev
        // Deduplicate: skip if this message id already exists
        const exists = (prev.messages ?? []).some((m: any) => m.id === msg.id)
        if (exists) return prev
        return { ...prev, messages: [...(prev.messages ?? []), msg] }
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
    order_request_created: () => load(),   // reload full conv to get orderRequests
    order_request_updated: () => load(),
    order_created: (d: any) => {
      load()
      router.push(`/orders/${d.orderId}`)
    },
  })

  // ── Media ────────────────────────────────────────────────────────────────
  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    setPendingMedia({ file, preview: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' })
  }
  function clearPendingMedia() {
    if (pendingMedia) URL.revokeObjectURL(pendingMedia.preview)
    setPendingMedia(null)
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!text.trim() && !pendingMedia) return
    setSending(true)
    try {
      let mediaKey: string | undefined
      if (pendingMedia) {
        setUploadingMedia(true)
        const fd = new FormData(); fd.append('file', pendingMedia.file)
        const upRes = await fetch('/api/proxy/uploads', { method: 'POST', body: fd })
        setUploadingMedia(false)
        if (!upRes.ok) return
        mediaKey = (await upRes.json()).key
      }
      const res = await fetch(`/api/proxy/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: pendingMedia ? pendingMedia.type : 'text',
          body: text.trim() || (pendingMedia ? `[${pendingMedia.type}]` : ''),
          mediaKey,
        }),
      })
      if (res.ok) { setText(''); clearPendingMedia() }
      // WS pushes the message — no need to reload
    } finally { setSending(false); setUploadingMedia(false) }
  }

  // ── Order request actions ────────────────────────────────────────────────
  async function createOrderRequest() {
    await fetch(`/api/proxy/conversations/${id}/order-requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // WS order_request_created will trigger reload
  }

  async function respondOrderRequest(requestId: string, action: 'accept' | 'reject') {
    await fetch(`/api/proxy/conversations/order-requests/${requestId}/${action}`, { method: 'POST' })
  }

  async function sellerFillInfo(requestId: string, form: SellerForm) {
    const res = await fetch(`/api/proxy/conversations/order-requests/${requestId}/seller-info`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: Number(form.price), quantity: Number(form.quantity) }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Request failed.')
      throw new Error(msg)
    }
  }

  async function buyerFillInfo(requestId: string, form: BuyerForm) {
    const res = await fetch(`/api/proxy/conversations/order-requests/${requestId}/buyer-info`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: form.phone, email: form.email,
        deliveryAddress: form.deliveryAddress,
        fulfillmentMethod: form.fulfillmentMethod,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Request failed.')
      throw new Error(msg)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )
  if (!conv) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <p className="text-[#6B7280] mb-4">Conversation not found.</p>
      <Link href="/conversations" className="text-[#2563EB] text-[14px]">Back</Link>
    </div>
  )

  const stageIdx  = STAGE_STEPS.indexOf(conv.stage)
  const isActive  = conv.status === 'active'

  // Order requests keyed by id for O(1) lookup
  const orderRequestsById: Record<string, any> = {}
  for (const or of conv.orderRequests ?? []) orderRequestsById[or.id] = or

  // Active order request (pending/accepted/filling)
  const activeOrderRequest = (conv.orderRequests ?? []).find(
    (or: any) => !['rejected', 'completed'].includes(or.status)
  )

  // Deduplicate by id (guard against HTTP reload + WS overlap),
  // then sort ascending by createdAt (NaN-safe fallback to 0).
  const seen = new Set<string>()
  const messages: any[] = (conv.messages ?? [])
    .filter((m: any) => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
    .sort((a: any, b: any) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return ta - tb
    })

  return (
    <div className="flex flex-col min-h-screen bg-white">

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/conversations" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#111827] truncate">
            {conv.match?.demandRequest?.title ?? 'Conversation'}
          </p>
          <p className="text-[12px] text-[#6B7280] truncate">
            ↔ {conv.match?.productListing?.title ?? ''}
          </p>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLOR[conv.stage] ?? ''}`}>
          {conv.stage}
        </span>
      </div>

      {/* Stage progress */}
      {conv.stage !== 'closed' && (
        <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <div className="flex items-center gap-1">
            {STAGE_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${i <= stageIdx ? 'bg-[#2563EB] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'}`}>
                  {i < stageIdx ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-[11px] flex-1 ${i === stageIdx ? 'text-[#2563EB] font-medium' : 'text-[#9CA3AF]'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
                {i < STAGE_STEPS.length - 1 && <div className="w-4 h-px bg-[#E5E7EB]" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {messages.map((m: any) => {
          const isSystem = m.isSystemGenerated || m.messageType === 'system'

          // Order request card (system message placeholder)
          if (isSystem && m.body?.startsWith('__order_request:')) {
            const requestId = m.body.replace('__order_request:', '').replace('__', '')
            const or = orderRequestsById[requestId]
            if (!or) return null
            return (
              <OrderRequestCard
                key={m.id}
                orderRequest={or}
                myUserId={myId}
                iAmSeller={myId === conv.sellerUserId}
                onAccept={() => respondOrderRequest(or.id, 'accept')}
                onReject={() => respondOrderRequest(or.id, 'reject')}
                onSellerFill={(f) => sellerFillInfo(or.id, f)}
                onBuyerFill={(f)  => buyerFillInfo(or.id, f)}
              />
            )
          }

          if (isSystem) return (
            <div key={m.id} className="flex justify-center">
              <span className="text-[12px] text-[#9CA3AF] bg-[#F3F4F6] px-3 py-1 rounded-full">{m.body}</span>
            </div>
          )

          const isMine = m.senderUserId === myId || m.sender?.id === myId

          return (
            <div key={m.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && (
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-[12px] font-bold flex-shrink-0">
                  {m.sender?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && <p className="text-[11px] text-[#6B7280] mb-0.5">{m.sender?.name}</p>}

                {m.messageType === 'image' && m.mediaUrl && (
                  <div className={`rounded-2xl overflow-hidden max-w-[220px] ${isMine ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.mediaUrl} alt="shared image" className="w-full object-cover" />
                    {m.body && m.body !== '[image]' && (
                      <div className="bg-[#F3F4F6] px-3 py-2"><p className="text-[13px] text-[#111827]">{m.body}</p></div>
                    )}
                  </div>
                )}

                {m.messageType === 'video' && m.mediaUrl && (
                  <div className={`rounded-2xl overflow-hidden max-w-[220px] bg-black ${isMine ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                    <video src={m.mediaUrl} controls className="w-full" />
                    {m.body && m.body !== '[video]' && (
                      <div className="bg-[#F3F4F6] px-3 py-2"><p className="text-[13px] text-[#111827]">{m.body}</p></div>
                    )}
                  </div>
                )}

                {(m.messageType === 'text' || (!m.mediaUrl && m.messageType !== 'image' && m.messageType !== 'video')) && (
                  <div className={`px-3 py-2 rounded-2xl ${isMine ? 'bg-[#2563EB] text-white rounded-tr-none' : 'bg-[#F3F4F6] text-[#111827] rounded-tl-none'}`}>
                    <p className="text-[14px] leading-relaxed">{m.body}</p>
                  </div>
                )}

                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{new Date(m.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Media preview strip */}
      {pendingMedia && (
        <div className="border-t border-[#E5E7EB] px-4 py-2 bg-[#F9FAFB] flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black flex-shrink-0">
            {pendingMedia.type === 'video'
              ? <div className="w-full h-full flex items-center justify-center bg-[#1F2937]"><Play className="w-5 h-5 text-white" /></div>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={pendingMedia.preview} alt="" className="w-full h-full object-cover" />
            }
          </div>
          <div className="flex-1">
            <p className="text-[12px] text-[#374151] font-medium truncate">{pendingMedia.file.name}</p>
            <p className="text-[11px] text-[#6B7280]">{(pendingMedia.file.size / 1024 / 1024).toFixed(1)} MB · {pendingMedia.type}</p>
          </div>
          {uploadingMedia
            ? <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin flex-shrink-0" />
            : <button onClick={clearPendingMedia} className="w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center flex-shrink-0"><X className="w-3.5 h-3.5 text-[#374151]" /></button>
          }
        </div>
      )}

      {/* Bottom input bar */}
      {isActive && (
        <div className="border-t border-[#E5E7EB] px-4 py-3 bg-white">
          <div className="flex gap-2 items-center">
            <button onClick={() => fileRef.current?.click()}
              className="w-9 h-9 rounded-full border border-[#D1D5DB] flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:border-[#2563EB] flex-shrink-0 transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              className="hidden" onChange={onFilePick} />

            <input
              className="flex-1 border border-[#D1D5DB] rounded-full px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder={pendingMedia ? 'Add a caption…' : 'Type a message…'}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            />

            <button onClick={sendMessage} disabled={(!text.trim() && !pendingMedia) || sending}
              className="w-10 h-10 rounded-full bg-[#2563EB] disabled:bg-[#93C5FD] text-white flex items-center justify-center flex-shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>

            {/* Order button — only if no active order request */}
            {!activeOrderRequest && (
              <button onClick={createOrderRequest}
                className="flex-shrink-0 flex items-center gap-1.5 h-10 px-3 bg-[#16A34A] text-white rounded-full text-[12px] font-medium whitespace-nowrap">
                <ShoppingBag className="w-3.5 h-3.5" />
                Order
              </button>
            )}
          </div>
        </div>
      )}

      {conv.status === 'closed' && (
        <div className="border-t border-[#E5E7EB] px-4 py-3 bg-[#F9FAFB] text-center text-[13px] text-[#6B7280]">
          This conversation is closed.
        </div>
      )}
    </div>
  )
}
