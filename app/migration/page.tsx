"use client";

import { useEffect, useState } from "react";

type MigrationStatus = {
  salesRows: number;
  paymentsRows: number;
  auditRows: number;
  missingSaleIds: number;
  missingPaymentIds: number;
  missingPaymentSaleLinks: number;
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
  { label: "Audit Logs", type: "audit_logs" },
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
              Prepare Google Sheets data for a future Supabase/Postgres migration with stable IDs, audit logs, and export-ready CSV files.
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
            <p className={`rounded-2xl px-4 py-3 text-sm font-bold ${status.migrationReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {status.migrationReady ? "Migration-ready for core Sales and Payments records." : "Migration preparation still needs attention. Run backfill and refresh status."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard label="Sales Rows" value={status.salesRows} helper="Valid sales line items" />
            <StatusCard label="Payment Rows" value={status.paymentsRows} helper="Payment ledger records" />
            <StatusCard label="Audit Rows" value={status.auditRows} helper="Action history records" />
            <StatusCard label="Database Target" value={status.recommendedDatabase} helper="Recommended future backend" />
            <StatusCard label="Missing Sale IDs" value={status.missingSaleIds} helper="Should be 0 before migration" />
            <StatusCard label="Missing Payment IDs" value={status.missingPaymentIds} helper="Should be 0 before migration" />
            <StatusCard label="Unlinked Payments" value={status.missingPaymentSaleLinks} helper="Old payments may need sale links" />
            <StatusCard label="Future Tables" value={status.futureTables.length} helper="Suggested database tables" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Export Database CSVs</h2>
              <p className="mt-1 text-sm text-slate-600">Use these files for backup or future Supabase/Postgres import.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {exports.map((item) => (
                  <a key={item.type} href={`/api/migration?export=${item.type}`} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Export {item.label} CSV
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
                Best migration path: export CSVs, import to Supabase staging tables, validate totals, then switch API routes from Google Sheets to Postgres while keeping the same frontend pages.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
