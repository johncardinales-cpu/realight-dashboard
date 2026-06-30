"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Customer = { customerId: string; customerName: string; phone?: string; customerType?: string };
type Balance = { key: string; saleDate: string; salesRefNo: string; customerName: string; totalSalePhp: number; totalPaidPhp: number; balancePhp: number; paymentStatus: string; saleStatus: string };
type Credit = { customerName: string; creditAmountPhp: number; status: string; creditDate: string; transactionRef: string };
type PaymentHistory = { paymentDate: string; salesRefNo: string; groupRef: string; customerName: string; paymentMethod: string; amountPaidPhp: number; transactionRef: string; cashierName: string; notes: string; createdAt: string; paymentId: string; saleId: string; paymentStatus: string };
type PaymentTransaction = { key: string; paymentDate: string; transactionAmountPhp: number; paymentMethod: string; transactionRef: string; cashierName: string; status: string; notes: string; allocations: PaymentHistory[] };

const methods = ["Bank Transfer", "GCash", "Maya", "Check", "Cash", "Mixed Payment"];
const storageKey = "realights.salespersonName";
const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50";
const readonlyClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800";

function money(value: number) {
  return `PHP ${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function text(value: unknown) { return String(value || "").trim(); }
function norm(value: unknown) { return text(value).toLowerCase().replace(/\s+/g, " "); }

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function customerLabel(customer: Customer) {
  return `${customer.customerName}${customer.phone ? ` | ${customer.phone}` : ""}${customer.customerType ? ` | ${customer.customerType}` : ""}`;
}

function isInactive(value: string) { return ["voided", "cancelled", "canceled"].includes(norm(value)); }
function pillClass(value: string) { const n = norm(value); return n === "paid" || n === "confirmed" || n === "active" ? "bg-emerald-50 text-emerald-700" : n === "partial" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"; }
function StatusPill({ value }: { value: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillClass(value)}`}>{value}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>; }

function paymentGroupId(row: PaymentHistory) {
  const marker = "Group payment ";
  const note = text(row.notes);
  const index = note.indexOf(marker);
  if (index < 0) return "";
  const rest = note.slice(index + marker.length).trim();
  return rest.split("|")[0].trim().split(" ")[0] || "";
}

function transactionKey(row: PaymentHistory) {
  const date = normalizeDate(row.paymentDate);
  const customer = norm(row.customerName);
  const method = norm(row.paymentMethod);
  const ref = norm(row.transactionRef);
  if (ref) return `${date}|${customer}|${method}|${ref}`;
  const groupId = paymentGroupId(row);
  if (groupId) return groupId;
  return row.paymentId || `${date}|${customer}|${row.salesRefNo}|${row.amountPaidPhp}`;
}

