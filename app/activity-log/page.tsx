"use client";

import { useEffect, useMemo, useState } from "react";

type ActivityItem = {
  id: string;
  title: string;
  note: string;
  actor: string;
  module: string;
  action: string;
  recordRef: string;
  time: string;
  icon: string;
  createdAt?: string;
};

function statusTone(icon: string) {
  if (icon === "sales") return "bg-violet-50 text-violet-700";
  if (icon === "payment") return "bg-emerald-50 text-emerald-700";
  if (icon === "inventory") return "bg-blue-50 text-blue-700";
  if (icon === "expense") return "bg-rose-50 text-rose-700";
  if (icon === "reset") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState("Loading activity log...");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");

  async function loadRows() {
    setMessage("Loading activity log...");
    try {
      const res = await fetch("/api/recent-activity", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load activity log");
      setRows(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load activity log.");
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const modules = useMemo(() => ["All", ...Array.from(new Set(rows.map((row) => row.module).filter(Boolean))).sort()], [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesModule = moduleFilter === "All" || row.module === moduleFilter;
      const text = `${row.title} ${row.note} ${row.actor} ${row.module} ${row.action} ${row.recordRef}`.toLowerCase();
      return matchesModule && (!query || text.includes(query));
    });
  }, [rows, search, moduleFilter]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Audit Trail</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Activity Log</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Search and review system activity recorded in Audit_Log. Dashboard Recent Activity shows the latest items; this page is for review and training.
            </p>
            {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
          </div>
          <button type="button" onClick={loadRows} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity, actor, ref, or summary..."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none lg:max-w-xl"
          />
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
          >
            {modules.map((module) => <option key={module}>{module}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Time</th>
                <th className="px-5 py-4 font-semibold">Module</th>
                <th className="px-5 py-4 font-semibold">Action</th>
                <th className="px-5 py-4 font-semibold">Record Ref</th>
                <th className="px-5 py-4 font-semibold">Actor</th>
                <th className="px-5 py-4 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id || `${row.title}-${row.time}-${row.recordRef}`} className="border-b border-slate-100 last:border-b-0 align-top">
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700">{row.time}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(row.icon)}`}>{row.module || "System"}</span></td>
                  <td className="px-5 py-4 font-semibold text-slate-950">{row.action || row.title}</td>
                  <td className="px-5 py-4 text-slate-700">{row.recordRef || "-"}</td>
                  <td className="px-5 py-4 text-slate-700">{row.actor || "System"}</td>
                  <td className="max-w-2xl px-5 py-4 leading-6 text-slate-600">{row.note || "-"}</td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No activity records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
