"use client";

import { useEffect, useState } from "react";

type Issue = {
  severity: "critical" | "warning" | "info";
  area: string;
  record: string;
  message: string;
  expected?: string;
  actual?: string;
};

type AuditPayload = {
  generatedAt: string;
  health: "Balanced" | "Warning" | "Critical";
  summary: {
    totalSalesPhp: number;
    totalPaidPhp: number;
    totalBalancePhp: number;
    totalCreditPhp: number;
    critical: number;
    warnings: number;
    info: number;
  };
  issues: Issue[];
  customerSummaries: Array<{
    customerName: string;
    totalSalesPhp: number;
    paidPhp: number;
    balancePhp: number;
    orderCount: number;
    creditPhp: number;
  }>;
  inventory: Array<{
    description: string;
    specification: string;
    availableQty: number;
    damagedQty: number;
    soldQty: number;
    remainingQty: number;
    status: string;
  }>;
  restorePoint: { status: string; dailyAutomationVerified: boolean; note: string };
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusColor(value: string) {
  if (value === "Balanced" || value === "balanced") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Warning" || value === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default function AccountingAuditPanel() {
  const [data, setData] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAudit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/accounting-audit?t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to run accounting audit.");
      setData(payload);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to run accounting audit.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAudit().catch(console.error);
  }, []);

  const customers = (data?.customerSummaries || []).filter((row) => row.balancePhp > 0 || row.creditPhp > 0).slice(0, 8);
  const inventory = (data?.inventory || []).filter((row) => row.soldQty > 0).slice(0, 8);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Accounting Audit Agent</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Sales, Payments, Receivables and Inventory Guard</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">Runs reconciliation checks so reports do not silently double-count payments or show wrong balances.</p>
        </div>
        <button type="button" onClick={() => runAudit().catch(console.error)} disabled={loading} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Running Audit..." : "Run Audit"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      {data ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-4 py-2 text-sm font-bold ${statusColor(data.health)}`}>System Health: {data.health}</span>
            <span className="text-xs font-semibold text-slate-500">Last audit: {new Date(data.generatedAt).toLocaleString()}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${data.restorePoint.dailyAutomationVerified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>Restore Point: {data.restorePoint.status}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Sales / Charges" value={money(data.summary.totalSalesPhp)} />
            <Stat label="Paid" value={money(data.summary.totalPaidPhp)} />
            <Stat label="Receivables" value={money(data.summary.totalBalancePhp)} />
            <Stat label="Credits" value={money(data.summary.totalCreditPhp)} />
            <Stat label="Critical" value={String(data.summary.critical)} />
            <Stat label="Warnings" value={String(data.summary.warnings)} />
          </div>

          <div className="rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-950">Audit Findings</h3>
              <p className="text-xs font-semibold text-slate-500">{data.issues.length} finding(s)</p>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>{["Severity", "Area", "Record", "Finding", "Expected", "Actual"].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {data.issues.map((issue, index) => (
                    <tr key={`${issue.area}-${issue.record}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusColor(issue.severity)}`}>{issue.severity}</span></td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{issue.area}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.record}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.message}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.expected || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.actual || "-"}</td>
                    </tr>
                  ))}
                  {!data.issues.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-emerald-700">No accounting mismatch detected.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-950">Customer Reconciliation</h3>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>{["Customer", "Orders", "Total", "Paid", "Balance", "Credit"].map((head) => <th key={head} className="px-3 py-2 text-left font-semibold">{head}</th>)}</tr></thead>
                  <tbody>{customers.map((row) => <tr key={row.customerName} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-slate-900">{row.customerName}</td><td className="px-3 py-2">{row.orderCount}</td><td className="px-3 py-2">{money(row.totalSalesPhp)}</td><td className="px-3 py-2 text-emerald-700">{money(row.paidPhp)}</td><td className="px-3 py-2 font-bold text-rose-700">{money(row.balancePhp)}</td><td className="px-3 py-2 font-bold text-amber-700">{money(row.creditPhp)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-950">Inventory Movement Check</h3>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>{["Item", "Available", "Sold", "Remaining", "Status"].map((head) => <th key={head} className="px-3 py-2 text-left font-semibold">{head}</th>)}</tr></thead>
                  <tbody>{inventory.map((row) => <tr key={`${row.description}-${row.specification}`} className="border-t border-slate-100"><td className="px-3 py-2"><p className="font-semibold text-slate-900">{row.description}</p><p className="text-xs text-slate-500">{row.specification}</p></td><td className="px-3 py-2">{row.availableQty - row.damagedQty}</td><td className="px-3 py-2">{row.soldQty}</td><td className="px-3 py-2 font-semibold">{row.remainingQty}</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusColor(row.status.toLowerCase())}`}>{row.status}</span></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">{data.restorePoint.note}</p>
        </div>
      ) : null}
    </div>
  );
}
