"use client";

import { useEffect, useMemo, useState } from "react";

type ExpenseRow = {
  Date: string;
  Category: string;
  Description: string;
  Amount: number;
  Reference: string;
  Source: string;
  Notes: string;
};

function currency(value: number) {
  return `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [message, setMessage] = useState("");

  async function loadRows() {
    const res = await fetch("/api/expenses", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load expenses");
    }
    setRows(Array.isArray(data.rows) ? data.rows : []);
  }

  useEffect(() => {
    loadRows().catch((error: any) => {
      setMessage(error?.message || "Failed to load expenses.");
    });
  }, []);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0),
    [rows]
  );

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-600">
          Combined expense view from the regular Expenses ledger and Supplier Invoice Costs.
        </p>
        <div className="mt-4 text-sm text-slate-700">
          Total Recorded Expenses: <span className="font-semibold">{currency(total)}</span>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Expense Ledger</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Description</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Reference</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Source</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.Source}-${row.Reference}-${index}`} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">{row.Date}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Category}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Description}</td>
                  <td className="px-4 py-3 text-slate-700">{currency(Number(row.Amount) || 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Reference}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Source}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Notes}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No expenses recorded yet.
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
