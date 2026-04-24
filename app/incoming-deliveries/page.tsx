"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementRow = Record<string, string>;

const statusOptions = ["Incoming", "In Transit", "Received", "Available"];
const headers = [
  "Upload Date",
  "Arrival Date",
  "Supplier",
  "Batch / Reference",
  "Description",
  "Specification",
  "Qty Added",
  "Unit Price (USD)",
  "Invoice Valid",
  "Status",
  "Notes",
  "Created At",
];

export default function IncomingDeliveriesPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState("");

  async function loadRows() {
    const res = await fetch("/api/incoming-deliveries", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const filters = useMemo(() => {
    const values = Array.from(
      new Set(
        rows
          .map((row) => String(row["Status"] || "").trim())
          .filter(Boolean)
      )
    );
    return ["All", ...values];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "All") return rows;
    return rows.filter(
      (row) => String(row["Status"] || "").trim() === statusFilter
    );
  }, [rows, statusFilter]);

  async function updateStatus(row: MovementRow, nextStatus: string) {
    const rowNumber = String(row["_rowNumber"] || "").trim();
    if (!rowNumber) {
      setMessage("This row has no row number, so it cannot be updated safely.");
      return;
    }

    setLoadingId(rowNumber);
    setMessage("");

    try {
      const res = await fetch("/api/incoming-deliveries/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rowNumber,
          status: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update status");
      }

      setMessage(`Status updated to ${nextStatus}.`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update status.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Incoming Deliveries
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Delivery history and stock movement records from App_Deliveries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/add-delivery"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add Delivery
            </Link>
            <Link
              href="/upload-deliveries"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Upload CSV / Excel
            </Link>
            <label className="text-sm font-medium text-slate-700">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              {filters.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">
          Delivery Records
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {headers.map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {head}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const rowNumber = String(row["_rowNumber"] || "").trim();
                const currentStatus = String(row["Status"] || "").trim();

                return (
                  <tr key={rowNumber || idx} className="border-t border-slate-100 align-top">
                    {headers.map((head) => (
                      <td key={head} className="px-4 py-3 text-slate-700">
                        {row[head]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-wrap gap-2 min-w-[260px]">
                        {statusOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={loadingId === rowNumber || currentStatus === option}
                            onClick={() => updateStatus(row, option)}
                            className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                          >
                            {loadingId === rowNumber ? "Updating..." : option}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No delivery records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
