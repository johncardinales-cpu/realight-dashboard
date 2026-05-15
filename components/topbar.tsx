"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function logout() {
    await fetch("/api/session/end", { method: "POST" }).catch(console.error);
    router.replace("/login");
    router.refresh();
  }

  const formattedDate = now
    ? now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })
    : "Loading date";

  const formattedTime = now
    ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Manila" })
    : "--:-- --";

  return (
    <header className="border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:px-5 lg:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></svg>
            </span>
            Secure admin panel
          </div>
          <h2 className="truncate text-2xl font-semibold tracking-tight text-slate-950">Realight Operations Dashboard</h2>
        </div>

        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center xl:w-auto">
          <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm md:max-w-sm xl:w-80">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="text" placeholder="Search..." className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" />
          </div>

          <div className="flex min-w-[230px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>
            </span>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-sm font-semibold text-slate-950">{formattedDate}</p>
              <p className="whitespace-nowrap text-xs font-medium text-slate-500">{formattedTime} · Manila</p>
            </div>
          </div>

          <div className="flex min-w-[270px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="relative shrink-0">
              <img src="https://i.pravatar.cc/120?img=12" alt="John Cardinales profile photo" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">John Cardinales</p>
              <p className="truncate text-xs font-medium text-slate-500">john.cardinales@gmail.com</p>
            </div>
            <button type="button" onClick={logout} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Logout</button>
          </div>

          <a href="/add-delivery" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">
            <span className="text-lg leading-none">+</span>
            Quick Add
          </a>
        </div>
      </div>
    </header>
  );
}
