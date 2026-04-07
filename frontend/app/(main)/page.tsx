'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Plus, Loader2, RefreshCw, Target, ImageIcon } from 'lucide-react'
import { useUnreadCount } from '@/hooks/useUnreadCount'

const DEMAND_STATUS_COLOR: Record<string, string> = {
  active:          'bg-[#DCFCE7] text-[#16A34A]',
  matched:         'bg-[#EFF6FF] text-[#2563EB]',
  in_conversation: 'bg-[#FEF3C7] text-[#D97706]',
  waiting:         'bg-[#F3F4F6] text-[#6B7280]',
  fulfilled:       'bg-[#F0FDF4] text-[#15803D]',
  expired:         'bg-[#FEF2F2] text-[#DC2626]',
  cancelled:       'bg-[#F3F4F6] text-[#9CA3AF]',
}

const LISTING_STATUS_COLOR: Record<string, string> = {
  draft:          'bg-[#F3F4F6] text-[#6B7280]',
  active:         'bg-[#DCFCE7] text-[#16A34A]',
  matched:        'bg-[#EFF6FF] text-[#2563EB]',
  in_conversation:'bg-[#FEF3C7] text-[#D97706]',
  sold:           'bg-[#F0FDF4] text-[#15803D]',
  expired:        'bg-[#FEF2F2] text-[#DC2626]',
  removed:        'bg-[#F3F4F6] text-[#9CA3AF]',
}

export default function HomePage() {
  const unreadCount = useUnreadCount()
  const [user,      setUser]      = useState<any>(null)
  const [demands,   setDemands]   = useState<any[]>([])
  const [listings,  setListings]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [userRes, demandsRes, listingsRes] = await Promise.all([
        fetch('/api/proxy/auth/me'),
        fetch('/api/proxy/demands'),
        fetch('/api/proxy/listings'),
      ])
      if (userRes.ok)     setUser(await userRes.json())
      if (demandsRes.ok)  setDemands(await demandsRes.json())
      if (listingsRes.ok) setListings(await listingsRes.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    // Auto-refresh every 30s
    const interval = setInterval(() => fetchAll(), 30_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const firstName = user?.name?.split(' ')[0] ?? 'Student'
  const hours     = new Date().getHours()
  const greeting  = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'

  const activeDemands  = demands.filter(d => !['cancelled', 'fulfilled', 'expired'].includes(d.status))
  const activeListings = listings.filter(l => !['removed', 'sold', 'expired'].includes(l.status))

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center">
          <span className="text-white text-sm font-bold">{firstName[0]?.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-[#6B7280] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/notifications" className="relative p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-[#4B5563]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-medium"
          >
            {firstName[0]?.toUpperCase()}
          </Link>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-[20px] font-semibold text-[#111827] mb-1">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-[15px] text-[#4B5563]">
            Post what you&apos;re looking for, or list something to sell.
          </p>
        </div>

        {/* Active Demands */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Your Demands
              {activeDemands.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-[#6B7280]">({activeDemands.length})</span>
              )}
            </h2>
            <Link href="/demands" className="text-[#2563EB] text-[13px] font-medium">See all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {/* Add button */}
            <Link
              href="/demands/new"
              className="snap-start flex-shrink-0 w-[180px] h-[110px] border-2 border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 transition-colors"
            >
              <Plus className="w-6 h-6 text-[#2563EB]" />
              <span className="text-[13px] font-medium text-[#2563EB]">Post a Demand</span>
            </Link>

            {/* Demand cards */}
            {activeDemands.map(d => (
              <Link
                key={d.id}
                href={`/demands/${d.id}`}
                className="snap-start flex-shrink-0 w-[200px] h-[110px] border border-[#E5E7EB] rounded-xl p-3 flex flex-col justify-between hover:border-[#2563EB] transition-colors"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#111827] line-clamp-2 leading-tight">{d.title}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6B7280]">
                    {Number(d.budgetMax).toLocaleString()}₫
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DEMAND_STATUS_COLOR[d.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-[#111827]">Recent Matches</h2>
            <Link href="/demands" className="text-[#2563EB] text-[13px] font-medium">View</Link>
          </div>
          {(() => {
            const allMatches = demands.flatMap(d =>
              (d.matches ?? []).map((m: any) => ({ ...m, demandTitle: d.title }))
            ).slice(0, 3)
            if (allMatches.length === 0) return (
              <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-8 text-center">
                <Target className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-[14px] font-medium text-[#111827]">No matches yet</p>
                <p className="text-[13px] text-[#4B5563] mt-1">
                  Matches appear once we find a listing for your demand.
                </p>
              </div>
            )
            return (
              <div className="space-y-2">
                {allMatches.map((m: any) => (
                  <Link key={m.id} href={`/matches/${m.id}`}>
                    <div className="border border-[#E5E7EB] rounded-xl p-3 hover:border-[#2563EB] transition-colors flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827] line-clamp-1">{m.demandTitle}</p>
                        <p className="text-[11px] text-[#6B7280]">Match #{m.id.slice(0, 8)}</p>
                      </div>
                      <span className="text-[14px] font-bold text-[#2563EB]">{m.matchScore}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Your Listings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Your Listings
              {activeListings.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-[#6B7280]">({activeListings.length})</span>
              )}
            </h2>
            <Link href="/listings" className="text-[#2563EB] text-[13px] font-medium">See all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {/* Add button */}
            <Link
              href="/listings/new"
              className="snap-start flex-shrink-0 w-[180px] h-[110px] border-2 border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 transition-colors"
            >
              <Plus className="w-6 h-6 text-[#2563EB]" />
              <span className="text-[13px] font-medium text-[#2563EB]">Create a Listing</span>
            </Link>

            {/* Listing cards */}
            {activeListings.map(l => (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className="snap-start flex-shrink-0 w-[200px] h-[110px] border border-[#E5E7EB] rounded-xl overflow-hidden flex flex-col hover:border-[#2563EB] transition-colors"
              >
                {/* Thumbnail */}
                <div className="h-[60px] bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                  {l.proofAssets?.[0]?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.proofAssets[0].fileUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[#D1D5DB]" />
                  )}
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between flex-1">
                  <p className="text-[12px] font-semibold text-[#111827] line-clamp-1 flex-1">{l.title}</p>
                  <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${LISTING_STATUS_COLOR[l.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {l.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
