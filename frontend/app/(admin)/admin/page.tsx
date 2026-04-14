'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LogOut, Loader2 } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    fetch('/api/proxy/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u?.isAdmin) { router.replace('/'); return }
        setMe(u)
      })
  }, [router])

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 text-[#2563EB] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
          <span className="text-[16px] font-bold text-[#111827]">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#6B7280]">{me.name}</span>
          <button
            onClick={() => router.push('/auth/logout')}
            className="flex items-center gap-1.5 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-1.5 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>
    </div>
  )
}
