"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InventoryRow = Record<string, string | number>;
type InventoryStatus = "In Stock" | "Low Stock" | "Incoming" | "Out of Stock";

const LOW_STOCK_THRESHOLD = 10;

function qty(row: InventoryRow, key: string) {
  return Number(row[key] || 0) || 0;
}

function rowKey(row: InventoryRow) {
  return `${String(row["Description"] || "")}|||${String(row["Specification"] || "")}`;
}

function getStatus(row: InventoryRow): InventoryStatus {
  const actualOnHand = qty(row, "Actual On Hand");
  const sellable = qty(row, "Sellable Qty");
  const incoming = qty(row, "Incoming Qty");
  const minimumBuffer = qty(row, "Minimum Buffer");

  if (actualOnHand <= 0 && incoming > 0) return "Incoming";
  if (actualOnHand <= 0 && sellable <= 0) return "Out of Stock";
  if (minimumBuffer > 0 && sellable <= minimumBuffer) return "Low Stock";
  if (sellable > 0 && sellable < LOW_STOCK_THRESHOLD) return "Low Stock";
  return "In Stock";
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const className = {
    "In Stock": "bg-emerald-50 text-emerald-700",
    "Low Stock": "bg-amber-50 text-amber-700",
    Incoming: "bg-blue-50 text-blue-700",
    "Out of Stock": "bg-rose-50 text-rose-700",
  }[status];

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{status}</span>;
}

function KpiCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{note}</p>
    </div>
  );
}

export default function InventoryCleanPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [message, setMessage] = useState("Loading inventory...");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadRows() {
    setMessage("Loading inventory...");
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load inventory");
      setRows(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load inventory.");
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const summary = useMemo(() => ({
    skus: rows.length,
    onHand: rows.reduce((sum, row) => sum + qty(row, "Actual On Hand"), 0),
    sellable: rows.reduce((sum, row) => sum + qty(row, "Sellable Qty"), 0),
    damaged: rows.reduce((sum, row) => sum + qty(row, "Damaged Qty"), 0),
    incoming: rows.reduce((sum, row) => sum + qty(row, "Incoming Qty"), 0),
    lowStock: rows.filter((row) => ["Low Stock", "Out of Stock"].includes(getStatus(row))).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => {
        const rank: Record<InventoryStatus, number> = { "Out of Stock": 0, "Low Stock": 1, Incoming: 2, "In Stock": 3 };
        const statusDiff = rank[getStatus(a)] - rank[getStatus(b)];
        if (statusDiff !== 0) return statusDiff;
        return `${String(a["Description"] || "")} ${String(a["Specification"] || "")}`.localeCompare(`${String(b["Description"] || "")} ${String(b["Specification"] || "")}`);
      })
      .filter((row) => {
        const status = getStatus(row);
        const text = `${String(row["Description"] || "")} ${String(row["Specification"] || "")}`.toLowerCase();
        return (statusFilter === "All" || status === statusFilter) && (!query || text.includes(query));
      });
  }, [rows, search, statusFilter]);

  const attentionRows = useMemo(() => rows.filter((row) => ["Low Stock", "Out of Stock", "Incoming"].includes(getStatus(row))).slice(0, 6), [rows]);

  return (
    <section className="w-full space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Clean Stock Dashboard</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">Inventory</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Read-only stock view. Available means received and ready to sell. Incoming and receiving dates are managed from Incoming Deliveries only.
            </p>
            {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={loadRows} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
            <Link href="/incoming-deliveries" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Manage Deliveries</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total SKUs" value={summary.skus} note="Inventory items" />
        <KpiCard label="On Hand" value={summary.onHand} note="Available minus confirmed sales" />
        <KpiCard label="Sellable" value={summary.sellable} note="Ready to sell" />
        <KpiCard label="Damaged" value={summary.damaged} note="Not sellable" />
        <KpiCard label="Incoming" value={summary.incoming} note="Not yet received" />
        <KpiCard label="Low Stock" value={summary.lowStock} note={`Below ${LOW_STOCK_THRESHOLD} sellable units`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or specification..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none lg:w-96" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none">
                <option>All</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Incoming</option>
                <option>Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Item</th>
                  <th className="px-5 py-4 font-semibold">Specification</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">On Hand</th>
                  <th className="px-5 py-4 font-semibold">Sellable</th>
                  <th className="px-5 py-4 font-semibold">Damaged</th>
                  <th className="px-5 py-4 font-semibold">Incoming</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-slate-950">{String(row["Description"] || "")}</td>
                    <td className="px-5 py-4 text-slate-600">{String(row["Specification"] || "")}</td>
                    <td className="px-5 py-4"><StatusBadge status={getStatus(row)} /></td>
                    <td className="px-5 py-4 font-bold text-slate-950">{qty(row, "Actual On Hand")}</td>
                    <td className="px-5 py-4 font-bold text-slate-950">{qty(row, "Sellable Qty")}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">{qty(row, "Damaged Qty")}</td>
                    <td className="px-5 py-4 font-bold text-blue-600">{qty(row, "Incoming Qty")}</td>
                  </tr>
                ))}
                {!filteredRows.length ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No inventory rows found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Needs Attention</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Low stock, out of stock, and incoming items</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-600">{attentionRows.length}</span>
          </div>
          <div className="space-y-3">
            {attentionRows.map((row) => (
              <div key={rowKey(row)} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{String(row["Description"] || "")}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {getStatus(row) === "Incoming" ? `${qty(row, "Incoming Qty")} incoming` : `${qty(row, "Sellable Qty")} sellable left`}
                </p>
              </div>
            ))}
            {!attentionRows.length ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">No urgent inventory issues right now.</div> : null}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            Delivery dates belong in <strong>Incoming Deliveries</strong>. This page only shows current stock quantities.
          </div>
        </aside>
      </div>
    </section>
  );
}
