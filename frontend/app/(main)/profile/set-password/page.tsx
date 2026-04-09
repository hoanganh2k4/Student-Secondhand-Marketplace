'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)

  const isValid = password.length >= 8 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/set-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? 'Something went wrong.')
        return
      }

      setDone(true)
      setTimeout(() => router.push('/'), 1200)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#16A34A]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-[#111827] mb-2">Password set!</h1>
            <p className="text-[15px] text-[#4B5563]">Taking you to the marketplace…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-[#F3F4F6] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[#4B5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-[20px] font-semibold text-[#111827]">Set a password</h1>
      </div>

      <div className="px-4 py-6">
        <p className="text-[15px] text-[#4B5563] mb-6">
          Set a password so you can sign in quickly next time — no need to wait for a magic link email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-[12px] font-medium text-[#4B5563]">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full h-12 px-4 pr-11 border border-[#D1D5DB] rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm" className="block text-[12px] font-medium text-[#4B5563]">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirm"
                type={showConf ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={`w-full h-12 px-4 pr-11 border rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors ${
                  confirm && password !== confirm ? 'border-[#DC2626] border-2' : 'border-[#D1D5DB]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
              >
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm && password !== confirm && (
              <p className="text-[13px] text-[#DC2626]">Passwords do not match.</p>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-[#DC2626]/10 px-4 py-3 text-[13px] text-[#DC2626]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#D1D5DB] disabled:text-[#4B5563] text-white rounded-xl font-medium text-[15px] transition-colors"
          >
            {loading ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#4B5563]">
          <Lock className="w-3.5 h-3.5" />
          <span>Your password is encrypted and never stored in plain text.</span>
        </div>
      </div>
    </div>
  )
}
