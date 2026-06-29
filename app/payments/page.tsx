"use client";

import { useEffect, useMemo, useState } from "react";
import PaymentActivityRows from "./payment-activity-rows";

type PaymentSummary = { key: string; saleId?: string; saleDate: string; salesRefNo: string; groupRef: string; customerName: string; totalSalePhp: number; totalPaidPhp: number; balancePhp: number; paymentStatus: string; saleStatus: string; paymentCount: number };
type PaymentHistory = { entryType: string; paymentDate: string; salesRefNo: string; groupRef: string; customerName: string; paymentMethod: string; amountPaidPhp: number; transactionRef: string; cashierName: string; notes: string; paymentStatus: string; totalSalePhp: number; runningPaidPhp: number; balanceAfterPhp: number; saleStatus: string; createdAt: string; paymentId: string; voidedAt?: string; voidReason?: string };
type ExpenseRow = { Date: string; Category: string; Description: string; Amount: number; AmountPaid?: number; BalanceAmount?: number; ExpensePaymentStatus?: string; PaymentMethod?: string; Reference?: string; CustomerName?: string; Payee?: string; Source: string; Notes?: string; ExpenseID?: string };
type CustomerGroup = { key: string; customerName: string; records: number; totalSalePhp: number; totalPaidPhp: number; balancePhp: number };
type HistoryMode = "daily" | "weekly" | "monthly" | "custom";
type BalanceDateMode = "overall" | "daily" | "weekly" | "monthly" | "ytd" | "lastYear" | "custom";
type BalanceStatusFilter = "open" | "unpaid" | "partial" | "paid" | "all";

