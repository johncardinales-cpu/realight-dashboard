"use client";

import { useEffect, useMemo, useState } from "react";
import RecentPaymentActivities from "./recent-payment-activities";

type PaymentSummary = {
  key: string;
  saleId?: string;
  saleDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  totalSalePhp: number;
  totalPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
  paymentCount: number;
};

type PaymentHistory = {
  entryType: string;
  paymentDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  paymentMethod: string;
  amountPaidPhp: number;
  transactionRef: string;
  cashierName: string;
  notes: string;
  paymentStatus: string;
  totalSalePhp: number;
  runningPaidPhp: number;
  balanceAfterPhp: number;
  saleStatus: string;
  createdAt: string;
  paymentId: string;
  voidedAt?: string;
  voidReason?: string;
};

type HistoryMode = "daily" | "weekly" | "monthly" | "custom";

const paymentMethodOptions = ["Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function norm(value: string) {
  return String(value || "").trim().toLowerCase();
}

function toDate(value: string) {
  const raw = String(value || today()).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function fmt(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function periodRange(mode: HistoryMode, anchorValue: string) {
  const start = toDate(anchorValue);
  const end = new Date(start);
  if (mode === "weekly") {
    const day = start.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + offset);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  }
  if (mode === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1, 0);
  }
  return { start: fmt(start), end: fmt(end) };
}

function inRange(date: string, start: string, end: string) {
  const d = String(date || "").slice(0, 10);
  return d >= start && d <= end;
}

function isInactive(value: string) {
  return ["voided", "cancelled", "canceled"].includes(norm(value));
}

function isOpenBalance(row: PaymentSummary) {
  if (isInactive(row.saleStatus)) return false;
  return Number(row.balancePhp || 0) > 0;
}

