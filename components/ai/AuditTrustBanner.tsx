"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditSnapshot = {
  generatedAt: string;
  health: "Balanced" | "Warning" | "Critical";
  summary: {
    totalSalesPhp: number;
    totalPaidPhp: number;
    totalBalancePhp: number;
    critical: number;
    warnings: number;
    info: number;
  };
};

const storageKey = "realights.auditTrustBanner";
const cacheMs = 60000;

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toneFor(health: string) {
  if (health === "Balanced") return {
    wrapper: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-600 text-white",
    title: "Safe to Trust Reports? YES",
    message: "No critical or warning accounting mismatch detected in the latest audit.",
  };
  if (health === "Warning") return {
    wrapper: "border-amber-200 bg-amber-50 text-amber-800",
    badge: "bg-amber-600 text-white",
    title: "Safe to Trust Reports? REVIEW FIRST",
    message: "Warnings were found. Review the AI Agents accounting audit before finalizing reports.",
  };
  return {
    wrapper: "border-rose-200 bg-rose-50 text-rose-800",
    badge: "bg-rose-600 text-white",
    title: "Safe to Trust Reports? NO",
    message: "Critical reconciliation issues were found. Stop and review before trusting reports.",
  };
}

function readCachedSnapshot() {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { savedAt: number; data: AuditSnapshot };
    if (!cached?.data || Date.now() - cached.savedAt > cacheMs) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveCachedSnapshot(data: AuditSnapshot) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}

export default function AuditTrustBanner() {
  const [data, setData] = useState<AuditSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAudit(force = false) {
    setError("");
    if (!force) {
      const cached = readCachedSnapshot();
      if (cached) {
        setData(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting-audit?t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Audit check failed.");
      const snapshot: AuditSnapshot = {
        generatedAt: payload.generatedAt,
        health: payload.health,
        summary: payload.summary,
      };
      setData(snapshot);
      saveCachedSnapshot(snapshot);
    } catch (nextError: any) {
      setError(nextError?.message || "Audit check unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit(false).catch(console.error);
  }, []);

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-black">Safe to Trust Reports? Audit unavailable</p>
            <p className="mt-1 font-semibold">{error}</p>
          </div>
          <button type="button" onClick={() => loadAudit(true).catch(console.error)} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white">Retry Audit</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
        {loading ? "Checking if reports are safe to trust..." : "Preparing audit check..."}
      </div>
    );
  }

  const tone = toneFor(data.health);
  return (
    <div className={`rounded-3xl border px-5 py-4 shadow-sm ${tone.wrapper}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${tone.badge}`}>{data.health}</span>
            <p className="text-base font-black">{tone.title}</p>
          </div>
          <p className="mt-1 text-sm font-semibold">{tone.message}</p>
          <p className="mt-1 text-xs font-semibold opacity-80">Last audit: {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <span>Critical: {data.summary.critical}</span>
          <span>Warnings: {data.summary.warnings}</span>
          <span>Receivables: {money(data.summary.totalBalancePhp)}</span>
          <Link href="/ai-agents" className="rounded-xl border border-current px-4 py-2">Open AI Agents Audit</Link>
          <button type="button" onClick={() => loadAudit(true).catch(console.error)} disabled={loading} className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:opacity-60">{loading ? "Checking..." : "Refresh Audit"}</button>
        </div>
      </div>
    </div>
  );
}