function buildPaymentTransactions(rows: PaymentHistory[]) {
  const map = new Map<string, PaymentTransaction>();
  rows.forEach((row) => {
    const key = transactionKey(row);
    const current = map.get(key) || {
      key,
      paymentDate: normalizeDate(row.paymentDate),
      transactionAmountPhp: 0,
      paymentMethod: row.paymentMethod || "-",
      transactionRef: row.transactionRef || "-",
      cashierName: row.cashierName || "-",
      status: row.paymentStatus || "Active",
      notes: row.notes || "-",
      allocations: [],
    };
    current.transactionAmountPhp += Number(row.amountPaidPhp) || 0;
    current.allocations.push(row);
    if ((!current.transactionRef || current.transactionRef === "-") && row.transactionRef) current.transactionRef = row.transactionRef;
    if ((!current.cashierName || current.cashierName === "-") && row.cashierName) current.cashierName = row.cashierName;
    if ((!current.notes || current.notes === "-") && row.notes) current.notes = row.notes;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => `${b.paymentDate}-${b.key}`.localeCompare(`${a.paymentDate}-${a.key}`));
}

function previewAllocation(rows: Balance[], amount: number) {
  let remaining = Math.max(Number(amount) || 0, 0);
  const items: Array<{ saleDate: string; salesRefNo: string; balanceBefore: number; applied: number; balanceAfter: number }> = [];
  for (const row of rows) {
    if (remaining <= 0.009) break;
    const balance = Number(row.balancePhp) || 0;
    const applied = Math.min(remaining, balance);
    if (applied <= 0) continue;
    items.push({ saleDate: normalizeDate(row.saleDate), salesRefNo: row.salesRefNo, balanceBefore: balance, applied, balanceAfter: Math.max(balance - applied, 0) });
    remaining = Math.max(remaining - applied, 0);
  }
  return { items, applied: Math.max((Number(amount) || 0) - remaining, 0), credit: remaining };
}

export default function CustomerPaymentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [transactionRef, setTransactionRef] = useState("");
  const [cashierName, setCashierName] = useState("Admin");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const customerOptions = useMemo(() => customers.map(customerLabel), [customers]);
  const openRows = useMemo(() => balances.filter((row) => !isInactive(row.saleStatus) && Number(row.balancePhp || 0) > 0 && norm(row.customerName) === norm(customerName)).sort((a, b) => `${normalizeDate(a.saleDate)}-${a.salesRefNo}`.localeCompare(`${normalizeDate(b.saleDate)}-${b.salesRefNo}`)), [balances, customerName]);
  const openBalance = useMemo(() => openRows.reduce((sum, row) => sum + Number(row.balancePhp || 0), 0), [openRows]);
  const allocation = useMemo(() => previewAllocation(openRows, paymentAmount), [openRows, paymentAmount]);
  const creditTotal = useMemo(() => credits.filter((credit) => norm(credit.customerName) === norm(customerName) && norm(credit.status || "Open") === "open").reduce((sum, credit) => sum + Number(credit.creditAmountPhp || 0), 0), [credits, customerName]);
  const customerPayments = useMemo(() => paymentHistory.filter((row) => norm(row.customerName) === norm(customerName)), [paymentHistory, customerName]);
  const paymentTransactions = useMemo(() => buildPaymentTransactions(customerPayments), [customerPayments]);
  const totalPayments = useMemo(() => customerPayments.reduce((sum, row) => sum + Number(row.amountPaidPhp || 0), 0), [customerPayments]);

  async function loadData() {
    setLoading(true);
    try {
      const [customerRes, paymentRes, historyRes] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/customer-payments?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      ]);
      const customerData = await customerRes.json();
      const paymentData = await paymentRes.json();
      const historyData = historyRes ? await historyRes.json().catch(() => ({ credits: [], payments: [] })) : { credits: [], payments: [] };
      if (!customerRes.ok) throw new Error(customerData?.error || "Failed to load customers.");
      if (!paymentRes.ok) throw new Error(paymentData?.error || "Failed to load balances.");
      setCustomers(Array.isArray(customerData) ? customerData : []);
      setBalances(Array.isArray(paymentData) ? paymentData : []);
      setCredits(Array.isArray(historyData?.credits) ? historyData.credits : []);
      setPaymentHistory(Array.isArray(historyData?.payments) ? historyData.payments : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setCashierName(window.localStorage.getItem(storageKey) || "Admin"); loadData().catch((error: any) => { setIsError(true); setMessage(error?.message || "Failed to load customer payment data."); }); }, []);

  function chooseCustomer(value: string) {
    setCustomerSearch(value);
    const clean = value.trim();
    if (!clean) { setCustomerName(""); setCustomerId(""); return; }
    const match = customers.find((customer) => customerLabel(customer).toLowerCase() === clean.toLowerCase() || customer.customerName.toLowerCase() === clean.toLowerCase());
    if (match) { setCustomerName(match.customerName); setCustomerId(match.customerId || ""); setCustomerSearch(customerLabel(match)); }
    else { setCustomerName(clean); setCustomerId(""); }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setIsError(false);
    setMessage("");
    try {
      if (!customerName) throw new Error("Select a customer first.");
      if ((Number(paymentAmount) || 0) <= 0) throw new Error("Payment amount must be greater than zero.");
      const response = await fetch("/api/customer-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName, customerId, paymentDate, paymentMethod, transactionRef, cashierName, notes, paymentAmount, allocationMode: "fifo" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to save group payment.");
      setMessage(`Saved. Applied ${money(data.appliedAmountPhp || 0)}${data.creditAmountPhp ? ` and saved ${money(data.creditAmountPhp)} as customer credit` : ""}.`);
      setPaymentAmount(0); setTransactionRef(""); setNotes("");
      await loadData();
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Failed to save group payment.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-3xl font-semibold text-slate-900">Customer Group Payments</h1><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">Enter one customer payment. The system auto-allocates it to the oldest unpaid records first. Excess becomes customer credit.</p></div>
        <button type="button" onClick={() => loadData().catch(console.error)} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">{loading ? "Refreshing..." : "Refresh"}</button>
      </div>
      {message ? <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}
    </div>

    <form onSubmit={savePayment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-bold text-slate-950">Add Customer Payment</h2>
      <p className="mb-5 text-sm text-slate-600">Use this for Rudy-style staggered payments. Allocation is FIFO: oldest unpaid first.</p>
      <datalist id="customer-group-payment-options">{customerOptions.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Customer Search"><input list="customer-group-payment-options" className={inputClass} value={customerSearch} onChange={(e) => chooseCustomer(e.target.value)} placeholder="Search customer" /></Field>
        <Field label="Customer Name"><input className={inputClass} value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerId(""); }} required /></Field>
        <Field label="Payment Date"><input className={inputClass} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></Field>
        <Field label="Payment Amount"><input className={inputClass} type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} required /></Field>
        <Field label="Payment Method"><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
        <Field label="Transaction Ref"><input className={inputClass} value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="BPI ref / receipt no." /></Field>
        <Field label="Cashier / Encoder"><input className={inputClass} value={cashierName} onChange={(e) => { setCashierName(e.target.value); window.localStorage.setItem(storageKey, e.target.value); }} /></Field>
        <Field label="Open Balance"><input className={readonlyClass} value={money(openBalance)} readOnly /></Field>
        <Field label="New Credit If Overpaid"><input className={readonlyClass} value={money(allocation.credit)} readOnly /></Field>
        <Field label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional allocation note" /></Field>
      </div>
      <div className="mt-5 flex gap-3"><button type="submit" disabled={saving || !customerName || paymentAmount <= 0} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Group Payment"}</button><button type="button" onClick={() => { setPaymentAmount(0); setTransactionRef(""); setNotes(""); }} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Clear</button></div>
    </form>

    <div className="grid gap-4 md:grid-cols-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Selected Customer</p><p className="mt-1 truncate text-lg font-bold text-slate-950">{customerName || "-"}</p></div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-semibold text-emerald-600">Payment History Total</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(totalPayments)}</p></div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm"><p className="text-xs font-semibold text-rose-600">Open Balance</p><p className="mt-1 text-lg font-bold text-rose-700">{money(openBalance)}</p></div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-semibold text-emerald-600">Will Apply</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(allocation.applied)}</p></div>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm"><p className="text-xs font-semibold text-amber-600">Existing Credit</p><p className="mt-1 text-lg font-bold text-amber-700">{money(creditTotal)}</p></div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Payment Transactions for Selected Customer</h2>
      <p className="mb-4 text-xs text-slate-500">Each row is one actual payment received. Allocations show how that payment was split across sales records.</p>
      <div className="overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Payment Date", "Exact Amount Paid", "Method", "Transaction Ref", "Cashier", "Allocations", "Status", "Notes"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{paymentTransactions.map((tx) => <tr key={tx.key} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{tx.paymentDate}</td><td className="px-4 py-3 font-bold text-slate-950">{money(tx.transactionAmountPhp)}</td><td className="px-4 py-3 text-slate-700">{tx.paymentMethod}</td><td className="px-4 py-3 text-slate-700">{tx.transactionRef}</td><td className="px-4 py-3 text-slate-700">{tx.cashierName}</td><td className="px-4 py-3"><div className="space-y-1">{tx.allocations.map((row) => <div key={row.paymentId || row.salesRefNo} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{row.salesRefNo}: {money(row.amountPaidPhp)}</div>)}</div></td><td className="px-4 py-3"><StatusPill value={tx.status || "Active"} /></td><td className="px-4 py-3 text-slate-700">{tx.notes}</td></tr>)}{!paymentTransactions.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No payment transactions for selected customer yet.</td></tr> : null}</tbody></table></div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Allocation Preview</h2>
      <div className="overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Balance Before", "Will Apply", "Balance After"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{allocation.items.map((row) => <tr key={row.salesRefNo} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{row.saleDate}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.salesRefNo}</td><td className="px-4 py-3 font-bold text-rose-700">{money(row.balanceBefore)}</td><td className="px-4 py-3 font-bold text-emerald-700">{money(row.applied)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(row.balanceAfter)}</td></tr>)}{!allocation.items.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Select a customer and enter payment amount.</td></tr> : null}</tbody></table></div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Current Open Balances</h2>
      <div className="overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[880px] text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Total", "Paid", "Balance", "Payment", "Sale"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{openRows.map((row) => <tr key={row.key} className="border-t border-slate-100 bg-rose-50/40"><td className="px-4 py-3 text-slate-700">{normalizeDate(row.saleDate)}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{money(row.totalSalePhp)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(row.totalPaidPhp)}</td><td className="px-4 py-3 font-bold text-rose-700">{money(row.balancePhp)}</td><td className="px-4 py-3"><StatusPill value={row.paymentStatus} /></td><td className="px-4 py-3"><StatusPill value={row.saleStatus} /></td></tr>)}{!openRows.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No open balance for this customer.</td></tr> : null}</tbody></table></div>
    </div>
  </section>;
}
