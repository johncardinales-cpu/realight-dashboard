"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementRow = Record<string, string>;

const statusOptions = ["Incoming", "In Transit", "Received", "Available"];

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

  const headers = rows.length ? Object.keys(rows[0]) : [];

  const statusKey =
    headers.find((h) => h.toLowerCase().includes("status")) || "";

  const createdAtKey =
    headers.find((h) => h.toLowerCase().includes("created at")) || "Created At";

  const filters = useMemo(() => {
    if (!statusKey) return ["All"];
    const values = Array.from(
      new Set(
        rows
          .map((row) => String(row[statusKey] || "").trim())
          .filter(Boolean)
      )
    );
    return ["All", ...values];
  }, [rows, statusKey]);

  const filteredRows = useMemo(() => {
    if (!statusKey || statusFilter === "All") return rows;
    return rows.filter(
      (row) => String(row[statusKey] || "").trim() === statusFilter
    );
  }, [rows, statusFilter, statusKey]);

  async function updateStatus(row: MovementRow, nextStatus: string) {
    const createdAt = String(row[createdAtKey] || "").trim();
    if (!createdAt) {
      setMessage("This row has no Created At value, so it cannot be updated safely.");
      return;
    }

    setLoadingId(createdAt);
    setMessage("");

    try {
      const res = await fetch("/api/incoming-deliveries/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          createdAt,
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
                  <th key={head} className="px-4 py-3 text-left font-medium">
                    {head}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const createdAt = String(row[createdAtKey] || "").trim();
                const currentStatus = String(row[statusKey] || "").trim();

                return (
                  <tr key={createdAt || idx} className="border-t border-slate-100">
                    {headers.map((head) => (
                      <td key={head} className="px-4 py-3 text-slate-700">
                        {row[head]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={loadingId === createdAt || currentStatus === option}
                            onClick={() => updateStatus(row, option)}
                            className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                          >
                            {loadingId === createdAt && currentStatus !== option
                              ? "Updating..."
                              : option}
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
                    colSpan={Math.max(headers.length + 1, 1)}
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
