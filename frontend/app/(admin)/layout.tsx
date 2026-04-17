"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { BottomNav, TabItem } from "@/components/bottom-nav";

const adminTabs: TabItem[] = [
  {
    href: "/admin",
    label: "Home",
    icon: (active: boolean) => (
      <svg
        className="h-5 w-5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6H9v6H3.75A.75.75 0 013 21V9.75z"
        />
      </svg>
    ),
  },
  {
    href: "/admin/demands",
    label: "Demands",
    icon: (active: boolean) => (
      <svg
        className="h-5 w-5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    href: "/admin/listings",
    label: "Listings",
    icon: (active: boolean) => (
      <svg
        className="h-5 w-5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
        />
      </svg>
    ),
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: (active: boolean) => (
      <svg
        className="h-5 w-5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch("/api/proxy/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!u?.isAdmin) {
          router.replace("/");
          return;
        }
        setMe(u);
      });
  }, [router]);

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 text-[#2563EB] animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6]">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
          <span className="text-[16px] font-bold text-[#111827]">
            Admin Panel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#6B7280]">{me.name}</span>
          <button
            onClick={() => router.push("/auth/logout")}
            className="flex items-center gap-1.5 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-1.5 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 pb-10">{children}</main>
      <BottomNav tabs={adminTabs} />
    </div>
  );
}
