'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

function decodeEmail(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.email ?? ''
  } catch {
    return ''
  }
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear + i)
const CAMPUSES = ['Main Campus', 'North Campus', 'Downtown Campus', 'West Campus', 'Other']

export default function OnboardingPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') ?? ''
  const email        = decodeEmail(token)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const [name, setName]         = useState('')
  const [university, setUniversity] = useState('')
  const [gradYear, setGradYear] = useState('')

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`${API_URL}/auth/onboarding`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        university,
        graduationYear: gradYear ? parseInt(gradYear) : undefined,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message ?? 'Something went wrong.')
      return
    }

    const { accessToken } = await res.json()
    await fetch(`/auth/set-cookie?token=${encodeURIComponent(accessToken)}`)
    setDone(true)
    setTimeout(() => router.push('/'), 1200)
  }

  const isValid = name.trim() && university.trim()

  if (done) {
    return (
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-[#16A34A]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">You're all set!</h1>
          <p className="text-[15px] text-[#4B5563]">Taking you to the marketplace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">
            Almost there — tell us a bit about yourself
          </h1>
          <p className="text-[15px] text-[#4B5563]">
            This information stays on your profile and helps build trust.
          </p>
          {email && (
            <p className="mt-2 text-[13px] text-[#4B5563]">
              Signing in as <strong className="text-[#111827]">{email}</strong>
            </p>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Full name */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-[12px] font-medium text-[#4B5563]">
              Full name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full h-12 px-4 border border-[#D1D5DB] rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors"
            />
          </div>

          {/* University */}
          <div className="space-y-2">
            <label htmlFor="university" className="block text-[12px] font-medium text-[#4B5563]">
              University
            </label>
            <input
              id="university"
              type="text"
              placeholder="e.g. University of Science"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              required
              className="w-full h-12 px-4 border border-[#D1D5DB] rounded-xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors"
            />
          </div>

          {/* Graduation year */}
          <div className="space-y-2">
            <label htmlFor="gradYear" className="block text-[12px] font-medium text-[#4B5563]">
              Graduation year <span className="text-[#9CA3AF] font-normal">(optional)</span>
            </label>
            <select
              id="gradYear"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              className="w-full h-12 px-4 border border-[#D1D5DB] rounded-xl text-[15px] text-[#111827] bg-white focus:outline-none focus:border-[#2563EB] focus:border-2 transition-colors appearance-none"
            >
              <option value="">Select year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-[#DC2626]/10 px-4 py-3 text-[13px] text-[#DC2626]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !isValid}
          className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#D1D5DB] disabled:text-[#4B5563] text-white rounded-xl font-medium text-[15px] transition-colors"
        >
          {loading ? 'Saving…' : 'Set up my account →'}
        </button>

        <div className="flex items-center justify-center gap-2 text-[13px] text-[#4B5563]">
          <Lock className="w-3.5 h-3.5" />
          <span>Your student status is verified via your email domain.</span>
        </div>
      </form>
    </div>
  )
}
