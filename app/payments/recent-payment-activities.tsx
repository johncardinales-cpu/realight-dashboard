"use client";

import { useEffect, useMemo, useState } from "react";

type Activity = {
  id?: string;
  createdAt?: string;
  title?: string;
  note?: string;
  actor?: string;
  action?: string;
  recordRef?: string;
  time?: string;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateOnly(value: string | undefined) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return "";
}

function extractAmount(note: string | undefined) {
  const match = String(note || "").match(/payment\s+([0-9,]+(?:\.\d+)?)/i);
  return match ? Number(match[1].replace(/,/g, "")) || 0 : 0;
}

function isCreatePayment(activity: Activity) {
  const combined = `${activity.action || ""} ${activity.title || ""} ${activity.note || ""}`.toLowerCase();
  return combined.includes("create") && combined.includes("payment");
}

export default function RecentPaymentActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/recent-activity?t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      setActivities(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => setActivities([]));
  }, []);

  const paymentActivities = useMemo(() => activities.filter(isCreatePayment), [activities]);
  const total = useMemo(() => paymentActivities.reduce((sum, item) => sum + extractAmount(item.note), 0), [paymentActivities]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Recent Payment Activities</h2>
          <p className="mt-1 text-xs text-slate-500">Safety view for payments recorded in the audit log, including recent installments that may not appear in the ledger table yet.</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{paymentActivities.length} recent payment record(s) • {money(total)} shown</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
          {loading ? "Refreshing..." : "Refresh Activities"}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>{["Date", "Payment", "Amount", "Actor", "Age"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr>
          </thead>
          <tbody>
            {paymentActivities.map((item, index) => (
              <tr key={item.id || index} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">{dateOnly(item.createdAt) || "-"}</td>
                <td className="px-4 py-3 text-slate-700">{item.note || item.title || "Payment recorded"}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{money(extractAmount(item.note))}</td>
                <td className="px-4 py-3 text-slate-700">{item.actor || "Admin"}</td>
                <td className="px-4 py-3 text-slate-700">{item.time || "-"}</td>
              </tr>
            ))}
            {!paymentActivities.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No recent payment activities found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
