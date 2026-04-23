export default function Topbar() {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Secure admin panel</p>
          <h2 className="text-2xl font-semibold">Realight Operations Dashboard</h2>
        </div>

        <div className="flex gap-3">
          <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm">
            Export
          </button>
          <button className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
            Quick Add
          </button>
        </div>
      </div>
    </header>
  );
}
