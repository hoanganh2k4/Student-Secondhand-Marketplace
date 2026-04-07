import type { Metadata } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Student Marketplace',
  description: 'Buy and sell within your university',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${beVietnamPro.variable}`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