function displayPaymentStatus(row: PaymentSummary) {
  const balance = Number(row.balancePhp || 0);
  const paid = Number(row.totalPaidPhp || 0);
  if (balance > 0 && paid > 0) return "Partial";
  if (balance > 0) return "Pending";
  return row.paymentStatus || "Paid";
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized === "paid" || normalized === "active" ? "bg-emerald-50 text-emerald-700" : normalized === "partial" ? "bg-amber-50 text-amber-700" : normalized === "confirmed" ? "bg-emerald-50 text-emerald-700" : isInactive(value) ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

export default function PaymentsPage() {
  const defaultHistoryRange = periodRange("monthly", today());
  const [rows, setRows] = useState<PaymentSummary[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountPaidPhp, setAmountPaidPhp] = useState(0);
  const [transactionRef, setTransactionRef] = useState("");
  const [cashierName, setCashierName] = useState("Admin");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyMode, setHistoryMode] = useState<HistoryMode>("monthly");
  const [historyDate, setHistoryDate] = useState(today());
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start);
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end);

  async function loadPayments() {
    const [summaryRes, historyRes] = await Promise.all([
      fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/payments?history=1&t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const summaryData = await summaryRes.json();
    const historyData = await historyRes.json();
    if (!summaryRes.ok) throw new Error(summaryData?.error || "Failed to load payment balances.");
    if (!historyRes.ok) throw new Error(historyData?.error || "Failed to load payment history.");
    setRows(Array.isArray(summaryData) ? summaryData : []);
    setHistory(Array.isArray(historyData) ? historyData : []);
  }

  async function refreshPayments() {
    setRefreshing(true);
    setIsError(false);
    setMessage("Refreshing payment balances...");
    try {
      await loadPayments();
      setMessage("Payment balances refreshed.");
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshPayments().catch((error) => {
      setIsError(true);
      setMessage(error?.message || "Failed to load payment balances.");
    });
  }, []);

  const openBalances = useMemo(() => rows.filter(isOpenBalance), [rows]);
  const selectedSale = useMemo(() => openBalances.find((row) => row.key === selectedKey), [openBalances, selectedKey]);
  const paymentAmount = Number(amountPaidPhp) || 0;
  const balanceAfterPayment = Math.max((selectedSale?.balancePhp || 0) - paymentAmount, 0);
  const activeHistoryRange = useMemo(() => historyMode === "custom" ? { start: historyStart, end: historyEnd } : periodRange(historyMode, historyDate), [historyMode, historyDate, historyStart, historyEnd]);
  const filteredHistory = useMemo(() => history.filter((entry) => inRange(entry.paymentDate, activeHistoryRange.start, activeHistoryRange.end)), [history, activeHistoryRange.start, activeHistoryRange.end]);
  const historyTotal = useMemo(() => filteredHistory.filter((entry) => !isInactive(entry.paymentStatus)).reduce((sum, entry) => sum + Number(entry.amountPaidPhp || 0), 0), [filteredHistory]);

  function selectSale(key: string) {
    const sale = openBalances.find((row) => row.key === key);
    setSelectedKey(key);
    setAmountPaidPhp(sale?.balancePhp || 0);
    setCashierName((current) => current || "Admin");
    setIsError(false);
    setMessage("");
  }

  function resetPaymentForm() {
    setSelectedKey("");
    setPaymentDate(today());
    setPaymentMethod("Cash");
    setAmountPaidPhp(0);
    setTransactionRef("");
    setCashierName("Admin");
    setNotes("");
  }

  function changeHistoryMode(mode: HistoryMode) {
    setHistoryMode(mode);
    if (mode !== "custom") {
      const range = periodRange(mode, historyDate);
      setHistoryStart(range.start);
      setHistoryEnd(range.end);
    }
  }

  function changeHistoryDate(value: string) {
    setHistoryDate(value);
    if (historyMode !== "custom") {
      const range = periodRange(historyMode, value);
      setHistoryStart(range.start);
      setHistoryEnd(range.end);
    }
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setIsError(false);
    setMessage("");
    try {
      if (!selectedSale) throw new Error("Select a sale with open balance first.");
      if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero.");
      if (paymentAmount > selectedSale.balancePhp) throw new Error(`Payment cannot exceed balance of ${money(selectedSale.balancePhp)}.`);
      const payload = { key: selectedSale.key, saleId: selectedSale.saleId || selectedSale.key, salesRefNo: selectedSale.salesRefNo, groupRef: selectedSale.groupRef, paymentDate, paymentMethod, amountPaidPhp: paymentAmount, transactionRef, cashierName: cashierName.trim() || "Admin", notes };
      const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save payment.");
      setIsError(false);
      setMessage(`Payment saved. ${data.paymentStatus} - remaining balance ${money(data.balancePhp)}.`);
      resetPaymentForm();
      await loadPayments();
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Payments</h1>
            <p className="mt-1 text-sm text-slate-600">Complete partial payments by selecting an existing sale, recording the payment, and updating the balance.</p>
            <p className="mt-1 text-xs text-slate-500">Payment history is filtered so installment records stay clean and easy to audit.</p>
          </div>
          <button type="button" onClick={refreshPayments} disabled={refreshing} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button>
        </div>
        {message ? <p className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Open Balances</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Total", "Paid", "Balance", "Payment", "Sale", "Action"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{openBalances.map((row) => <tr key={row.key} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{row.saleDate}</td><td className="px-4 py-3 text-slate-700">{row.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{row.customerName}</td><td className="px-4 py-3 text-slate-700">{money(row.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.totalPaidPhp)}</td><td className="px-4 py-3 font-bold text-slate-900">{money(row.balancePhp)}</td><td className="px-4 py-3"><StatusPill value={displayPaymentStatus(row)} /></td><td className="px-4 py-3"><StatusPill value={row.saleStatus} /></td><td className="px-4 py-3"><button type="button" onClick={() => selectSale(row.key)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm">Add Payment</button></td></tr>)}{!openBalances.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No open balances found.</td></tr>}</tbody></table></div>
        </div>
        <form onSubmit={savePayment} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Complete Payment</h2>
          <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={selectedKey} onChange={(e) => selectSale(e.target.value)}><option value="">Select sale with balance</option>{openBalances.map((row) => <option key={row.key} value={row.key}>{row.salesRefNo} - {row.customerName} - {money(row.balancePhp)}</option>)}</select>
          {selectedSale ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p><span className="font-semibold">Customer:</span> {selectedSale.customerName}</p><p><span className="font-semibold">Total Sale:</span> {money(selectedSale.totalSalePhp)}</p><p><span className="font-semibold">Already Paid:</span> {money(selectedSale.totalPaidPhp)}</p><p><span className="font-semibold">Current Balance:</span> {money(selectedSale.balancePhp)}</p><p><span className="font-semibold">Balance After Payment:</span> {money(balanceAfterPayment)}</p></div> : null}
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{paymentMethodOptions.map((method) => <option key={method} value={method}>{method}</option>)}</select>
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Amount Paid" value={amountPaidPhp} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Transaction / Receipt Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Cashier Name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="submit" disabled={saving || !selectedSale} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving Payment..." : "Save Payment"}</button>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Payment / Installment History</h2>
            <p className="mt-1 text-xs text-slate-500">Filtered audit trail for initial payments and installment collections.</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Showing {activeHistoryRange.start} to {activeHistoryRange.end} • {filteredHistory.length} record(s) • {money(historyTotal)} collected</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={historyMode} onChange={(e) => changeHistoryMode(e.target.value as HistoryMode)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom Range</option>
            </select>
            {historyMode === "custom" ? <><input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /><span className="text-xs font-bold text-slate-400">to</span><input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /></> : <input type="date" value={historyDate} onChange={(e) => changeHistoryDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Type", "Method", "Amount", "Running Paid", "Balance After", "Status", "Reference", "Cashier", "Notes"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead>
            <tbody>{filteredHistory.map((entry, index) => <tr key={`${entry.paymentId}-${entry.entryType}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{entry.paymentDate}</td><td className="px-4 py-3 text-slate-700">{entry.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{entry.customerName}</td><td className="px-4 py-3 text-slate-700">{entry.entryType}</td><td className="px-4 py-3 text-slate-700">{entry.paymentMethod}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(entry.amountPaidPhp)}</td><td className="px-4 py-3 text-slate-700">{money(entry.runningPaidPhp)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(entry.balanceAfterPhp)}</td><td className="px-4 py-3"><StatusPill value={entry.paymentStatus} /></td><td className="px-4 py-3 text-slate-700">{entry.transactionRef || "-"}</td><td className="px-4 py-3 text-slate-700">{entry.cashierName || "-"}</td><td className="px-4 py-3 text-slate-700">{entry.notes || "-"}</td></tr>)}{!filteredHistory.length && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No payment history for this selected period.</td></tr>}</tbody>
          </table>
        </div>
      </div>

      <RecentPaymentActivities />
    </section>
  );
}
