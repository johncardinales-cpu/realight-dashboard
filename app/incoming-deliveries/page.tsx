"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementRow = Record<string, string>;
type DeliveryStatus = "Incoming" | "In Transit" | "Ready" | "Received" | "Available";

type ApiError = {
  error?: unknown;
};

const statusOptions: DeliveryStatus[] = ["Incoming", "In Transit", "Received", "Available"];
const LOW_CONFIDENCE_DAYS = 1000000000000;

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error ? error.message : fallback;
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function parseDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 30000 && serial < 70000) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatDate(value: string) {
  const date = parseDate(value);
  if (!date) return value || "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeEta(value: string) {
  const date = parseDate(value);
  if (!date) return "No date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  const diff = Math.round((compare.getTime() - today.getTime()) / 86400000);

  if (Math.abs(diff) > LOW_CONFIDENCE_DAYS) return "Scheduled";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

function normalizeStatus(row: MovementRow): DeliveryStatus {
  const status = String(row.Status || "").trim().toLowerCase();
  if (status === "received" || status === "available") return status === "available" ? "Available" : "Received";
  if (status === "in transit") return "In Transit";
  if (status === "ready" || status === "ready to receive") return "Ready";
  return "Incoming";
}

function statusStyle(status: DeliveryStatus) {
  if (status === "Received" || status === "Available") return "bg-emerald-50 text-emerald-700";
  if (status === "Ready") return "bg-amber-50 text-amber-700";
  if (status === "In Transit") return "bg-blue-50 text-blue-700";
  return "bg-sky-50 text-sky-700";
}

function statusDot(status: DeliveryStatus) {
  if (status === "Received" || status === "Available") return "bg-emerald-500";
  if (status === "Ready") return "bg-amber-500";
  if (status === "In Transit") return "bg-blue-500";
  return "bg-sky-500";
}

function Icon({ type }: { type: "truck" | "calendar" | "box" | "users" | "search" | "upload" | "note" | "check" }) {
  const common = "h-5 w-5";
  if (type === "calendar") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /></svg>;
  if (type === "box") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></svg>;
  if (type === "users") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (type === "search") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (type === "upload") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></svg>;
  if (type === "note") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6V3Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>;
  if (type === "check") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
  return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-2" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
}

function KpiCard({ title, value, subtitle, tone, icon }: { title: string; value: string; subtitle: string; tone: string; icon: "truck" | "calendar" | "box" | "users" }) {
  return <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"><div className="flex items-center gap-4"><div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", tone)}><Icon type={icon} /></div><div><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p></div></div></div>;
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  return <span className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold", statusStyle(status))}><span className={cn("h-2 w-2 rounded-full", statusDot(status))} />{status}</span>;
}

