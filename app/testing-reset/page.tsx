"use client";

import { useEffect, useState } from "react";

type ResetStatus = {
  salesRows: number;
  paymentRows: number;
  auditRows: number;
  willKeepIntact: string[];
  willReset: string[];
  confirmationText: string;
};

export default function TestingResetPage() {
  const [status, setStatus] = useState<ResetStatus | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/testing-reset", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load reset status");
      setStatus(data);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load reset status.");
    } finally {
      setLoading(false);
    }
  }

  async function runReset() {
    const warning = "This will archive and clear Sales, Payments, and Audit_Log for a clean testing start. Inventory source data will stay intact. Continue?";
    if (!window.confirm(warning)) return;

    setResetting(true);
    setMessage("");
    try {
      const res = await fetch("/api/testing-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, actor: "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Reset failed");
      setConfirmation("");
      setMessage(`${data.message} Backups: ${data.backups?.backupSalesSheet}, ${data.backups?.backupPaymentsSheet}, ${data.backups?.backupAuditSheet}`);
      await loadStatus();
    } catch (error: any) {
      setMessage(error?.message || "Reset failed.");
    } finally {
      setResetting(false);
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
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-600">Testing Utility</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Reset Testing Data</h1>
            <p className="mt-1 text-sm text-slate-600">
              Archive and clear transaction test data so testing can restart from a clean state while keeping inventory source data intact.
            </p>
          </div>
          <button type="button" onClick={loadStatus} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
            {loading ? "Checking..." : "Refresh Status"}
          </button>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      {status ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Sales Rows to Clear</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{status.salesRows}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Payment Rows to Clear</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{status.paymentRows}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Audit Rows to Archive</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{status.auditRows}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-emerald-900">Will Stay Intact</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {status.willKeepIntact.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">{item}</span>)}
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-800">
                Inventory should return to starting stock because confirmed sales will be cleared, while delivery/pricing source data remains untouched.
              </p>
            </div>

            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-rose-900">Will Be Backed Up, Then Cleared</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {status.willReset.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700">{item}</span>)}
              </div>
              <p className="mt-4 text-sm leading-6 text-rose-800">
                Backup sheets will be created first, then these active sheets will be reset to headers only.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Run Reset</h2>
            <p className="mt-1 text-sm text-slate-600">
              Type <span className="font-bold text-slate-950">{status.confirmationText}</span> exactly to enable reset.
            </p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={status.confirmationText}
                className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={runReset}
                disabled={resetting || confirmation !== status.confirmationText}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:bg-slate-300 disabled:text-slate-600"
              >
                {resetting ? "Resetting..." : "Backup and Reset Test Data"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
