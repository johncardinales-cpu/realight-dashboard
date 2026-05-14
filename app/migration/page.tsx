"use client";

import { useEffect, useState } from "react";

type MigrationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

type MigrationStatus = {
  salesRows: number;
  paymentsRows: number;
  auditRows: number;
  missingSaleIds: number;
  missingPaymentIds: number;
  missingPaymentSaleLinks: number;
  validationIssues: MigrationIssue[];
  errorCount: number;
  warningCount: number;
  migrationReady: boolean;
  recommendedDatabase: string;
  futureTables: string[];
};

const exports = [
  { label: "Sales", type: "sales" },
  { label: "Sale Items", type: "sale_items" },
  { label: "Payments", type: "payments" },
  { label: "Expenses", type: "expenses" },
  { label: "Deliveries", type: "deliveries" },
  { label: "Pricing", type: "pricing" },
  { label: "Inventory Movements", type: "inventory_movements" },
  { label: "Audit Logs", type: "audit_logs" },
  { label: "Migration Manifest", type: "manifest" },
];

function StatusCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function MigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/migration", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load migration status");
      setStatus(data);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load migration status.");
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setMessage("");
    try {
      const res = await fetch("/api/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backfill" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Backfill failed");
      setStatus(data.status);
      setMessage(`Backfill complete. Updated ${data.salesResult?.updatedRows || 0} sales row(s) and ${data.paymentsResult?.updatedRows || 0} payment row(s).`);
    } catch (error: any) {
      setMessage(error?.message || "Backfill failed.");
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    loadStatus().catch(console.error);
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Migration Readiness</h1>
            <p className="mt-1 text-sm text-slate-600">
              Prepare Google Sheets data for a future Supabase/Postgres migration with stable IDs, audit logs, validation checks, and export-ready files.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={loadStatus} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
              {loading ? "Checking..." : "Refresh Status"}
            </button>
            <button type="button" onClick={runBackfill} disabled={backfilling} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {backfilling ? "Backfilling..." : "Backfill Missing IDs"}
            </button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      {status ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className={`rounded-2xl px-4 py-3 text-sm font-bold ${status.migrationReady ? "bg-emerald-50 text-emerald-700" : status.errorCount > 0 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
              {status.migrationReady
                ? "Migration-ready for core Sales and Payments records. Warnings, if any, should still be reviewed before final database cutover."
                : status.errorCount > 0
                  ? "Migration has blocking validation errors. Fix errors before database cutover."
                  : "Migration preparation still needs attention. Run backfill and review warnings."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard label="Sales Rows" value={status.salesRows} helper="Valid sales line items" />
            <StatusCard label="Payment Rows" value={status.paymentsRows} helper="Payment ledger records" />
            <StatusCard label="Audit Rows" value={status.auditRows} helper="Action history records" />
            <StatusCard label="Database Target" value={status.recommendedDatabase} helper="Recommended future backend" />
            <StatusCard label="Missing Sale IDs" value={status.missingSaleIds} helper="Must be 0 before migration" />
            <StatusCard label="Missing Payment IDs" value={status.missingPaymentIds} helper="Must be 0 before migration" />
            <StatusCard label="Unlinked Payments" value={status.missingPaymentSaleLinks} helper="Review before final cutover" />
            <StatusCard label="Validation" value={`${status.errorCount} errors / ${status.warningCount} warnings`} helper="Errors block migration" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Validation Issues</h2>
            <p className="mt-1 text-sm text-slate-600">Errors must be fixed before migration. Warnings should be reviewed but may not block staging import.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Severity</th>
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {status.validationIssues?.map((issue) => (
                    <tr key={`${issue.code}-${issue.message}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${issue.severity === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{issue.severity}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{issue.code}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.message}</td>
                    </tr>
                  ))}
                  {!status.validationIssues?.length && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No validation issues found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Export Database Files</h2>
              <p className="mt-1 text-sm text-slate-600">Use these files for backup, staging import, or final Supabase/Postgres migration.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {exports.map((item) => (
                  <a key={item.type} href={`/api/migration?export=${item.type}`} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Export {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Future Database Tables</h2>
              <p className="mt-1 text-sm text-slate-600">Recommended Supabase/Postgres table structure.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {status.futureTables.map((table) => (
                  <span key={table} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{table}</span>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                Best migration path: backfill IDs, export all files plus manifest, import to staging tables, validate totals, then switch API routes from Google Sheets to Postgres while keeping the same frontend pages.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
