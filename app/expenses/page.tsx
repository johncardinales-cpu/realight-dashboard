"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ExpenseRow = {
  Date: string;
  Category: string;
  Description: string;
  BaseAmount?: number;
  TaxFee?: number;
  Amount: number;
  PaymentMethod?: string;
  Reference: string;
  RelatedSalesRefNo?: string;
  Payee?: string;
  Source: string;
  Notes: string;
  ExpenseID?: string;
};

const categories = [
  "Bank Fees",
  "Payment Processing Fees",
  "Delivery / Logistics Expense",
  "Fuel / Transportation",
  "Installation Labor",
  "Tools and Equipment",
  "Office Supplies",
  "Utilities",
  "Rent",
  "Repairs and Maintenance",
  "Marketing",
  "Taxes and Permits",
  "Staff Allowance",
  "Professional Fees",
  "Miscellaneous",
];

const paymentMethods = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit Card", "Other"];

function currency(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-1 ${className}`}><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>;
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState("Miscellaneous");
  const [description, setDescription] = useState("");
  const [baseAmount, setBaseAmount] = useState(0);
  const [taxFee, setTaxFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [relatedSalesRefNo, setRelatedSalesRefNo] = useState("");
  const [payee, setPayee] = useState("");
  const [notes, setNotes] = useState("");

  const totalAmount = useMemo(() => Math.max((Number(baseAmount) || 0) + (Number(taxFee) || 0), 0), [baseAmount, taxFee]);
  const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50";
  const readOnlyClass = "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

  async function loadRows() {
    const res = await fetch("/api/expenses", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load expenses");
    setRows(Array.isArray(data.rows) ? data.rows : []);
  }

  function resetForm() {
    setExpenseDate(today());
    setCategory("Miscellaneous");
    setDescription("");
    setBaseAmount(0);
    setTaxFee(0);
    setPaymentMethod("");
    setReferenceNo("");
    setRelatedSalesRefNo("");
    setPayee("");
    setNotes("");
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseDate, category, description, baseAmount, taxFee, totalAmount, paymentMethod, referenceNo, relatedSalesRefNo, payee, notes, actor: payee || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save expense");
      setMessage(`Expense saved successfully. ID: ${data?.expenseId || "created"}`);
      resetForm();
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadRows().catch((error: any) => setMessage(error?.message || "Failed to load expenses."));
  }, []);

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);
  const taxFeeTotal = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.TaxFee) || 0), 0), [rows]);
  const manualTotal = useMemo(() => rows.filter((row) => row.Source === "Expenses").reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);
  const supplierTotal = useMemo(() => rows.filter((row) => row.Source === "Supplier_Invoice_Costs").reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Record business expenses, fees, taxes, delivery costs paid by the company, fuel, labor, and miscellaneous costs.</p>
          </div>
          <button type="button" onClick={() => loadRows().catch(console.error)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Total Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(total)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Tax / VAT / Fees</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(taxFeeTotal)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Manual Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(manualTotal)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Supplier Costs</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(supplierTotal)}</p></div>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={submitExpense} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Add Expense</h2>
          <p className="mt-1 text-sm text-slate-600">Base amount is the expense before tax/fees. Total expense is what the company actually paid.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Expense Date"><input className={inputClass} type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required /></Field>
          <Field label="Category"><select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          <Field label="Description"><input className={inputClass} placeholder="Expense description" value={description} onChange={(event) => setDescription(event.target.value)} required /></Field>
          <Field label="Base Expense Amount"><input className={inputClass} type="number" step="0.01" min="0" placeholder="Amount before tax / fee" value={baseAmount} onChange={(event) => setBaseAmount(Number(event.target.value))} required /></Field>
          <Field label="Tax / VAT / Fee Amount"><input className={inputClass} type="number" step="0.01" min="0" placeholder="Tax, VAT, bank fee, or service fee" value={taxFee} onChange={(event) => setTaxFee(Number(event.target.value))} /></Field>
          <Field label="Total Expense Amount"><input className={readOnlyClass} value={currency(totalAmount)} readOnly /></Field>
          <Field label="Payment Method"><select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((item) => <option key={item || "blank"} value={item}>{item || "Select payment method"}</option>)}</select></Field>
          <Field label="Payment / Receipt Reference"><input className={inputClass} placeholder="Receipt, bank, or wallet ref" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} /></Field>
          <Field label="Related Sales Ref No."><input className={inputClass} placeholder="Optional sale reference" value={relatedSalesRefNo} onChange={(event) => setRelatedSalesRefNo(event.target.value)} /></Field>
          <Field label="Payee / Vendor"><input className={inputClass} placeholder="Vendor or payee" value={payee} onChange={(event) => setPayee(event.target.value)} /></Field>
          <Field label="Notes" className="md:col-span-2"><input className={inputClass} placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Expense"}</button>
          <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-bold text-slate-700">Clear</button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Expense Ledger</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr>{["Date","Category","Description","Base Amount","Tax/Fee Amount","Total Amount","Method","Reference","Sales Ref","Payee","Source","Notes"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.Source}-${row.Reference}-${row.ExpenseID || index}`} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">{row.Date}</td><td className="px-4 py-3 text-slate-700">{row.Category}</td><td className="px-4 py-3 text-slate-700">{row.Description}</td><td className="px-4 py-3 text-slate-700">{currency(Number(row.BaseAmount ?? row.Amount) || 0)}</td><td className="px-4 py-3 text-slate-700">{currency(Number(row.TaxFee) || 0)}</td><td className="px-4 py-3 font-semibold text-slate-800">{currency(Number(row.Amount) || 0)}</td><td className="px-4 py-3 text-slate-700">{row.PaymentMethod || "-"}</td><td className="px-4 py-3 text-slate-700">{row.Reference || "-"}</td><td className="px-4 py-3 text-slate-700">{row.RelatedSalesRefNo || "-"}</td><td className="px-4 py-3 text-slate-700">{row.Payee || "-"}</td><td className="px-4 py-3 text-slate-700">{row.Source}</td><td className="px-4 py-3 text-slate-700">{row.Notes}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
