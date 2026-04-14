'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingBag, Loader2, Clock, Package, ShoppingCart } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  created:     'bg-[#EFF6FF] text-[#2563EB]',
  in_progress: 'bg-[#FEF3C7] text-[#D97706]',
  completed:   'bg-[#DCFCE7] text-[#16A34A]',
  cancelled:   'bg-[#F3F4F6] text-[#9CA3AF]',
  disputed:    'bg-[#FEF2F2] text-[#DC2626]',
}

type Tab = 'buying' | 'selling'

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-16 text-center">
      <ShoppingBag className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
      <p className="text-[16px] font-semibold text-[#111827] mb-2">
        {tab === 'buying' ? 'No purchase orders' : 'No sales orders'}
      </p>
      <p className="text-[14px] text-[#4B5563]">
        {tab === 'buying'
          ? 'Orders appear here when you purchase an item.'
          : 'Orders appear here when a buyer purchases your listing.'}
      </p>
    </div>
  )
}

function OrderCard({ o }: { o: any }) {
  return (
    <Link href={`/orders/${o.id}`}>
      <div className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#2563EB] transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#111827] line-clamp-1">
              {o.match?.productListing?.title ?? 'Order'}
            </p>
            <p className="text-[12px] text-[#6B7280] line-clamp-1">
              {o.match?.demandRequest?.title ?? ''}
            </p>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[o.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
            {o.status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold text-[#2563EB]">{Number(o.finalPrice).toLocaleString()} ₫</span>
          <span className="text-[#6B7280] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(o.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function OrdersPage() {
  const [orders,  setOrders]  = useState<any[]>([])
  const [myId,    setMyId]    = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('buying')

  const load = useCallback(async () => {
    const [ordersRes, meRes] = await Promise.all([
      fetch('/api/proxy/orders'),
      fetch('/api/proxy/auth/me'),
    ])
    if (ordersRes.ok) setOrders(await ordersRes.json())
    if (meRes.ok) { const me = await meRes.json(); setMyId(me.id) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const buyingOrders  = orders.filter(o => o.buyerUserId  === myId)
  const sellingOrders = orders.filter(o => o.sellerUserId === myId)
  const displayed     = tab === 'buying' ? buyingOrders : sellingOrders

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] z-10">
        <div className="px-4 py-3">
          <h1 className="text-[20px] font-semibold text-[#111827]">Orders</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E7EB]">
          <button
            onClick={() => setTab('buying')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'buying'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Buying
            {buyingOrders.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${tab === 'buying' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                {buyingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('selling')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'selling'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}
          >
            <Package className="w-4 h-4" />
            Selling
            {sellingOrders.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${tab === 'selling' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                {sellingOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        )}

        {!loading && displayed.length === 0 && <EmptyState tab={tab} />}

        {!loading && displayed.map(o => <OrderCard key={o.id} o={o} />)}
      </div>
    </div>
  )
}
