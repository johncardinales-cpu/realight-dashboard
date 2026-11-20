"use client";

import { useState } from "react";

type WatchFinding = { severity: string; code: string; adjustmentId?: string; message: string };
type WatchResult = {
  status: string; checkedAt: string; checkedAdjustments: number; findings: WatchFinding[]; message: string;
};

export default function InventoryWatchPanel() {
  const [result, setResult] = useState<WatchResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function runCheck() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/agents/inventory-watch", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Inventory watch unavailable");
      setResult(payload);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Inventory watch unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Inventory Error Watch Agent</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Adjustment Ledger &amp; Audit Integrity</h2>
          <p className="mt-1 text-sm text-slate-600">Checks recorded adjustments and their audit entries without changing stock. The separate Vercel error watch checks hourly runtime failures.</p>
        </div>
        <button type="button" onClick={() => void runCheck()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Checking..." : "Check Inventory Errors"}</button>
      </div>
      {error ? <p role="alert" className="mt-4 text-sm font-semibold text-rose-700">{error}</p> : null}
      {result ? <div className="mt-4 space-y-3">
        <p className="text-sm font-semibold">Status: {result.status} · {result.checkedAdjustments} adjustment(s) inspected · {result.findings.length} finding(s)</p>
        <p className="text-xs text-slate-500">{result.message} Checked {new Date(result.checkedAt).toLocaleString()}.</p>
        {result.findings.map((finding, i) => <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span className="font-bold">{finding.severity.toUpperCase()} — {finding.code}</span>
          <p>{finding.message} {finding.adjustmentId ? `(${finding.adjustmentId})` : ""}</p>
        </div>)}
      </div> : null}
    </section>
  );
}
