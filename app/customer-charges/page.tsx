"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CustomerRow = { customerId: string; customerName: string; phone?: string; customerType?: string };
type ChargeRow = { saleDate: string; salesRefNo: string; customerName: string; description: string; specification: string; grandTotalPhp?: number; amountPaidPhp: number; balancePhp: number; paymentStatus: string; saleStatus: string; deliveryFeePhp?: number; installationFeePhp?: number; otherChargePhp?: number };

const chargeTypes = ["Delivery Fee", "Installation Fee", "Service Fee", "Other Charge"];
const paymentStatusOptions = ["Pending", "Partial", "Paid"];
const paymentMethodOptions = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];
const salespersonStorageKey = "realights.salespersonName";

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateCode(value: string) {
  const [year, month, day] = String(value || today()).split("-");
  return year && month && day ? `${month}${day}${year.slice(-2)}` : "";
}

function initials(value: string) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function chargeCode(value: string) {
  return String(value || "Charge").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "CHARGE";
}

function customerLabel(row: CustomerRow) {
  return `${row.customerName}${row.phone ? ` | ${row.phone}` : ""}${row.customerType ? ` | ${row.customerType}` : ""}`;
}

function normalizeDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function StatusPill({ value }: { value: string }) {
  const normalized = String(value || "").toLowerCase();
  const color = normalized === "paid" || normalized === "confirmed" ? "bg-emerald-50 text-emerald-700" : normalized === "partial" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value || "Pending"}</span>;
}

function Field({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  return <label className="block space-y-1"><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}{helper ? <span className="block text-[11px] text-slate-500">{helper}</span> : null}</label>;
}

