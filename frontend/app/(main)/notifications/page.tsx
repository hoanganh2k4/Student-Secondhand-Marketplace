'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Loader2, Target, MessageSquare, CheckCircle2, Package, RefreshCw } from 'lucide-react'

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  match_found:         { icon: <Target className="w-4 h-4" />,        color: 'bg-[#EFF6FF] text-[#2563EB]',  label: 'New Match' },
  conversation_opened: { icon: <MessageSquare className="w-4 h-4" />, color: 'bg-[#DCFCE7] text-[#16A34A]',  label: 'Chat Opened' },
  new_message:         { icon: <MessageSquare className="w-4 h-4" />, color: 'bg-[#FEF3C7] text-[#D97706]',  label: 'New Message' },
  stage_advanced:      { icon: <CheckCircle2 className="w-4 h-4" />,  color: 'bg-[#F0FDF4] text-[#15803D]',  label: 'Stage Advanced' },
  evidence_requested:  { icon: <Package className="w-4 h-4" />,       color: 'bg-[#FEF3C7] text-[#D97706]',  label: 'Evidence Requested' },
  evidence_fulfilled:  { icon: <CheckCircle2 className="w-4 h-4" />,  color: 'bg-[#DCFCE7] text-[#16A34A]',  label: 'Evidence Fulfilled' },
}

function notifHref(n: any): string {
  if (!n.referenceId) return '#'
  if (n.referenceType === 'match')        return `/matches/${n.referenceId}`
  if (n.referenceType === 'conversation') return `/conversations/${n.referenceId}`
  if (n.referenceType === 'order')        return `/orders/${n.referenceId}`
  return '#'
}

export default function NotificationsPage() {
  const [notifs,    setNotifs]    = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/proxy/notifications')
      if (res.ok) setNotifs(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(() => fetchNotifs(), 15_000)
    return () => clearInterval(interval)
  }, [fetchNotifs])

  async function markRead(id: string) {
    await fetch(`/api/proxy/notifications/${id}/read`, { method: 'PATCH' })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unread = notifs.filter(n => !n.read)
    await Promise.all(unread.map(n => fetch(`/api/proxy/notifications/${n.id}/read`, { method: 'PATCH' })))
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center z-10">
        <h1 className="text-[20px] font-semibold text-[#111827] flex-1">Notifications</h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[12px] text-[#2563EB] font-medium hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => fetchNotifs(true)}
            disabled={refreshing}
            className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-[#6B7280] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-16 text-center">
            <Bell className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[16px] font-semibold text-[#111827] mb-2">No notifications yet</p>
            <p className="text-[14px] text-[#4B5563]">
              You&apos;ll be notified when you get new matches or messages.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {notifs.map(n => {
            const meta = TYPE_META[n.type] ?? { icon: <Bell className="w-4 h-4" />, color: 'bg-[#F3F4F6] text-[#6B7280]', label: n.type }
            const href = notifHref(n)

            return (
              <Link
                key={n.id}
                href={href}
                onClick={() => !n.read && markRead(n.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors hover:border-[#2563EB] ${
                  n.read ? 'border-[#E5E7EB] bg-white' : 'border-[#BFDBFE] bg-[#EFF6FF]'
                }`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-[#374151]">{meta.label}</span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#2563EB] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[13px] text-[#4B5563] leading-snug">{n.body}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    {new Date(n.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
