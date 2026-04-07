'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useCategories } from '@/hooks/useCategories'

const CONDITIONS = ['good', 'very_good', 'like_new'] as const
const URGENCIES  = ['flexible', 'within_week', 'within_month'] as const

export default function CreateDemandPage() {
  const router = useRouter()
  const { categories, loading: catsLoading } = useCategories()

  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    title:               '',
    categoryId:          '',
    description:         '',
    budgetMin:           '',
    budgetMax:           '',
    preferredCondition:  'good' as typeof CONDITIONS[number],
    quantityNeeded:      '1',
    location:            '',
    urgency:             'flexible' as typeof URGENCIES[number],
    specialRequirements: '',
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/proxy/demands', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budgetMin:      Number(form.budgetMin),
          budgetMax:      Number(form.budgetMax),
          quantityNeeded: Number(form.quantityNeeded),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(Array.isArray(d.message) ? d.message.join(', ') : (d.message ?? 'Failed to create demand.'))
        return
      }
      const demand = await res.json()
      router.push(`/demands/${demand.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/demands" className="text-[#4B5563]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[18px] font-semibold text-[#111827]">New Demand</h1>
        <span className="ml-auto text-[13px] text-[#6B7280]">Step {step}/2</span>
      </div>

      <div className="h-1 bg-[#F3F4F6]">
        <div className="h-1 bg-[#2563EB] transition-all" style={{ width: `${step * 50}%` }} />
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        {step === 1 && (
          <>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                What are you looking for? <span className="text-[#DC2626]">*</span>
              </label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., MacBook Pro 13-inch 2021"
                value={form.title}
                onChange={set('title')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                Category <span className="text-[#DC2626]">*</span>
              </label>
              <select
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                value={form.categoryId}
                onChange={set('categoryId')}
                disabled={catsLoading}
              >
                <option value="">{catsLoading ? 'Loading…' : 'Select a category'}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Description</label>
              <textarea
                rows={3}
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                placeholder="Describe what you need..."
                value={form.description}
                onChange={set('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                  Min Budget (₫) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number"
                  className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="0"
                  value={form.budgetMin}
                  onChange={set('budgetMin')}
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                  Max Budget (₫) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number"
                  className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="0"
                  value={form.budgetMax}
                  onChange={set('budgetMax')}
                />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Preferred Condition</label>
              <select
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                value={form.preferredCondition}
                onChange={set('preferredCondition')}
              >
                {CONDITIONS.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Quantity Needed</label>
              <input
                type="number"
                min={1}
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                value={form.quantityNeeded}
                onChange={set('quantityNeeded')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Location</label>
              <input
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g., Hanoi, Ho Chi Minh City"
                value={form.location}
                onChange={set('location')}
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Urgency</label>
              <select
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                value={form.urgency}
                onChange={set('urgency')}
              >
                {URGENCIES.map(u => (
                  <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Special Requirements</label>
              <textarea
                rows={2}
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                placeholder="Any specific requirements..."
                value={form.specialRequirements}
                onChange={set('specialRequirements')}
              />
            </div>

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}
          </>
        )}
      </div>

      <div className="px-4 pb-8 pt-4 border-t border-[#E5E7EB]">
        {step === 1 ? (
          <button
            onClick={() => setStep(2)}
            disabled={!form.title || !form.categoryId || !form.budgetMin || !form.budgetMax}
            className="w-full h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 h-12 border border-[#D1D5DB] text-[#374151] rounded-xl text-[15px] font-medium">
              Back
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-[#93C5FD] text-white rounded-xl text-[15px] font-semibold transition-colors flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Demand'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