const paymentMethodOptions = ["Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];
const balanceDateOptions: Array<{ value: BalanceDateMode; label: string }> = [
  { value: "overall", label: "Overall" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "ytd", label: "Year to Date" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];
const balanceStatusOptions: Array<{ value: BalanceStatusFilter; label: string }> = [
  { value: "open", label: "Open Balance" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All Status" },
];

function money(value: number) { return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function normalizeDate(value: string | number | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) { const [m, d, y0] = raw.split("/").map(Number); const y = y0 < 100 ? 2000 + y0 : y0; return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  if (/^\d+(\.\d+)?$/.test(raw)) { const serial = Number(raw); if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10); }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}
function norm(value: string) { return String(value || "").trim().toLowerCase(); }
function fmt(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function toDate(value: string) { const raw = normalizeDate(value || today()); const [y, m, d] = raw.split("-").map(Number); const date = y && m && d ? new Date(y, m - 1, d) : new Date(); return Number.isNaN(date.getTime()) ? new Date() : date; }
function round(value: number) { return Math.round((Number(value) || 0) * 100) / 100; }
function isInactive(value: string) { return ["voided", "cancelled", "canceled"].includes(norm(value)); }

function historyRange(mode: HistoryMode, anchorValue: string, customStart = today(), customEnd = today()) {
  if (mode === "custom") return { start: normalizeDate(customStart), end: normalizeDate(customEnd) };
  const start = toDate(anchorValue); const end = new Date(start);
  if (mode === "weekly") { const day = start.getDay(); const offset = day === 0 ? -6 : 1 - day; start.setDate(start.getDate() + offset); end.setTime(start.getTime()); end.setDate(start.getDate() + 6); }
  if (mode === "monthly") { start.setDate(1); end.setTime(start.getTime()); end.setMonth(start.getMonth() + 1, 0); }
  return { start: fmt(start), end: fmt(end) };
}
function balanceRange(mode: BalanceDateMode, anchorValue: string, customStart: string, customEnd: string) {
  if (mode === "overall") return { start: "1900-01-01", end: "2999-12-31" };
  if (mode === "custom") return { start: normalizeDate(customStart || today()), end: normalizeDate(customEnd || today()) };
  const anchor = toDate(anchorValue); const start = new Date(anchor); const end = new Date(anchor);
  if (mode === "weekly") { const day = start.getDay(); const offset = day === 0 ? -6 : 1 - day; start.setDate(start.getDate() + offset); end.setTime(start.getTime()); end.setDate(start.getDate() + 6); }
  if (mode === "monthly") { start.setDate(1); end.setTime(start.getTime()); end.setMonth(start.getMonth() + 1, 0); }
  if (mode === "ytd") { start.setMonth(0, 1); end.setTime(anchor.getTime()); }
  if (mode === "lastYear") { const year = anchor.getFullYear() - 1; start.setFullYear(year, 0, 1); end.setFullYear(year, 11, 31); }
  return { start: fmt(start), end: fmt(end) };
}
function inRange(date: string, start: string, end: string) { const d = normalizeDate(date); return d >= start && d <= end; }
function isOpenBalance(row: PaymentSummary) { return !isInactive(row.saleStatus) && Number(row.balancePhp || 0) > 0; }
function displayPaymentStatus(row: PaymentSummary) { const balance = Number(row.balancePhp || 0); const paid = Number(row.totalPaidPhp || 0); if (balance > 0 && paid > 0) return "Partial"; if (balance > 0) return "Unpaid"; return row.paymentStatus || "Paid"; }
function cleanCustomer(value: string) { return String(value || "").trim().replace(/\s+/g, " ") || "Unknown Customer"; }
function customerKey(value: string) { return cleanCustomer(value).toLowerCase(); }
function matchesStatus(row: PaymentSummary, filter: BalanceStatusFilter) { const s = displayPaymentStatus(row).toLowerCase(); if (filter === "all") return true; if (filter === "open") return isOpenBalance(row); if (filter === "unpaid") return s === "unpaid" || s === "pending"; return s === filter; }
function totalsFor(rows: PaymentSummary[]) { return { records: rows.length, totalSalePhp: round(rows.reduce((a, r) => a + Number(r.totalSalePhp || 0), 0)), totalPaidPhp: round(rows.reduce((a, r) => a + Number(r.totalPaidPhp || 0), 0)), balancePhp: round(rows.reduce((a, r) => a + Number(r.balancePhp || 0), 0)) }; }
function groupByCustomer(rows: PaymentSummary[]) {
  const map = new Map<string, CustomerGroup>();
  rows.forEach((row) => { const customerName = cleanCustomer(row.customerName); const key = customerKey(customerName); const current = map.get(key) || { key, customerName, records: 0, totalSalePhp: 0, totalPaidPhp: 0, balancePhp: 0 }; current.records += 1; current.totalSalePhp = round(current.totalSalePhp + Number(row.totalSalePhp || 0)); current.totalPaidPhp = round(current.totalPaidPhp + Number(row.totalPaidPhp || 0)); current.balancePhp = round(current.balancePhp + Number(row.balancePhp || 0)); map.set(key, current); });
  return Array.from(map.values()).sort((a, b) => b.balancePhp - a.balancePhp || a.customerName.localeCompare(b.customerName));
}
function isExpenseOpen(row: ExpenseRow) { return Number(row.BalanceAmount || 0) > 0 || ["installment", "pending"].includes(norm(row.ExpensePaymentStatus || "")); }
function StatusPill({ value }: { value: string }) { const n = value.toLowerCase(); const color = n === "paid" || n === "active" || n === "confirmed" ? "bg-emerald-50 text-emerald-700" : n === "partial" || n === "installment" ? "bg-amber-50 text-amber-700" : n === "unpaid" || n === "pending" || isInactive(value) ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>; }

export default function PaymentsPage() {
  const defaultHistoryRange = historyRange("monthly", today());
  const [rows, setRows] = useState<PaymentSummary[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
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
  const [balanceDateMode, setBalanceDateMode] = useState<BalanceDateMode>("overall");
  const [balanceAnchorDate, setBalanceAnchorDate] = useState(today());
  const [balanceStartDate, setBalanceStartDate] = useState(today());
  const [balanceEndDate, setBalanceEndDate] = useState(today());
  const [searchText, setSearchText] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<BalanceStatusFilter>("open");
  const [historyMode, setHistoryMode] = useState<HistoryMode>("monthly");
  const [historyDate, setHistoryDate] = useState(today());
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start);
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end);

  async function loadPayments() {
    const [summaryRes, historyRes, expensesRes] = await Promise.all([
      fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/payments?history=1&t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/expenses?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
    ]);
    const summaryData = await summaryRes.json();
    const historyData = await historyRes.json();
    const expenseData = expensesRes ? await expensesRes.json().catch(() => ({ rows: [] })) : { rows: [] };
    if (!summaryRes.ok) throw new Error(summaryData?.error || "Failed to load payment balances.");
    if (!historyRes.ok) throw new Error(historyData?.error || "Failed to load payment history.");
    setRows(Array.isArray(summaryData) ? summaryData : []);
    setHistory(Array.isArray(historyData) ? historyData : []);
    setExpenseRows(Array.isArray(expenseData?.rows) ? expenseData.rows : []);
  }
  async function refreshPayments() { setRefreshing(true); setIsError(false); setMessage("Refreshing payment balances..."); try { await loadPayments(); setMessage("Payment balances refreshed."); } catch (error: any) { setIsError(true); setMessage(error?.message || "Refresh failed."); } finally { setRefreshing(false); } }
  useEffect(() => { refreshPayments().catch((error) => { setIsError(true); setMessage(error?.message || "Failed to load payment balances."); }); }, []);

  const balanceDateRange = useMemo(() => balanceRange(balanceDateMode, balanceAnchorDate, balanceStartDate, balanceEndDate), [balanceDateMode, balanceAnchorDate, balanceStartDate, balanceEndDate]);
  const scopedRows = useMemo(() => rows.filter((row) => !isInactive(row.saleStatus) && inRange(row.saleDate, balanceDateRange.start, balanceDateRange.end)), [rows, balanceDateRange.start, balanceDateRange.end]);
  const searchedRows = useMemo(() => { const q = searchText.trim().toLowerCase(); return scopedRows.filter((row) => matchesStatus(row, statusFilter) && (!q || `${row.customerName} ${row.salesRefNo} ${row.groupRef} ${displayPaymentStatus(row)} ${row.saleStatus}`.toLowerCase().includes(q))); }, [scopedRows, searchText, statusFilter]);
  const customerGroups = useMemo(() => groupByCustomer(searchedRows), [searchedRows]);
  const filteredRows = useMemo(() => customerFilter === "all" ? searchedRows : searchedRows.filter((row) => customerKey(row.customerName) === customerFilter), [searchedRows, customerFilter]);
  const openBalances = useMemo(() => filteredRows.filter(isOpenBalance), [filteredRows]);
  const selectedSale = useMemo(() => rows.find((row) => row.key === selectedKey && isOpenBalance(row)), [rows, selectedKey]);
  const activeHistoryRange = useMemo(() => historyMode === "custom" ? { start: historyStart, end: historyEnd } : historyRange(historyMode, historyDate), [historyMode, historyDate, historyStart, historyEnd]);
  const filteredHistory = useMemo(() => history.filter((entry) => inRange(entry.paymentDate, activeHistoryRange.start, activeHistoryRange.end)), [history, activeHistoryRange.start, activeHistoryRange.end]);
  const historyTotal = useMemo(() => filteredHistory.filter((entry) => !isInactive(entry.paymentStatus)).reduce((sum, entry) => sum + Number(entry.amountPaidPhp || 0), 0), [filteredHistory]);
  const allTotals = useMemo(() => totalsFor(searchedRows), [searchedRows]);
  const selectedTotals = useMemo(() => totalsFor(filteredRows), [filteredRows]);
  const selectedCustomerName = customerFilter === "all" ? "All customers" : customerGroups.find((group) => group.key === customerFilter)?.customerName || "Selected customer";
  const paymentAmount = Number(amountPaidPhp) || 0;
  const balanceAfterPayment = Math.max((selectedSale?.balancePhp || 0) - paymentAmount, 0);
  const expenseInstallments = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return expenseRows
      .filter((row) => row.Source === "Expenses" && isExpenseOpen(row) && inRange(row.Date, balanceDateRange.start, balanceDateRange.end))
      .filter((row) => !q || `${row.CustomerName} ${row.Description} ${row.Category} ${row.Reference} ${row.Payee}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.BalanceAmount || 0) - Number(a.BalanceAmount || 0));
  }, [expenseRows, balanceDateRange.start, balanceDateRange.end, searchText]);
  const expensePayableTotal = useMemo(() => round(expenseInstallments.reduce((sum, row) => sum + Number(row.BalanceAmount || 0), 0)), [expenseInstallments]);

  useEffect(() => { if (customerFilter !== "all" && !customerGroups.some((group) => group.key === customerFilter)) setCustomerFilter("all"); }, [customerFilter, customerGroups]);
  function selectSale(key: string) { const sale = rows.find((row) => row.key === key && isOpenBalance(row)); setSelectedKey(key); setAmountPaidPhp(sale?.balancePhp || 0); setCashierName((current) => current || "Admin"); setIsError(false); setMessage(""); }
  function resetPaymentForm() { setSelectedKey(""); setPaymentDate(today()); setPaymentMethod("Cash"); setAmountPaidPhp(0); setTransactionRef(""); setCashierName("Admin"); setNotes(""); }
  function changeHistoryMode(mode: HistoryMode) { setHistoryMode(mode); if (mode !== "custom") { const range = historyRange(mode, historyDate); setHistoryStart(range.start); setHistoryEnd(range.end); } }
  function changeHistoryDate(value: string) { setHistoryDate(value); if (historyMode !== "custom") { const range = historyRange(historyMode, value); setHistoryStart(range.start); setHistoryEnd(range.end); } }
  async function savePayment(e: React.FormEvent) { e.preventDefault(); setSaving(true); setIsError(false); setMessage(""); try { if (!selectedSale) throw new Error("Select a sale with open balance first."); if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero."); if (paymentAmount > selectedSale.balancePhp) throw new Error(`Payment cannot exceed balance of ${money(selectedSale.balancePhp)}.`); const payload = { key: selectedSale.key, saleId: selectedSale.saleId || selectedSale.key, salesRefNo: selectedSale.salesRefNo, groupRef: selectedSale.groupRef, paymentDate, paymentMethod, amountPaidPhp: paymentAmount, transactionRef, cashierName: cashierName.trim() || "Admin", notes }; const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await res.json(); if (!res.ok) throw new Error(data?.error || "Failed to save payment."); setIsError(false); setMessage(`Payment saved. ${data.paymentStatus} - remaining balance ${money(data.balancePhp)}.`); resetPaymentForm(); await loadPayments(); } catch (error: any) { setIsError(true); setMessage(error?.message || "Failed to save payment."); } finally { setSaving(false); } }

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold text-slate-900">Payments</h1><p className="mt-1 text-sm text-slate-600">Complete customer payments and monitor installment expense payables.</p><p className="mt-1 text-xs text-slate-500">Customer receivables and expense installments are separated for clean accounting.</p></div><button type="button" onClick={refreshPayments} disabled={refreshing} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button></div>{message ? <p className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}</div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-xl font-semibold text-slate-900">Payment Filters</h2><p className="mt-1 text-xs font-semibold text-slate-500">Showing {balanceDateMode === "overall" ? "all available records" : `${balanceDateRange.start} to ${balanceDateRange.end}`}</p></div><div className="grid w-full gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[180px_170px_170px_220px_180px]"><select value={balanceDateMode} onChange={(e) => setBalanceDateMode(e.target.value as BalanceDateMode)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">{balanceDateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{balanceDateMode === "custom" ? <input type="date" value={balanceStartDate} onChange={(e) => setBalanceStartDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /> : <input type="date" value={balanceAnchorDate} onChange={(e) => setBalanceAnchorDate(e.target.value)} disabled={balanceDateMode === "overall"} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" />}{balanceDateMode === "custom" ? <input type="date" value={balanceEndDate} onChange={(e) => setBalanceEndDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /> : <div className="hidden xl:block" />}<input value={searchText} onChange={(e) => setSearchText(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" placeholder="Search customer, sales ref, or expense" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BalanceStatusFilter)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">{balanceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div></div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-xl font-semibold text-slate-900">Customer Balance Summary</h2><p className="mt-1 text-xs text-slate-500">Select a customer to show only their records below.</p></div><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 xl:w-80"><option value="all">All customers</option>{customerGroups.map((group) => <option key={group.key} value={group.key}>{group.customerName} - {money(group.balancePhp)} balance</option>)}</select></div><div className="grid gap-3 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Viewing</p><p className="mt-1 truncate text-base font-bold text-slate-950">{selectedCustomerName}</p><p className="mt-1 text-xs text-slate-500">{selectedTotals.records} record(s)</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Total Amount</p><p className="mt-1 text-lg font-bold text-slate-950">{money(selectedTotals.totalSalePhp)}</p><p className="mt-1 text-xs text-slate-500">Filtered sales</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-600">Paid</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(selectedTotals.totalPaidPhp)}</p><p className="mt-1 text-xs text-emerald-600">Collected/recorded</p></div><div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="text-xs font-semibold text-rose-600">Balance</p><p className="mt-1 text-lg font-bold text-rose-700">{money(selectedTotals.balancePhp)}</p><p className="mt-1 text-xs text-rose-600">Remaining unpaid</p></div></div><div className="mt-4 max-h-48 overflow-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr>{["Customer", "Records", "Total", "Paid", "Balance", "View"].map((head) => <th key={head} className="px-3 py-2 font-bold whitespace-nowrap">{head}</th>)}</tr></thead><tbody><tr className={`border-t border-slate-100 ${customerFilter === "all" ? "bg-emerald-50" : "bg-white"}`}><td className="px-3 py-2 font-bold text-slate-900">All customers</td><td className="px-3 py-2 text-slate-700">{allTotals.records}</td><td className="px-3 py-2 font-semibold text-slate-900">{money(allTotals.totalSalePhp)}</td><td className="px-3 py-2 font-semibold text-emerald-700">{money(allTotals.totalPaidPhp)}</td><td className="px-3 py-2 font-bold text-rose-700">{money(allTotals.balancePhp)}</td><td className="px-3 py-2"><button type="button" onClick={() => setCustomerFilter("all")} className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700">View</button></td></tr>{customerGroups.map((group) => <tr key={group.key} className={`border-t border-slate-100 ${customerFilter === group.key ? "bg-emerald-50" : group.balancePhp > 0 ? "bg-rose-50/40" : "bg-white"}`}><td className={`px-3 py-2 font-bold ${group.balancePhp > 0 ? "text-rose-700" : "text-slate-900"}`}>{group.customerName}</td><td className="px-3 py-2 text-slate-700">{group.records}</td><td className="px-3 py-2 font-semibold text-slate-900">{money(group.totalSalePhp)}</td><td className="px-3 py-2 font-semibold text-emerald-700">{money(group.totalPaidPhp)}</td><td className={`px-3 py-2 font-bold ${group.balancePhp > 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(group.balancePhp)}</td><td className="px-3 py-2"><button type="button" onClick={() => setCustomerFilter(group.key)} className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700">View</button></td></tr>)}{!customerGroups.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No records match the selected filters.</td></tr>}</tbody></table></div></div>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Balance Records</h2><p className="mt-1 text-xs text-slate-500">Red rows still have unpaid customer receivable balance.</p></div><p className="text-xs font-semibold text-slate-500">{filteredRows.length} shown • {openBalances.length} open</p></div><div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[980px] text-sm"><thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Total", "Paid", "Balance", "Payment", "Sale", "Action"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{filteredRows.map((row) => { const hasBalance = isOpenBalance(row); return <tr key={row.key} className={`border-t border-slate-100 ${hasBalance ? "bg-rose-50/40" : "bg-white"}`}><td className="px-4 py-3 text-slate-700">{normalizeDate(row.saleDate)}</td><td className="px-4 py-3 text-slate-700">{row.salesRefNo}</td><td className={`px-4 py-3 font-semibold ${hasBalance ? "text-rose-700" : "text-slate-700"}`}>{row.customerName}</td><td className="px-4 py-3 text-slate-700">{money(row.totalSalePhp)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(row.totalPaidPhp)}</td><td className={`px-4 py-3 font-bold ${hasBalance ? "text-rose-700" : "text-emerald-700"}`}>{money(row.balancePhp)}</td><td className="px-4 py-3"><StatusPill value={displayPaymentStatus(row)} /></td><td className="px-4 py-3"><StatusPill value={row.saleStatus} /></td><td className="px-4 py-3">{hasBalance ? <button type="button" onClick={() => selectSale(row.key)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm">Add Payment</button> : <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Clear</span>}</td></tr>; })}{!filteredRows.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No payment records match the selected filters.</td></tr>}</tbody></table></div></div>

      <form onSubmit={savePayment} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="text-xl font-semibold text-slate-900">Complete Customer Payment</h2><select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={selectedKey} onChange={(e) => selectSale(e.target.value)}><option value="">Select sale with balance</option>{openBalances.map((row) => <option key={row.key} value={row.key}>{row.salesRefNo} - {row.customerName} - {money(row.balancePhp)}</option>)}</select>{selectedSale ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-slate-700"><p><span className="font-semibold">Customer:</span> <span className="font-bold text-rose-700">{selectedSale.customerName}</span></p><p><span className="font-semibold">Total Sale:</span> {money(selectedSale.totalSalePhp)}</p><p><span className="font-semibold">Already Paid:</span> {money(selectedSale.totalPaidPhp)}</p><p><span className="font-semibold">Current Balance:</span> <span className="font-bold text-rose-700">{money(selectedSale.balancePhp)}</span></p><p><span className="font-semibold">Balance After Payment:</span> {money(balanceAfterPayment)}</p></div> : null}<input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /><select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{paymentMethodOptions.map((method) => <option key={method} value={method}>{method}</option>)}</select><input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Amount Paid" value={amountPaidPhp} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} /><input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Transaction / Receipt Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} /><input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Cashier Name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} /><input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /><button type="submit" disabled={saving || !selectedSale} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving Payment..." : "Save Payment"}</button></form></div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Expense Installments / Payables</h2><p className="mt-1 text-xs text-slate-500">Installment or pending expenses are shown here separately from customer receivables.</p></div><div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3"><p className="text-xs font-semibold text-rose-600">Open Expense Balance</p><p className="text-lg font-bold text-rose-700">{money(expensePayableTotal)}</p></div></div><div className="max-h-72 overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[920px] text-sm"><thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>{["Date", "Customer / For", "Category", "Description", "Total", "Paid", "Balance", "Status", "Payee", "Reference"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{expenseInstallments.map((row, index) => <tr key={row.ExpenseID || `${row.Reference}-${index}`} className="border-t border-slate-100 bg-rose-50/40"><td className="px-4 py-3 text-slate-700">{normalizeDate(row.Date)}</td><td className="px-4 py-3 font-semibold text-rose-700">{row.CustomerName || "-"}</td><td className="px-4 py-3 text-slate-700">{row.Category}</td><td className="px-4 py-3 text-slate-700">{row.Description}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(row.Amount)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(Number(row.AmountPaid) || 0)}</td><td className="px-4 py-3 font-bold text-rose-700">{money(Number(row.BalanceAmount) || 0)}</td><td className="px-4 py-3"><StatusPill value={row.ExpensePaymentStatus || "Installment"} /></td><td className="px-4 py-3 text-slate-700">{row.Payee || "-"}</td><td className="px-4 py-3 text-slate-700">{row.Reference || "-"}</td></tr>)}{!expenseInstallments.length && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No expense installments or pending payables found.</td></tr>}</tbody></table></div></div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-900">Payment / Installment History</h2><p className="mt-1 text-xs text-slate-500">Filtered audit trail for initial payments and installment collections.</p><p className="mt-1 text-xs font-semibold text-slate-600">Showing {activeHistoryRange.start} to {activeHistoryRange.end} • {filteredHistory.length} record(s) • {money(historyTotal)} collected</p></div><div className="flex flex-wrap items-center gap-2"><select value={historyMode} onChange={(e) => changeHistoryMode(e.target.value as HistoryMode)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom Range</option></select>{historyMode === "custom" ? <><input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /><span className="text-xs font-bold text-slate-400">to</span><input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /></> : <input type="date" value={historyDate} onChange={(e) => changeHistoryDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />}</div></div><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Type", "Method", "Amount", "Running Paid", "Balance After", "Status", "Reference", "Cashier", "Notes"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{filteredHistory.map((entry, index) => <tr key={`${entry.paymentId}-${entry.entryType}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{normalizeDate(entry.paymentDate)}</td><td className="px-4 py-3 text-slate-700">{entry.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{entry.customerName}</td><td className="px-4 py-3 text-slate-700">{entry.entryType}</td><td className="px-4 py-3 text-slate-700">{entry.paymentMethod}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(entry.amountPaidPhp)}</td><td className="px-4 py-3 text-slate-700">{money(entry.runningPaidPhp)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(entry.balanceAfterPhp)}</td><td className="px-4 py-3"><StatusPill value={entry.paymentStatus} /></td><td className="px-4 py-3 text-slate-700">{entry.transactionRef || "-"}</td><td className="px-4 py-3 text-slate-700">{entry.cashierName || "-"}</td><td className="px-4 py-3 text-slate-700">{entry.notes || "-"}</td></tr>)}<PaymentActivityRows start={activeHistoryRange.start} end={activeHistoryRange.end} />{!filteredHistory.length && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No payment history for this selected period.</td></tr>}</tbody></table></div></div>
  </section>;
}
