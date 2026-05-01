export default function Topbar() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 px-6 py-5 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
                <path d="m9 12 2 2 4-5" />
              </svg>
            </span>
            Secure admin panel
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Realight Operations Dashboard</h2>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">
            <span className="text-lg leading-none">+</span>
            Quick Add
          </button>
        </div>
      </div>
    </header>
  );
}
