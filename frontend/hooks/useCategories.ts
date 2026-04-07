'use client'

import { useEffect, useState } from 'react'

export interface Category {
  id:       string
  name:     string
  children: { id: string; name: string }[]
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch('/api/proxy/categories')
      .then(r => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading }
}
