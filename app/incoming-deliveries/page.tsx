"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementRow = Record<string, string>;

export default function IncomingDeliveriesPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    fetch("/api/incoming-deliveries")
      .then((res) => res.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  const statusKey =
    headers.find((h) => h.toLowerCase().includes("status")) || "";

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

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Incoming Deliveries
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Delivery history and stock movement records from Google Sheets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/add-delivery"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add Delivery
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
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">
          Stock Movement List
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
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {headers.map((head) => (
                    <td key={head} className="px-4 py-3 text-slate-700">
                      {row[head]}
                    </td>
                  ))}
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={Math.max(headers.length, 1)}
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
