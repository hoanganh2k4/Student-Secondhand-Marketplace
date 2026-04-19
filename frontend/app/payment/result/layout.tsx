import { Suspense } from 'react'
import { Loader2 }  from 'lucide-react'

export default function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}
