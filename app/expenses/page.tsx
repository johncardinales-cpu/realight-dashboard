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
  CustomerName?: string;
  Payee?: string;
  ExpensePaymentStatus?: string;
  AmountPaid?: number;
  BalanceAmount?: number;
  Source: string;
  Notes: string;
  ExpenseID?: string;
};

type CustomerRow = { customerName: string; phone?: string; customerType?: string };

const categories = ["Bank Fees", "Payment Processing Fees", "Delivery / Logistics Expense", "Fuel / Transportation", "Installation Labor", "Tools and Equipment", "Office Supplies", "Utilities", "Rent", "Repairs and Maintenance", "Marketing", "Taxes and Permits", "Staff Allowance", "Professional Fees", "Miscellaneous"];
const paymentMethods = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit Card", "Other"];
const expensePaymentStatuses = ["Paid", "Installment", "Pending"];

function currency(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-1 ${className}`}><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>;
}

function customerLabel(row: CustomerRow) {
  return `${row.customerName}${row.phone ? ` | ${row.phone}` : ""}${row.customerType ? ` | ${row.customerType}` : ""}`;
}

function isExpenseOpen(row: ExpenseRow) {
  return Number(row.BalanceAmount || 0) > 0 || ["installment", "pending"].includes(String(row.ExpensePaymentStatus || "").toLowerCase());
}

function StatusPill({ value }: { value: string }) {
  const normalized = String(value || "Paid").toLowerCase();
  const color = normalized === "paid" ? "bg-emerald-50 text-emerald-700" : normalized === "installment" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value || "Paid"}</span>;
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
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
  const [customerName, setCustomerName] = useState("");
  const [payee, setPayee] = useState("");
  const [expensePaymentStatus, setExpensePaymentStatus] = useState("Paid");
  const [amountPaidPhp, setAmountPaidPhp] = useState(0);
  const [notes, setNotes] = useState("");

  const totalAmount = useMemo(() => Math.max((Number(baseAmount) || 0) + (Number(taxFee) || 0), 0), [baseAmount, taxFee]);
  const paidAmount = useMemo(() => {
    if (expensePaymentStatus === "Paid") return totalAmount;
    if (expensePaymentStatus === "Pending") return 0;
    return Math.min(Math.max(Number(amountPaidPhp) || 0, 0), totalAmount);
  }, [amountPaidPhp, expensePaymentStatus, totalAmount]);
  const balanceAmount = useMemo(() => Math.max(totalAmount - paidAmount, 0), [totalAmount, paidAmount]);
  const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50";
  const readOnlyClass = "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";
  const customerOptions = useMemo(() => customers.map(customerLabel), [customers]);

  useEffect(() => {
    if (expensePaymentStatus === "Paid") setAmountPaidPhp(totalAmount);
    if (expensePaymentStatus === "Pending") setAmountPaidPhp(0);
    if (expensePaymentStatus === "Installment" && amountPaidPhp > totalAmount) setAmountPaidPhp(totalAmount);
  }, [expensePaymentStatus, totalAmount, amountPaidPhp]);

  async function loadRows() {
    const [expensesRes, customersRes] = await Promise.all([
      fetch("/api/expenses", { cache: "no-store" }),
      fetch("/api/customers", { cache: "no-store" }).catch(() => null),
    ]);
    const data = await expensesRes.json();
    const customerData = customersRes ? await customersRes.json().catch(() => []) : [];
    if (!expensesRes.ok) throw new Error(data?.error || "Failed to load expenses");
    setRows(Array.isArray(data.rows) ? data.rows : []);
    setCustomers(Array.isArray(customerData) ? customerData : []);
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
    setCustomerName("");
    setPayee("");
    setExpensePaymentStatus("Paid");
    setAmountPaidPhp(0);
    setNotes("");
  }

  function selectCustomer(value: string) {
    const match = customers.find((customer) => customerLabel(customer).toLowerCase() === value.toLowerCase() || customer.customerName.toLowerCase() === value.toLowerCase());
    setCustomerName(match ? match.customerName : value);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseDate, category, description, baseAmount, taxFee, totalAmount, paymentMethod, referenceNo, relatedSalesRefNo, customerName, payee, expensePaymentStatus, amountPaidPhp: paidAmount, balanceAmount, notes, actor: payee || customerName || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save expense");
      setMessage(`Expense saved successfully. ${data?.expensePaymentStatus || expensePaymentStatus} - balance ${currency(data?.balanceAmount ?? balanceAmount)}.`);
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
  const payablesTotal = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.BalanceAmount) || 0), 0), [rows]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Record business expenses, fees, taxes, delivery costs paid by the company, fuel, labor, miscellaneous costs, and installment expense balances.</p>
          </div>
          <button type="button" onClick={() => loadRows().catch(console.error)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Total Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(total)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Tax / VAT / Fees</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(taxFeeTotal)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Manual Expenses</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(manualTotal)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Supplier Costs</p><p className="mt-1 text-2xl font-bold text-slate-950">{currency(supplierTotal)}</p></div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-600">Expense Payables</p><p className="mt-1 text-2xl font-bold text-rose-700">{currency(payablesTotal)}</p></div>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={submitExpense} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Add Expense</h2>
          <p className="mt-1 text-sm text-slate-600">Use Paid for fully paid expenses. Use Installment or Pending when the expense still has balance.</p>
        </div>
        <datalist id="expense-customer-options">{customerOptions.map((item) => <option key={item} value={item} />)}</datalist>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Expense Date"><input className={inputClass} type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required /></Field>
          <Field label="Category"><select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          <Field label="Description"><input className={inputClass} placeholder="Expense description" value={description} onChange={(event) => setDescription(event.target.value)} required /></Field>
          <Field label="Customer / Expense For"><input list="expense-customer-options" className={inputClass} placeholder="Customer, project, or person this expense is for" value={customerName} onChange={(event) => selectCustomer(event.target.value)} /></Field>
          <Field label="Expense Payment Status"><select className={inputClass} value={expensePaymentStatus} onChange={(event) => setExpensePaymentStatus(event.target.value)}>{expensePaymentStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          <Field label="Amount Paid"><input className={expensePaymentStatus === "Installment" ? inputClass : readOnlyClass} type="number" step="0.01" min="0" value={paidAmount} onChange={(event) => setAmountPaidPhp(Number(event.target.value))} readOnly={expensePaymentStatus !== "Installment"} /></Field>
          <Field label="Base Expense Amount"><input className={inputClass} type="number" step="0.01" min="0" placeholder="Amount before tax / fee" value={baseAmount} onChange={(event) => setBaseAmount(Number(event.target.value))} required /></Field>
          <Field label="Tax / VAT / Fee Amount"><input className={inputClass} type="number" step="0.01" min="0" placeholder="Tax, VAT, bank fee, or service fee" value={taxFee} onChange={(event) => setTaxFee(Number(event.target.value))} /></Field>
          <Field label="Total Expense Amount"><input className={readOnlyClass} value={currency(totalAmount)} readOnly /></Field>
          <Field label="Balance Remaining"><input className={readOnlyClass} value={currency(balanceAmount)} readOnly /></Field>
          <Field label="Payment Method"><select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((item) => <option key={item || "blank"} value={item}>{item || "Select payment method"}</option>)}</select></Field>
          <Field label="Payment / Receipt Reference"><input className={inputClass} placeholder="Receipt, bank, or wallet ref" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} /></Field>
          <Field label="Related Sales Ref No."><input className={inputClass} placeholder="Optional sale reference" value={relatedSalesRefNo} onChange={(event) => setRelatedSalesRefNo(event.target.value)} /></Field>
          <Field label="Payee / Vendor"><input className={inputClass} placeholder="Vendor or payee" value={payee} onChange={(event) => setPayee(event.target.value)} /></Field>
          <Field label="Notes"><input className={inputClass} placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
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
            <thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Category", "Customer / For", "Description", "Total Amount", "Paid", "Balance", "Status", "Method", "Reference", "Sales Ref", "Payee", "Source", "Notes"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const open = isExpenseOpen(row);
                return (
                  <tr key={`${row.Source}-${row.Reference}-${row.ExpenseID || index}`} className={`border-t border-slate-100 align-top ${open ? "bg-rose-50/40" : ""}`}>
                    <td className="px-4 py-3 text-slate-700">{normalizeDate(row.Date)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Category}</td>
                    <td className={`px-4 py-3 font-semibold ${open ? "text-rose-700" : "text-slate-800"}`}>{row.CustomerName || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Description}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{currency(Number(row.Amount) || 0)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{currency(Number(row.AmountPaid ?? row.Amount) || 0)}</td>
                    <td className={`px-4 py-3 font-bold ${open ? "text-rose-700" : "text-emerald-700"}`}>{currency(Number(row.BalanceAmount) || 0)}</td>
                    <td className="px-4 py-3"><StatusPill value={row.ExpensePaymentStatus || "Paid"} /></td>
                    <td className="px-4 py-3 text-slate-700">{row.PaymentMethod || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Reference || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.RelatedSalesRefNo || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Payee || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Source}</td>
                    <td className="px-4 py-3 text-slate-700">{row.Notes}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={14} className="px-4 py-8 text-center text-slate-500">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
