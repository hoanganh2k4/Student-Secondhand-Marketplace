import { BottomNav } from '@/components/bottom-nav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
