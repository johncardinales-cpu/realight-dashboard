"use client";

import { useEffect, useState } from "react";

type MovementRow = Record<string, string>;

export default function IncomingDeliveriesPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);

  useEffect(() => {
    fetch("/api/incoming-deliveries")
      .then((res) => res.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Incoming Deliveries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stock movement list from Google Sheets.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Stock Movement List</h2>

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
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {headers.map((head) => (
                    <td key={head} className="px-4 py-3 text-slate-700">
                      {row[head]}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
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