export default function IncomingDeliveriesPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState("");

  async function loadRows() {
    const res = await fetch("/api/incoming-deliveries", { cache: "no-store" });
    const data: unknown = await res.json();
    setRows(Array.isArray(data) ? (data as MovementRow[]) : []);
  }

  useEffect(() => { loadRows().catch(console.error); }, []);

  const filters = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => normalizeStatus(row)).filter(Boolean)));
    return ["All", ...values];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = normalizeStatus(row);
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      const searchable = `${row.Supplier || ""} ${row.Description || ""} ${row.Specification || ""} ${row["Batch / Reference"] || ""}`.toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [rows, search, statusFilter]);

  const visibleRows = filteredRows.slice(0, 8);

  const summary = useMemo(() => {
    const suppliers = new Set(rows.map((row) => String(row.Supplier || "").trim()).filter(Boolean));
    const incomingToday = rows.filter((row) => relativeEta(String(row["Arrival Date"] || row["Upload Date"] || "")) === "Today").length;
    const inTransit = rows.filter((row) => normalizeStatus(row) === "In Transit").length;
    const ready = rows.filter((row) => ["Received", "Available", "Ready"].includes(normalizeStatus(row))).length;
    return { suppliers: suppliers.size, incomingToday, inTransit, ready };
  }, [rows]);

  const arrivals = useMemo(() => {
    const groups = new Map<string, { label: string; date: string; count: number }>();
    for (const row of rows) {
      const arrival = String(row["Arrival Date"] || row["Upload Date"] || "");
      const label = relativeEta(arrival);
      const key = label;
      if (!groups.has(key)) groups.set(key, { label, date: formatDate(arrival), count: 0 });
      const item = groups.get(key);
      if (item) item.count += 1;
    }
    return Array.from(groups.values()).slice(0, 4);
  }, [rows]);

  async function updateStatus(row: MovementRow, nextStatus: string) {
    const rowNumber = String(row["_rowNumber"] || "").trim();
    if (!rowNumber) {
      setMessage("This row has no row number, so it cannot be updated safely.");
      return;
    }

    setLoadingId(rowNumber);
    setMessage("");

    try {
      const res = await fetch("/api/incoming-deliveries/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowNumber, status: nextStatus }) });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(typeof data === "object" && data !== null && "error" in data ? String((data as ApiError).error) : "Failed to update status");
      setMessage(`Status updated to ${nextStatus}.`);
      await loadRows();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Failed to update status."));
    } finally {
      setLoadingId("");
    }
  }

  return (
    <section className="w-full space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-5"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon type="truck" /></div><div><h1 className="text-4xl font-bold tracking-tight text-slate-950">Incoming Deliveries</h1><p className="mt-2 max-w-3xl text-base text-slate-500">Track expected arrivals, receiving status, and supplier shipments.</p>{message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"><KpiCard title="Incoming Today" value={summary.incomingToday.toLocaleString()} subtitle="Deliveries expected" tone="bg-emerald-50 text-emerald-600" icon="calendar" /><KpiCard title="In Transit" value={summary.inTransit.toLocaleString()} subtitle="Shipments on the way" tone="bg-blue-50 text-blue-600" icon="truck" /><KpiCard title="Ready to Receive" value={summary.ready.toLocaleString()} subtitle="Awaiting receiving" tone="bg-amber-50 text-amber-600" icon="box" /><KpiCard title="Suppliers" value={summary.suppliers.toLocaleString()} subtitle="Active suppliers" tone="bg-violet-50 text-violet-600" icon="users" /></div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center"><div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-slate-400"><Icon type="search" /></span><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deliveries, suppliers, or items..." className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none">{filters.map((value) => <option key={value} value={value}>{value === "All" ? "All Statuses" : value}</option>)}</select></div><div className="flex items-center gap-3"><Link href="/add-delivery" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20">+ Add Delivery</Link><Link href="/upload-deliveries" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><Icon type="upload" />Import CSV</Link></div></div>

          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500"><tr><th className="px-5 py-4 font-semibold">ETA</th><th className="px-5 py-4 font-semibold">Supplier</th><th className="px-5 py-4 font-semibold">Item</th><th className="px-5 py-4 font-semibold">Qty</th><th className="px-5 py-4 font-semibold">Batch / Ref</th><th className="px-5 py-4 font-semibold">Status</th><th className="px-5 py-4 text-right font-semibold">Action</th></tr></thead><tbody>{visibleRows.map((row, index) => { const rowNumber = String(row["_rowNumber"] || index); const currentStatus = normalizeStatus(row); const arrival = String(row["Arrival Date"] || row["Upload Date"] || ""); return <tr key={rowNumber} className="border-b border-slate-100 last:border-b-0"><td className="px-5 py-4"><div className="flex items-start gap-3"><span className="mt-0.5 text-slate-400"><Icon type="calendar" /></span><div><p className="font-semibold text-slate-900">{formatDate(arrival)}</p><p className="mt-1 text-xs font-medium text-slate-500">{relativeEta(arrival)}</p></div></div></td><td className="px-5 py-4"><p className="max-w-[170px] font-semibold text-slate-900">{row.Supplier || "—"}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-900">{row.Description || "—"}</p><p className="mt-1 text-xs font-medium text-slate-500">{row.Specification || ""}</p></td><td className="px-5 py-4 font-semibold text-slate-900">{toNumber(row["Qty Added"]).toLocaleString()}</td><td className="px-5 py-4"><p className="max-w-[150px] font-medium text-slate-600">{row["Batch / Reference"] || "—"}</p></td><td className="px-5 py-4"><StatusBadge status={currentStatus} /></td><td className="px-5 py-4 text-right"><select defaultValue="" disabled={loadingId === rowNumber} onChange={(event) => { void updateStatus(row, event.target.value); event.currentTarget.value = ""; }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50"><option value="" disabled>{loadingId === rowNumber ? "Updating..." : "•••"}</option>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td></tr>; })}{!visibleRows.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No delivery records found.</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm font-medium text-slate-500"><span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filteredRows.length} deliveries</span><span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-700">1</span></div>
        </div>

        <aside className="space-y-5"><div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"><div className="mb-5 flex items-center gap-3"><span className="text-slate-500"><Icon type="calendar" /></span><h2 className="text-lg font-bold text-slate-950">Upcoming Arrivals</h2></div><div className="space-y-4">{arrivals.map((item) => <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"><div><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.date}</p></div><div className="text-right"><p className="text-2xl font-bold text-slate-950">{item.count}</p><p className="text-xs text-slate-500">Deliveries</p></div></div>)}</div></div><div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"><div className="mb-5 flex items-center gap-3"><span className="text-slate-500"><Icon type="note" /></span><h2 className="text-lg font-bold text-slate-950">Delivery Notes</h2></div><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon type="check" /></span><div><p className="font-semibold text-slate-900">All deliveries are up to date.</p><p className="mt-1 text-sm text-slate-500">No delays or issues reported.</p></div></div></div></aside>
      </div>
    </section>
  );
}
