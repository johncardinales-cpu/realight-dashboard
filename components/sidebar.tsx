"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/", icon: "M3 10.75 12 3l9 7.75V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.75Z" },
  { label: "Inventory", href: "/inventory", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { label: "Incoming Deliveries", href: "/incoming-deliveries", icon: "M3 7h11v10H3V7Zm11 4h3l3 3v3h-6v-6Zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  { label: "Sales", href: "/sales", icon: "M4 19h16M7 16l4-4 3 3 5-7" },
  { label: "Expenses", href: "/expenses", icon: "M4 7h16v12H4V7Zm0 4h16M16 15h2" },
  { label: "Reports", href: "/reports", icon: "M6 3h9l3 3v15H6V3Zm8 0v4h4M9 13h6M9 17h6" },
  { label: "Users", href: "/users", icon: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { label: "Settings", href: "/settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden border-r border-slate-200/80 bg-white/95 px-4 py-6 shadow-[10px_0_40px_rgba(15,23,42,0.03)] backdrop-blur lg:block">
      <div className="mb-8 px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 ring-1 ring-slate-200 shadow-sm">
            <span className="text-xl font-bold text-amber-600">R</span>
          </div>
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
                active ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
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
