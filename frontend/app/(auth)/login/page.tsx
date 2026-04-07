'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'email' | 'password' | 'sent'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep]         = useState<Step>('email')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`)
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()

      if (data.hasPassword) {
        setStep('password')
      } else {
        await sendMagicLink()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/auth/magic-link`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? 'Could not send magic link.')
      } else {
        setStep('sent')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError('Incorrect password. Try again or sign in with magic link.')
        return
      }

      const { accessToken } = await res.json()
      await fetch(`/auth/set-cookie?token=${encodeURIComponent(accessToken)}`)
      router.push('/')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Sent state ─────────────────────────────────────────────────────────────
  if (step === 'sent') {
    return (
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] mb-3">Check your inbox</h1>
            <p className="text-[15px] text-[#111827] mb-4">
              We sent a sign-in link to <strong>{email}</strong>.
            </p>
            <p className="text-[13px] text-[#4B5563]">
              Link expires in 15 minutes. Check your spam folder if you don't see it.
            </p>
          </div>
          <button
            onClick={() => { setStep('email'); setEmail(''); setError('') }}
            className="w-full py-3 text-[#2563EB] text-[15px] hover:bg-[#EFF6FF] rounded-xl transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  // ── Password step ──────────────────────────────────────────────────────────
  if (step === 'password') {
    return (
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center">
            <span className="text-white text-2xl font-bold">U</span>
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] mb-2">Welcome back</h1>
            <p className="text-[15px] text-[#4B5563]">{email}</p>
          </div>

          <form onSubmit={handlePasswordLogin} className="w-full space-y-3">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[12px] font-medium text-[#4B5563] text-left">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                required
                autoFocus
                className={`w-full h-12 px-4 border rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors ${
                  error ? 'border-[#DC2626] border-2' : 'border-[#D1D5DB]'
                }`}
              />
              {error && (
                <p className="text-[13px] text-[#DC2626] text-left">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#D1D5DB] disabled:text-[#4B5563] text-white rounded-xl font-medium text-[15px] transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Fallback to magic link */}
          <div className="w-full space-y-2">
            <button
              onClick={async () => { setPassword(''); setError(''); await sendMagicLink() }}
              disabled={loading}
              className="w-full py-2.5 text-[#2563EB] text-[14px] hover:bg-[#EFF6FF] rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Sign in with magic link instead'}
            </button>
            <button
              onClick={() => { setStep('email'); setPassword(''); setError('') }}
              className="w-full py-2 text-[13px] text-[#4B5563] hover:text-[#2563EB] transition-colors"
            >
              ← Use a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Email step (default) ───────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center">
          <span className="text-white text-2xl font-bold">U</span>
        </div>

        <div>
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">UniSwap</h1>
          <p className="text-[15px] text-[#4B5563]">The marketplace built for your campus.</p>
        </div>

        <form onSubmit={handleEmailContinue} className="w-full space-y-2">
          <label htmlFor="email" className="block text-[12px] font-medium text-[#4B5563] text-left">
            University Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="yourname@university.edu"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            required
            autoFocus
            className={`w-full h-12 px-4 border rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors ${
              error ? 'border-[#DC2626] border-2' : 'border-[#D1D5DB]'
            }`}
          />
          {error && (
            <p className="text-[13px] text-[#DC2626] text-left">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full h-11 mt-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#D1D5DB] disabled:text-[#4B5563] text-white rounded-xl font-medium text-[15px] transition-colors"
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>

        <p className="text-[13px] text-[#4B5563]">We'll send you a magic link. No password needed.</p>

        <div className="w-full flex items-center gap-4">
          <div className="flex-1 h-px bg-[#D1D5DB]" />
          <span className="text-[13px] text-[#4B5563]">or</span>
          <div className="flex-1 h-px bg-[#D1D5DB]" />
        </div>

        <button className="text-[#2563EB] text-[15px] hover:underline">
          Learn how it works →
        </button>
      </div>
    </div>
  )
}
