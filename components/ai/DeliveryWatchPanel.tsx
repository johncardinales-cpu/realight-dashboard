"use client";

import { useState } from "react";

type Finding = { severity: string; code: string; eventId?: string; message: string };
type Result = { status: string; checkedAt: string; checkedEvents: number; findings: Finding[]; message: string };

export default function DeliveryWatchPanel() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/agents/delivery-watch", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value?.error || "Delivery monitoring is unavailable.");
      setResult(value);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to check delivery actions.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Delivery Error Watch Agent</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Canceled Delivery &amp; Notes Audit</h2>
          <p className="mt-1 text-sm text-slate-600">Read-only review for missing action notes, duplicate events and missing audit entries. No changes are made automatically.</p>
        </div>
        <button type="button" onClick={() => void check()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Checking..." : "Check Delivery Actions"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
      {result ? <div className="mt-3 space-y-3">
        <p className="text-sm font-semibold">Status: {result.status} · {result.checkedEvents} action(s) reviewed · {result.findings.length} finding(s)</p>
        <p className="text-xs text-slate-500">{result.message} Checked {new Date(result.checkedAt).toLocaleString()}.</p>
        {result.findings.map((finding, index) => (
          <div key={index} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <strong>{finding.severity.toUpperCase()} — {finding.code}</strong>
            <p>{finding.message}{finding.eventId ? ` (${finding.eventId})` : ""}</p>
          </div>
        ))}
      </div> : null}
    </section>
  );
}
