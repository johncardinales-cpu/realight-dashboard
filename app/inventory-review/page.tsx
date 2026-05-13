"use client";

import { useEffect, useMemo, useState } from "react";

type InventoryRow = Record<string, string | number>;
type InventoryStatus = "In Stock" | "Low Stock" | "Incoming" | "Out of Stock";

type ApiError = {
  error?: unknown;
};

const LOW_STOCK_THRESHOLD = 10;

function qty(row: InventoryRow, key: string) {
  return Number(row[key] || 0) || 0;
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

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | number | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

export default function InventoryReviewPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [message, setMessage] = useState("Loading inventory review...");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadRows() {
    setMessage("Loading inventory review...");
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error(typeof data === "object" && data !== null && "error" in data ? String((data as ApiError).error) : "Failed to load inventory");
      }
      setRows(Array.isArray(data) ? (data as InventoryRow[]) : []);
      setMessage("");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Failed to load inventory review."));
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const summary = useMemo(() => {
    return {
      skus: rows.length,
      onHand: rows.reduce((total, row) => total + qty(row, "Actual On Hand"), 0),
      sellable: rows.reduce((total, row) => total + qty(row, "Sellable Qty"), 0),
      sold: rows.reduce((total, row) => total + qty(row, "Sold Qty"), 0),
      damaged: rows.reduce((total, row) => total + qty(row, "Damaged Qty"), 0),
      incoming: rows.reduce((total, row) => total + qty(row, "Incoming Qty"), 0),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => `${String(a["Description"] || "")} ${String(a["Specification"] || "")}`.localeCompare(`${String(b["Description"] || "")} ${String(b["Specification"] || "")}`))
      .filter((row) => {
        const status = getStatus(row);
        const text = `${String(row["Description"] || "")} ${String(row["Specification"] || "")}`.toLowerCase();
        return (statusFilter === "All" || status === statusFilter) && (!query || text.includes(query));
      });
  }, [rows, search, statusFilter]);

  return (
    <section className="w-full space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">Confirmed sales inventory review</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">Inventory Review</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              This review view exposes the Sold Qty from confirmed sales beside On Hand, Sellable, Damaged, and Incoming inventory.
            </p>
            {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
          </div>
          <button type="button" onClick={() => void loadRows()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total SKUs" value={summary.skus} note="Inventory items" />
        <KpiCard label="On Hand" value={summary.onHand} note="After confirmed sales" />
        <KpiCard label="Sellable" value={summary.sellable} note="Available to sell" />
        <KpiCard label="Sold" value={summary.sold} note="Confirmed sales only" />
        <KpiCard label="Damaged" value={summary.damaged} note="Removed from sellable" />
        <KpiCard label="Incoming" value={summary.incoming} note="Expected units" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item or specification..."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none lg:max-w-md"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
          >
            <option>All</option>
            <option>In Stock</option>
            <option>Low Stock</option>
            <option>Incoming</option>
            <option>Out of Stock</option>
          </select>
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
                <th className="px-5 py-4 font-semibold">Sold</th>
                <th className="px-5 py-4 font-semibold">Damaged</th>
                <th className="px-5 py-4 font-semibold">Incoming</th>
                <th className="px-5 py-4 font-semibold">Latest Received</th>
                <th className="px-5 py-4 font-semibold">Latest Incoming</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const description = String(row["Description"] || "");
                const specification = String(row["Specification"] || "");
                return (
                  <tr key={`${description}|||${specification}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-slate-950">{description}</td>
                    <td className="px-5 py-4 text-slate-600">{specification}</td>
                    <td className="px-5 py-4"><StatusBadge status={getStatus(row)} /></td>
                    <td className="px-5 py-4 font-bold text-slate-950">{qty(row, "Actual On Hand")}</td>
                    <td className="px-5 py-4 font-bold text-slate-950">{qty(row, "Sellable Qty")}</td>
                    <td className="px-5 py-4 font-bold text-indigo-700">{qty(row, "Sold Qty")}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">{qty(row, "Damaged Qty")}</td>
                    <td className="px-5 py-4 font-bold text-blue-600">{qty(row, "Incoming Qty")}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(row["Latest Received"])}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(row["Latest Incoming"])}</td>
                  </tr>
                );
              })}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-500">No inventory rows found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