export default function CustomerChargesPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [chargeDate, setChargeDate] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [chargeType, setChargeType] = useState("Delivery Fee");
  const [chargeAmountPhp, setChargeAmountPhp] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [amountPaidPhp, setAmountPaidPhp] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400";
  const readOnlyClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700";
  const customerOptions = useMemo(() => customers.map(customerLabel), [customers]);
  const suggestedSalesRef = useMemo(() => {
    const code = initials(customerName);
    const date = dateCode(chargeDate);
    const type = chargeCode(chargeType);
    return code && date ? `${code}-${type}-${date}` : "";
  }, [customerName, chargeDate, chargeType]);
  const paidAmount = paymentStatus === "Paid" ? chargeAmountPhp : paymentStatus === "Pending" ? 0 : Math.min(Math.max(Number(amountPaidPhp) || 0, 0), chargeAmountPhp);
  const balance = Math.max((Number(chargeAmountPhp) || 0) - paidAmount, 0);

  async function loadData() {
    const [customersRes, salesRes] = await Promise.all([
      fetch("/api/customers", { cache: "no-store" }),
      fetch(`/api/sales?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const customerData = await customersRes.json();
    const salesData = await salesRes.json();
    if (!customersRes.ok) throw new Error(customerData?.error || "Failed to load customers");
    if (!salesRes.ok) throw new Error(salesData?.error || "Failed to load sales");
    setCustomers(Array.isArray(customerData) ? customerData : []);
    setCharges(Array.isArray(salesData) ? salesData.filter((row: ChargeRow) => row.description === "Customer Charge") : []);
  }

  useEffect(() => {
    setSalesperson(window.localStorage.getItem(salespersonStorageKey) || "Admin");
    loadData().catch((error: any) => setMessage(error?.message || "Failed to load customer charges."));
  }, []);

  useEffect(() => {
    if (paymentStatus === "Paid") setAmountPaidPhp(chargeAmountPhp);
    if (paymentStatus === "Pending") setAmountPaidPhp(0);
    if (paymentStatus === "Partial" && amountPaidPhp > chargeAmountPhp) setAmountPaidPhp(chargeAmountPhp);
  }, [paymentStatus, chargeAmountPhp, amountPaidPhp]);

  function selectCustomer(value: string) {
    setCustomerSearch(value);
    const clean = value.trim();
    if (!clean) {
      setCustomerId("");
      setCustomerName("");
      return;
    }
    const match = customers.find((customer) => customerLabel(customer).toLowerCase() === clean.toLowerCase() || customer.customerName.toLowerCase() === clean.toLowerCase());
    if (match) {
      setCustomerId(match.customerId || "");
      setCustomerName(match.customerName);
      setCustomerSearch(customerLabel(match));
    } else {
      setCustomerId("");
      setCustomerName(clean);
    }
  }

  function resetForm() {
    setChargeDate(today());
    setCustomerId("");
    setCustomerSearch("");
    setCustomerName("");
    setChargeType("Delivery Fee");
    setChargeAmountPhp(0);
    setPaymentStatus("Pending");
    setAmountPaidPhp(0);
    setPaymentMethod("");
    setTransactionRef("");
    setNotes("");
  }

  async function submitCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (!customerName.trim()) throw new Error("Customer name is required.");
      if ((Number(chargeAmountPhp) || 0) <= 0) throw new Error("Charge amount must be greater than zero.");
      if (paymentStatus === "Partial" && paidAmount <= 0) throw new Error("Partial charge needs an amount paid.");
      const payload = {
        entryType: "customer-charge",
        chargeOnly: true,
        saleDate: chargeDate,
        salesRefNo: suggestedSalesRef,
        groupRef: suggestedSalesRef,
        customerId,
        customerName,
        chargeType,
        chargeAmountPhp,
        paymentStatus,
        amountPaidPhp: paidAmount,
        paymentMethod,
        transactionRef,
        cashierName: salesperson || "Admin",
        saleStatus: "Confirmed",
        salesperson: salesperson || "Admin",
        notes: notes || `${chargeType} billed to customer`,
        items: [],
      };
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save customer charge.");
      setMessage(`Customer charge saved. Balance: ${money(data?.grandTotalPhp - data?.amountPaidPhp || balance)}.`);
      resetForm();
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save customer charge.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-900">Customer Charges</h1>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">Use this when the customer owes Realights for delivery, installation, service, or other billable charges. This creates a customer receivable and appears in Payments and Customer Records.</p>
      {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>

    <form onSubmit={submitCharge} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-950">Add Customer Charge</h2>
        <p className="mt-1 text-sm text-slate-600">Example: Rudy Sulit delivery fee ₱9,000 unpaid. This is not an expense; it is an amount the customer owes you.</p>
      </div>
      <datalist id="charge-customer-options">{customerOptions.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Charge Date"><input className={inputClass} type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} required /></Field>
        <Field label="Customer Search"><input list="charge-customer-options" className={inputClass} value={customerSearch} onChange={(e) => selectCustomer(e.target.value)} placeholder="Search customer" /></Field>
        <Field label="Customer Name"><input className={inputClass} value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerId(""); }} required /></Field>
        <Field label="Charge Type"><select className={inputClass} value={chargeType} onChange={(e) => setChargeType(e.target.value)}>{chargeTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Charge Amount"><input className={inputClass} type="number" min="0" step="0.01" value={chargeAmountPhp} onChange={(e) => setChargeAmountPhp(Number(e.target.value))} required /></Field>
        <Field label="Payment Status"><select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>{paymentStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
        <Field label="Amount Paid"><input className={paymentStatus === "Partial" ? inputClass : readOnlyClass} type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} readOnly={paymentStatus !== "Partial"} /></Field>
        <Field label="Balance"><input className={readOnlyClass} value={money(balance)} readOnly /></Field>
        <Field label="Sales Ref No." helper="Auto-generated from customer, charge type, and date."><input className={readOnlyClass} value={suggestedSalesRef} readOnly /></Field>
        <Field label="Payment Method"><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{paymentMethodOptions.map((method) => <option key={method || "blank"} value={method}>{method || "Select payment method"}</option>)}</select></Field>
        <Field label="Transaction Ref"><input className={inputClass} value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Salesperson / Cashier"><input className={inputClass} value={salesperson} onChange={(e) => { setSalesperson(e.target.value); window.localStorage.setItem(salespersonStorageKey, e.target.value); }} /></Field>
        <Field label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" /></Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Customer Charge"}</button>
        <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Clear</button>
      </div>
    </form>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-slate-900">Customer Charge Ledger</h2><p className="mt-1 text-xs text-slate-500">Charge rows are saved in Sales as customer receivables.</p></div>
        <button type="button" onClick={() => loadData().catch(console.error)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Charge Type", "Amount", "Paid", "Balance", "Payment", "Sale"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead>
          <tbody>{charges.map((row, index) => {
            const hasBalance = Number(row.balancePhp || 0) > 0;
            return <tr key={`${row.salesRefNo}-${index}`} className={`border-t border-slate-100 ${hasBalance ? "bg-rose-50/40" : ""}`}><td className="px-4 py-3 text-slate-700">{normalizeDate(row.saleDate)}</td><td className="px-4 py-3 font-semibold text-slate-800">{row.salesRefNo}</td><td className={`px-4 py-3 font-semibold ${hasBalance ? "text-rose-700" : "text-slate-800"}`}>{row.customerName}</td><td className="px-4 py-3 text-slate-700">{row.specification}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(Number(row.grandTotalPhp) || 0)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(Number(row.amountPaidPhp) || 0)}</td><td className={`px-4 py-3 font-bold ${hasBalance ? "text-rose-700" : "text-emerald-700"}`}>{money(Number(row.balancePhp) || 0)}</td><td className="px-4 py-3"><StatusPill value={row.paymentStatus} /></td><td className="px-4 py-3"><StatusPill value={row.saleStatus} /></td></tr>;
          })}{!charges.length ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No customer charges yet.</td></tr> : null}</tbody>
        </table>
      </div>
    </div>
  </section>;
}
