"use client";

import { useEffect, useMemo, useState } from "react";

type HistoryEvent = {
  id: string;
  date: string;
  type: string;
  source: string;
  reference: string;
  supplier?: string;
  customerName?: string;
  description: string;
  specification: string;
  qtyIn: number;
  qtyOut: number;
  status: string;
  movementQty: number;
  runningQty: number;
  unitCostUsd: number;
  invoiceValid: string;
  notes: string;
  createdAt: string;
};

function money(value: number) {
  return `$${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InventoryHistoryPage() {
  const [rows, setRows] = useState<HistoryEvent[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRows() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/inventory-history", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load inventory history");
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load inventory history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRows().catch(console.error); }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => [row.date, row.type, row.reference, row.supplier, row.customerName, row.description, row.specification, row.status, row.notes].join(" ").toLowerCase().includes(needle));
  }, [rows, query]);

  const summary = useMemo(() => {
    return rows.reduce((acc, row) => {
      acc.qtyIn += Number(row.qtyIn) || 0;
      acc.qtyOut += Number(row.qtyOut) || 0;
      if (row.status.toLowerCase().includes("pending") || row.status.toLowerCase() === "incoming") acc.pending += Number(row.qtyIn) || 0;
      return acc;
    }, { qtyIn: 0, qtyOut: 0, pending: 0 });
  }, [rows]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Inventory History</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Trace every product from supplier upload, expected arrival, status changes, and confirmed sales deductions.</p>
          </div>
          <button type="button" onClick={loadRows} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">{loading ? "Loading..." : "Refresh"}</button>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Total Qty In</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.qtyIn.toLocaleString()}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Total Qty Out</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.qtyOut.toLocaleString()}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Pending / Incoming Qty</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.pending.toLocaleString()}</p></div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Movement Ledger</h2>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, supplier, ref, status..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 md:max-w-md" />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>{["Date", "Type", "Reference", "Supplier / Customer", "Description", "Specification", "Qty In", "Qty Out", "Running Qty", "Status", "Unit Cost", "Notes"].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3 text-left font-medium">{head}</th>)}</tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.date || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{row.type}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.reference || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.supplier || row.customerName || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{row.qtyIn || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-rose-700">{row.qtyOut || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{row.runningQty}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.unitCostUsd ? money(row.unitCostUsd) : "-"}</td>
                  <td className="min-w-[260px] px-4 py-3 text-slate-600">{row.notes}</td>
                </tr>
              ))}
              {!filteredRows.length && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No inventory history found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
