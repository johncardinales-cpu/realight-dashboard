"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/", icon: "M3 10.75 12 3l9 7.75V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.75Z" },
  { label: "Inventory", href: "/inventory", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { label: "Incoming Deliveries", href: "/incoming-deliveries", icon: "M3 7h11v10H3V7Zm11 4h3l3 3v3h-6v-6Zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  { label: "Sales", href: "/sales", icon: "M4 19h16M7 16l4-4 3 3 5-7" },
  { label: "Daily Reconciliation", href: "/daily-reconciliation", icon: "M9 11h6M9 15h6M8 3h8l3 3v15H5V3h3Zm8 0v4h4" },
  { label: "Accounting Review", href: "/accounting-review", icon: "M4 5h16v14H4V5Zm4 4h8M8 13h3M14 13h2M8 17h8" },
  { label: "Expenses", href: "/expenses", icon: "M4 7h16v12H4V7Zm0 4h16M16 15h2" },
  { label: "Reports", href: "/reports", icon: "M6 3h9l3 3v15H6V3Zm8 0v4h4M9 13h6M9 17h6" },
  { label: "Users", href: "/users", icon: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { label: "Settings", href: "/settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.08-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6c.38 0 .73-.13 1-.35.27-.22.42-.56.4-.91V3a2 2 0 1 1 4 0v.09c-.02.35.13.69.4.91.27.22.62.35 1 .35a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c0 .38.13.73.35 1 .22.27.56.42.91.4H21a2 2 0 1 1 0 4h-.09c-.35-.02-.69.13-.91.4-.22.27-.35.62-.35 1Z" },
];

function ReallightsLogo() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 ring-1 ring-slate-200 shadow-sm">
      <svg viewBox="0 0 64 64" aria-hidden="true" className="h-11 w-11">
        <defs>
          <linearGradient id="solarGold" x1="10" x2="54" y1="8" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbbf24" />
            <stop offset="0.55" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="panelNavy" x1="18" x2="48" y1="36" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0f2a4f" />
            <stop offset="1" stopColor="#061733" />
          </linearGradient>
        </defs>
        <path d="M32 6v10M32 48v8M10 32h10M44 32h10M16.4 16.4l7 7M40.6 40.6l7 7M47.6 16.4l-7 7M23.4 40.6l-7 7" stroke="url(#solarGold)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M17 34a15 15 0 1 1 30 0" fill="none" stroke="url(#solarGold)" strokeWidth="5" strokeLinecap="round" />
        <path d="M32 20l2.6 8.2L43 31l-8.4 2.8L32 42l-2.6-8.2L21 31l8.4-2.8L32 20Z" fill="url(#solarGold)" />
        <path d="M19 49h26l-6-13H25l-6 13Z" fill="url(#panelNavy)" />
        <path d="M25 36 22 49M32 36v13M39 36l3 13M20.5 44h23" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden border-r border-slate-200/80 bg-white/95 px-4 py-6 shadow-[10px_0_40px_rgba(15,23,42,0.03)] backdrop-blur lg:block">
      <div className="mb-8 px-1">
        <div className="flex items-center gap-3">
          <ReallightsLogo />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-950">Reallights</h1>
            <p className="truncate text-sm font-semibold tracking-[0.18em] text-amber-600">SOLAR</p>
          </div>
        </div>
      </div>

      <nav className="space-y-2 text-sm font-medium">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                active
                  ? "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`h-5 w-5 ${active ? "text-emerald-600" : "text-slate-500 group-hover:text-slate-700"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
