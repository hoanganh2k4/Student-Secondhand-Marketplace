'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function PaymentResultPage() {
  const params  = useSearchParams()
  const router  = useRouter()

  const [status,  setStatus]  = useState<'loading' | 'success' | 'failed'>('loading')
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    const gateway = params.get('gateway')

    if (gateway === 'momo') {
      // MoMo redirectUrl = /payment/result?gateway=momo
      // MoMo appends: resultCode, orderId, transId, message, etc.
      const resultCode = params.get('resultCode')
      if (resultCode === '0') {
        setStatus('success')
      } else {
        setStatus('failed')
      }
      // orderId will be available after IPN fires and order is created
    } else if (gateway === 'vnpay') {
      // VNPay return query handled by backend /api/payments/vnpay/return
      // Frontend gets redirected here with ?gateway=vnpay&success=true&orderId=...
      const success = params.get('success')
      const oid     = params.get('orderId')
      setStatus(success === 'true' ? 'success' : 'failed')
      if (oid) setOrderId(oid)
    } else {
      setStatus('failed')
    }
  }, [params])

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 w-full max-w-sm text-center space-y-4">

        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-[#2563EB] animate-spin mx-auto" />
            <p className="text-[15px] font-semibold text-[#111827]">Processing payment…</p>
            <p className="text-[13px] text-[#6B7280]">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-[#16A34A]" />
            </div>
            <p className="text-[17px] font-bold text-[#111827]">Payment Successful!</p>
            <p className="text-[13px] text-[#6B7280]">
              Your order has been created and is now in progress. The seller will be notified.
            </p>
            <div className="pt-2 space-y-2">
              {orderId && (
                <button
                  onClick={() => router.push(`/orders/${orderId}`)}
                  className="w-full py-3 bg-[#2563EB] text-white rounded-xl text-[14px] font-semibold"
                >
                  View Order
                </button>
              )}
              <button
                onClick={() => router.push('/orders')}
                className="w-full py-3 border border-[#D1D5DB] text-[#374151] rounded-xl text-[14px] font-medium"
              >
                Go to My Orders
              </button>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9 text-[#DC2626]" />
            </div>
            <p className="text-[17px] font-bold text-[#111827]">Payment Failed</p>
            <p className="text-[13px] text-[#6B7280]">
              The payment was not completed. You can try again from the conversation.
            </p>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => router.back()}
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl text-[14px] font-semibold"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/conversations')}
                className="w-full py-3 border border-[#D1D5DB] text-[#374151] rounded-xl text-[14px] font-medium"
              >
                Back to Conversations
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
