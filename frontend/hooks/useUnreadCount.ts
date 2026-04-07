'use client'

import { useEffect, useState } from 'react'

export function useUnreadCount() {
  const [count, setCount] = useState(0)

  async function fetch_() {
    try {
      const res = await fetch('/api/proxy/notifications')
      if (!res.ok) return
      const data: any[] = await res.json()
      setCount(data.filter(n => !n.read).length)
    } catch {}
  }

  useEffect(() => {
    fetch_()
    const interval = setInterval(fetch_, 15_000)
    return () => clearInterval(interval)
  }, [])

  return count
}
