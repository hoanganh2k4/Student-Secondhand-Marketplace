'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Settings, Star, Package, Search, Shield, LogOut,
  ImageIcon, Clock, Target, ShoppingBag, Wallet,
} from 'lucide-react'

const STATUS_COLOR_LISTING: Record<string, string> = {
  draft:   'bg-[#F3F4F6] text-[#6B7280]',
  active:  'bg-[#DCFCE7] text-[#16A34A]',
  matched: 'bg-[#EFF6FF] text-[#2563EB]',
  sold:    'bg-[#F0FDF4] text-[#15803D]',
  expired: 'bg-[#FEF2F2] text-[#DC2626]',
  removed: 'bg-[#F3F4F6] text-[#9CA3AF]',
}

const STATUS_COLOR_DEMAND: Record<string, string> = {
  active:    'bg-[#DCFCE7] text-[#16A34A]',
  matched:   'bg-[#EFF6FF] text-[#2563EB]',
  fulfilled: 'bg-[#F0FDF4] text-[#15803D]',
  expired:   'bg-[#FEF2F2] text-[#DC2626]',
  cancelled: 'bg-[#F3F4F6] text-[#9CA3AF]',
}

export default function ProfilePage() {
  const router = useRouter()
  const [user,     setUser]     = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [demands,  setDemands]  = useState<any[]>([])
  const [orders,   setOrders]   = useState<any[]>([])
  const [wallet,   setWallet]   = useState<{ seller: { balance: number; transactions: any[] }; buyer: { totalPaid: number; transactions: any[] } } | null>(null)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    // Load auth/me first so its Set-Cookie (refresh) is applied before parallel calls
    const userRes = await fetch('/api/proxy/auth/me')
    if (!userRes.ok) { router.replace('/auth/login'); return }
    setUser(await userRes.json())

    const [listingsRes, demandsRes, ordersRes, walletRes] = await Promise.all([
      fetch('/api/proxy/listings'),
      fetch('/api/proxy/demands'),
      fetch('/api/proxy/orders'),
      fetch('/api/proxy/orders/wallet'),
    ])
    if (listingsRes.ok) setListings(await listingsRes.json())
    if (demandsRes.ok)  setDemands(await demandsRes.json())
    if (ordersRes.ok)   setOrders(await ordersRes.json())
    if (walletRes.ok)   setWallet(await walletRes.json())
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return null

  const firstName          = user.name?.split(' ')[0] ?? 'Student'
  const verificationStatus = user.studentProfile?.verificationStatus
  const sellerRating       = user.sellerProfile?.sellerRating
  const buyerRating        = user.buyerProfile?.buyerRating
  const rating             = sellerRating ?? buyerRating

  const activeListings = listings.filter(l => !['removed', 'sold', 'expired'].includes(l.status))
  const activeDemands  = demands.filter(d => !['cancelled', 'fulfilled', 'expired'].includes(d.status))
  const completedOrders = orders.filter(o => o.status === 'completed')

  const recentListings = listings.slice(0, 3)
  const recentDemands  = demands.slice(0, 3)

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/auth/login')
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-[20px] font-semibold text-[#111827]">Profile</h1>
        <Link href="/profile/settings">
          <Settings className="w-5 h-5 text-[#4B5563]" />
        </Link>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-2xl font-bold flex-shrink-0">
            {firstName[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-1">{user.name}</h2>
            <p className="text-[13px] text-[#4B5563] mb-2">
              {user.studentProfile?.university
                ? `${user.studentProfile.university}${user.studentProfile.graduationYear ? ` · Class of ${user.studentProfile.graduationYear}` : ''}`
                : 'University Student'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {verificationStatus === 'verified' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#16A34A]/10 text-[#16A34A] text-[11px]">
                  <Shield className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] text-[11px]">
                  New
                </span>
              )}
              <div className="flex items-center gap-1">
                <Star className={`w-4 h-4 ${rating ? 'fill-[#D97706] text-[#D97706]' : 'text-[#D1D5DB]'}`} />
                <span className="text-[13px] font-medium text-[#111827]">
                  {rating ? Number(rating).toFixed(1) : '—'}
                </span>
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mt-1">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F3F4F6] rounded-xl p-3 text-center">
            <p className="text-[22px] font-bold text-[#111827]">{completedOrders.length}</p>
            <p className="text-[10px] text-[#6B7280] leading-tight mt-0.5">Completed Orders</p>
          </div>
          <div className="bg-[#F3F4F6] rounded-xl p-3 text-center">
            <p className="text-[22px] font-bold text-[#111827]">{activeListings.length}</p>
            <p className="text-[10px] text-[#6B7280] leading-tight mt-0.5">Active Listings</p>
          </div>
          <div className="bg-[#F3F4F6] rounded-xl p-3 text-center">
            <p className="text-[22px] font-bold text-[#111827]">{activeDemands.length}</p>
            <p className="text-[10px] text-[#6B7280] leading-tight mt-0.5">Active Demands</p>
          </div>
        </div>

        {/* Wallets */}
        {wallet !== null && (
          <div className="space-y-3">
            {/* Buyer wallet — show if user has buyer profile */}
            {user.buyerProfile && (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#6B7280]" />
                    <p className="text-[13px] font-semibold text-[#374151]">Buyer — Total Paid</p>
                  </div>
                  <p className="text-[16px] font-bold text-[#111827]">{wallet.buyer.totalPaid.toLocaleString()} ₫</p>
                </div>
                {wallet.buyer.transactions.length > 0 && (
                  <div className="space-y-1.5">
                    {wallet.buyer.transactions.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-[#6B7280] truncate flex-1">{t.description}</span>
                        <span className="font-semibold ml-2 flex-shrink-0 text-[#DC2626]">
                          -{t.amount.toLocaleString()} ₫
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seller wallet — always show if user has seller profile */}
            {user.sellerProfile && (
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#2563EB]" />
                    <p className="text-[13px] font-semibold text-[#1D4ED8]">Seller — Available Balance</p>
                  </div>
                  <p className="text-[16px] font-bold text-[#1D4ED8]">{wallet.seller.balance.toLocaleString()} ₫</p>
                </div>
                {wallet.seller.transactions.length > 0 ? (
                  <div className="space-y-1.5">
                    {wallet.seller.transactions.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-[#374151] truncate flex-1">{t.description}</span>
                        <span className="font-semibold ml-2 flex-shrink-0 text-[#16A34A]">
                          +{t.amount.toLocaleString()} ₫
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#3B82F6]">No transactions yet. Complete an order to receive payment.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Listings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-[#111827]">My Listings</h3>
            <Link href="/listings" className="text-[#2563EB] text-[13px] font-medium">View all</Link>
          </div>

          {recentListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-6 text-center">
              <Package className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
              <p className="text-[13px] text-[#4B5563]">No listings yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentListings.map(l => (
                <Link key={l.id} href={`/listings/${l.id}`}>
                  <div className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB] transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {l.proofAssets?.[0]?.fileUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={l.proofAssets[0].fileUrl} alt="" className="w-full h-full object-cover" />
                        : <ImageIcon className="w-5 h-5 text-[#D1D5DB]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] line-clamp-1">{l.title}</p>
                      <p className="text-[12px] text-[#2563EB] font-medium">{Number(l.priceExpectation).toLocaleString()} ₫</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR_LISTING[l.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                        {l.status}
                      </span>
                      {(l.matches?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-[#2563EB] font-semibold">
                          <Target className="w-3 h-3" />{l.matches.length}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Demands */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-[#111827]">My Demands</h3>
            <Link href="/demands" className="text-[#2563EB] text-[13px] font-medium">View all</Link>
          </div>

          {recentDemands.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-6 text-center">
              <Search className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
              <p className="text-[13px] text-[#4B5563]">No demands yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDemands.map(d => (
                <Link key={d.id} href={`/demands/${d.id}`}>
                  <div className="border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#111827] line-clamp-1">{d.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR_DEMAND[d.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[12px] text-[#6B7280]">
                      <span>{Number(d.budgetMin).toLocaleString()} – {Number(d.budgetMax).toLocaleString()} ₫</span>
                      <div className="flex items-center gap-1">
                        {(d.matches?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[#2563EB] font-semibold">
                            <Target className="w-3 h-3" />{d.matches.length}
                          </span>
                        )}
                        <Clock className="w-3 h-3" />
                        {new Date(d.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        {orders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[#111827]">Recent Orders</h3>
              <Link href="/orders" className="text-[#2563EB] text-[13px] font-medium">View all</Link>
            </div>
            <div className="space-y-2">
              {orders.slice(0, 3).map(o => (
                <Link key={o.id} href={`/orders/${o.id}`}>
                  <div className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB] transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] line-clamp-1">
                        {o.match?.productListing?.title ?? 'Order'}
                      </p>
                      <p className="text-[12px] text-[#6B7280]">{Number(o.finalPrice).toLocaleString()} ₫</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      o.status === 'completed' ? 'bg-[#DCFCE7] text-[#16A34A]'
                      : o.status === 'cancelled' ? 'bg-[#F3F4F6] text-[#9CA3AF]'
                      : 'bg-[#FEF3C7] text-[#D97706]'
                    }`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <Link
          href="/auth/logout"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DC2626]/20 bg-white px-4 py-3 text-[14px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Link>
      </div>
    </div>
  )
}
