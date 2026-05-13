"use client";

import { useEffect, useMemo, useState } from "react";

type AccountingReport = {
  reportId: string;
  reportDate: string;
  salesmanName: string;
  route: string;
  vehicleNo: string;
  cashSales: number;
  collectionsTotal: number;
  approvedExpenses: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  invoiceScanCount: number;
  expenseReceiptCount: number;
  returnCount: number;
  status: string;
  accountingReviewStatus: string;
  createdAt: string;
  notes: string;
};

type AccountingResponse = {
  ok: boolean;
  reports: AccountingReport[];
  totals: {
    cashSales: number;
    collectionsTotal: number;
    approvedExpenses: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
    varianceCount: number;
  };
  error?: string;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AccountingReviewPage() {
  const [data, setData] = useState<AccountingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/accounting-reports", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load accounting reports.");
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load accounting reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const reports = data?.reports || [];
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        report.reportId.toLowerCase().includes(q) ||
        report.salesmanName.toLowerCase().includes(q) ||
        report.route.toLowerCase().includes(q) ||
        report.reportDate.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "All" || report.accountingReviewStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [reports, query, statusFilter]);

  const totals = data?.totals || {
    cashSales: 0,
    collectionsTotal: 0,
    approvedExpenses: 0,
    expectedCash: 0,
    actualCash: 0,
    variance: 0,
    varianceCount: 0,
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Internal Accounting Control</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Accounting Review</h1>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Review daily salesman liquidation reports from Google Sheets. This page is for internal auditing, liquidation, and accounting reconciliation only.
            </p>
          </div>
          <button onClick={loadReports} disabled={loading} className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
            {loading ? "Loading..." : "Refresh Reports"}
          </button>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cash Sales</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(totals.cashSales)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Collections</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(totals.collectionsTotal)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Approved Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(totals.approvedExpenses)}</p>
        </div>
        <div className={`rounded-3xl border p-5 shadow-sm ${totals.varianceCount ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className={`text-sm font-medium ${totals.varianceCount ? "text-red-700" : "text-emerald-700"}`}>Variance Reports</p>
          <p className={`mt-2 text-2xl font-semibold ${totals.varianceCount ? "text-red-800" : "text-emerald-800"}`}>{totals.varianceCount}</p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Submitted Daily Reports</h2>
            <p className="mt-1 text-sm text-slate-500">Search by report ID, salesman, route, or date.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports..." className="rounded-2xl border border-slate-300 px-4 py-2 text-sm" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm">
              <option value="All">All Statuses</option>
              <option value="For Review">For Review</option>
              <option value="Variance Flagged">Variance Flagged</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1100px] w-full border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Salesman</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Cash Sales</th>
                <th className="px-4 py-3 text-right">Collections</th>
                <th className="px-4 py-3 text-right">Expenses</th>
                <th className="px-4 py-3 text-right">Expected Cash</th>
                <th className="px-4 py-3 text-right">Actual Cash</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Loading reports...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No reports found.</td></tr>
              ) : (
                filteredReports.map((report) => {
                  const hasVariance = Math.abs(report.variance) > 0.009;
                  return (
                    <tr key={report.reportId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{report.reportDate}</td>
                      <td className="px-4 py-3 font-medium text-slate-950">{report.reportId}</td>
                      <td className="px-4 py-3 text-slate-700">{report.salesmanName}</td>
                      <td className="px-4 py-3 text-slate-700">{report.route}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{money(report.cashSales)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{money(report.collectionsTotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{money(report.approvedExpenses)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-950">{money(report.expectedCash)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-950">{money(report.actualCash)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${hasVariance ? "text-red-700" : "text-emerald-700"}`}>{money(report.variance)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasVariance ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {report.accountingReviewStatus || report.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
