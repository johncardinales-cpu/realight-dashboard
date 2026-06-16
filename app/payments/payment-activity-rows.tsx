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
};

type Props = {
  start: string;
  end: string;
};

function peso(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateOnly(value: string | undefined) {
  const raw = String(value || "");
  return raw.length >= 10 ? raw.slice(0, 10) : "";
}

function readAmount(note: string | undefined) {
  const text = String(note || "");
  const marker = "Recorded payment ";
  const start = text.indexOf(marker);
  if (start < 0) return 0;
  const rest = text.slice(start + marker.length);
  const value = rest.split(" ")[0] || "";
  return Number(value.replace(/,/g, "")) || 0;
}

function readSaleRef(note: string | undefined, fallback: string | undefined) {
  const text = String(note || "");
  const marker = " for ";
  const start = text.lastIndexOf(marker);
  if (start < 0) return fallback || "Payment Activity";
  return text.slice(start + marker.length).trim() || fallback || "Payment Activity";
}

function isPaymentCreate(activity: Activity) {
  const text = `${activity.action || ""} ${activity.title || ""} ${activity.note || ""}`.toLowerCase();
  return text.includes("create") && text.includes("payment");
}

export default function PaymentActivityRows({ start, end }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetch(`/api/recent-activity?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => setActivities([]));
  }, []);

  const rows = useMemo(() => {
    return activities
      .filter(isPaymentCreate)
      .map((activity, index) => {
        const date = dateOnly(activity.createdAt);
        const amount = readAmount(activity.note);
        const salesRef = readSaleRef(activity.note, activity.recordRef);
        if (!date || date < start || date > end || amount <= 0) return null;
        return { activity, index, date, amount, salesRef };
      })
      .filter(Boolean) as Array<{ activity: Activity; index: number; date: string; amount: number; salesRef: string }>;
  }, [activities, start, end]);

  return (
    <>
      {rows.map(({ activity, index, date, amount, salesRef }) => (
        <tr key={activity.id || `pay-act-${index}`} className="border-t border-slate-100 bg-amber-50/30">
          <td className="px-4 py-3 text-slate-700">{date}</td>
          <td className="px-4 py-3 text-slate-700">{salesRef}</td>
          <td className="px-4 py-3 text-slate-700">{salesRef}</td>
          <td className="px-4 py-3 text-slate-700">Payment Activity Entry</td>
          <td className="px-4 py-3 text-slate-700">Payment</td>
          <td className="px-4 py-3 font-semibold text-slate-900">{peso(amount)}</td>
          <td className="px-4 py-3 text-slate-700">-</td>
          <td className="px-4 py-3 font-semibold text-slate-900">-</td>
          <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span></td>
          <td className="px-4 py-3 text-slate-700">-</td>
          <td className="px-4 py-3 text-slate-700">{activity.actor || "Admin"}</td>
          <td className="px-4 py-3 text-slate-700">{activity.note || "Recovered payment activity"}</td>
        </tr>
      ))}
    </>
  );
}
