"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { JSX } from "react";

export type TabItem = {
  href: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
};

type BottomNavProps = {
  tabs?: TabItem[];
};

const TABS: TabItem[] = [
  {
    href: "/",
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
    href: "/demands",
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
    href: "/listings",
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
    href: "/conversations",
    label: "Chats",
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
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
  {
    href: "/orders",
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
  {
    href: "/profile",
    label: "Profile",
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
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
];

export function BottomNav({ tabs = TABS }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#D1D5DB] bg-white">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
      >
        {tabs.map((tab) => {
          const comparePathName = pathname.replace("/admin", "/");
          const compareTabHref = tab.href.replace("/admin", "/");
          const active =
            compareTabHref === "/"
              ? comparePathName === "/"
              : comparePathName.startsWith(compareTabHref);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active
                  ? "text-[#2563EB]"
                  : "text-[#4B5563] hover:text-[#2563EB]"
              }`}
            >
              {tab.icon(active)}
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
