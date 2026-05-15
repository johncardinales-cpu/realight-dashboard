"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ExpenseRow = {
  Date: string;
  Category: string;
  Description: string;
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
  return `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState("Miscellaneous");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [relatedSalesRefNo, setRelatedSalesRefNo] = useState("");
  const [payee, setPayee] = useState("");
  const [notes, setNotes] = useState("");

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
    setAmount(0);
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
        body: JSON.stringify({
          expenseDate,
          category,
          description,
          amount,
          paymentMethod,
          referenceNo,
          relatedSalesRefNo,
          payee,
          notes,
          actor: payee || "Admin",
        }),
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
    loadRows().catch((error: any) => {
      setMessage(error?.message || "Failed to load expenses.");
    });
  }, []);

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);
  const manualTotal = useMemo(() => rows.filter((row) => row.Source === "Expenses").reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);
  const supplierTotal = useMemo(() => rows.filter((row) => row.Source === "Supplier_Invoice_Costs").reduce((sum, row) => sum + (Number(row.Amount) || 0), 0), [rows]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Record business expenses such as bank fees, taxes, delivery costs paid by the company, fuel, staff allowance, utilities, and miscellaneous costs.
            </p>
          </div>
          <button type="button" onClick={() => loadRows().catch(console.error)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Total Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(total)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Manual Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(manualTotal)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Supplier Costs</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(supplierTotal)}</p></div>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={submitExpense} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Add Expense</h2>
          <p className="mt-1 text-sm text-slate-600">If customer pays a charge, put it in Sales. If the company pays it, put it here as an expense.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required />
          <select className="rounded-xl border border-slate-300 px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value)} required>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} required />
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(event) => setAmount(Number(event.target.value))} required />
          <select className="rounded-xl border border-slate-300 px-3 py-2" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {paymentMethods.map((item) => <option key={item || "blank"} value={item}>{item || "Payment Method"}</option>)}
          </select>
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Reference No." value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Related Sales Ref No. optional" value={relatedSalesRefNo} onChange={(event) => setRelatedSalesRefNo(event.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Payee / Vendor" value={payee} onChange={(event) => setPayee(event.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
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
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Description</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Method</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Reference</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sales Ref</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Payee</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Source</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.Source}-${row.Reference}-${row.ExpenseID || index}`} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">{row.Date}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Category}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Description}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{currency(Number(row.Amount) || 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.PaymentMethod || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Reference || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.RelatedSalesRefNo || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Payee || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Source}</td>
                  <td className="px-4 py-3 text-slate-700">{row.Notes}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
