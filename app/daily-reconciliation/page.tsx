"use client";

import { useMemo, useState } from "react";

type CollectionLine = {
  customerName: string;
  invoiceRef: string;
  amountPhp: number;
  paymentMethod: string;
  proofRef: string;
};

type ExpenseLine = {
  category: string;
  description: string;
  amountPhp: number;
  receiptRef: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
};

type ReturnLine = {
  customerName: string;
  product: string;
  qty: number;
  reason: string;
};

const paymentMethods = ["Cash", "GCash", "Maya", "Bank Transfer", "Check", "Other"];
const expenseCategories = ["Fuel", "Meal", "Vehicle Repair", "Toll/Parking", "Delivery Supplies", "Other"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyReconciliationPage() {
  const [reportDate, setReportDate] = useState(todayDate());
  const [salesmanName, setSalesmanName] = useState("");
  const [routeName, setRouteName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");

  const [cashAdvancePhp, setCashAdvancePhp] = useState(0);
  const [cashSalesPhp, setCashSalesPhp] = useState(0);
  const [depositsPhp, setDepositsPhp] = useState(0);
  const [actualCashRemittedPhp, setActualCashRemittedPhp] = useState(0);
  const [invoiceScanRef, setInvoiceScanRef] = useState("");
  const [remittanceProofRef, setRemittanceProofRef] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [collections, setCollections] = useState<CollectionLine[]>([
    { customerName: "", invoiceRef: "", amountPhp: 0, paymentMethod: "Cash", proofRef: "" },
  ]);

  const [expenses, setExpenses] = useState<ExpenseLine[]>([
    { category: "Fuel", description: "", amountPhp: 0, receiptRef: "", approvalStatus: "Pending" },
  ]);

  const [returns, setReturns] = useState<ReturnLine[]>([
    { customerName: "", product: "", qty: 0, reason: "" },
  ]);

  const collectionTotalPhp = useMemo(
    () => collections.reduce((sum, line) => sum + (Number(line.amountPhp) || 0), 0),
    [collections]
  );

  const approvedExpenseTotalPhp = useMemo(
    () => expenses.reduce((sum, line) => {
      if (line.approvalStatus !== "Approved") return sum;
      return sum + (Number(line.amountPhp) || 0);
    }, 0),
    [expenses]
  );

  const pendingExpenseTotalPhp = useMemo(
    () => expenses.reduce((sum, line) => {
      if (line.approvalStatus !== "Pending") return sum;
      return sum + (Number(line.amountPhp) || 0);
    }, 0),
    [expenses]
  );

  const expectedCashRemittancePhp =
    (Number(cashAdvancePhp) || 0) +
    (Number(cashSalesPhp) || 0) +
    collectionTotalPhp -
    approvedExpenseTotalPhp -
    (Number(depositsPhp) || 0);

  const variancePhp = (Number(actualCashRemittedPhp) || 0) - expectedCashRemittancePhp;
  const hasVariance = Math.abs(variancePhp) > 0.009;

  function updateCollection(index: number, patch: Partial<CollectionLine>) {
    setCollections((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function updateExpense(index: number, patch: Partial<ExpenseLine>) {
    setExpenses((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function updateReturn(index: number, patch: Partial<ReturnLine>) {
    setReturns((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function resetForm() {
    setReportDate(todayDate());
    setSalesmanName("");
    setRouteName("");
    setVehicleNo("");
    setCashAdvancePhp(0);
    setCashSalesPhp(0);
    setDepositsPhp(0);
    setActualCashRemittedPhp(0);
    setInvoiceScanRef("");
    setRemittanceProofRef("");
    setNotes("");
    setCollections([{ customerName: "", invoiceRef: "", amountPhp: 0, paymentMethod: "Cash", proofRef: "" }]);
    setExpenses([{ category: "Fuel", description: "", amountPhp: 0, receiptRef: "", approvalStatus: "Pending" }]);
    setReturns([{ customerName: "", product: "", qty: 0, reason: "" }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!reportDate || !salesmanName.trim()) {
        throw new Error("Report date and salesman name are required.");
      }

      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate,
          salesmanName,
          routeName,
          vehicleNo,
          cashAdvancePhp,
          cashSalesPhp,
          collectionTotalPhp,
          approvedExpenseTotalPhp,
          pendingExpenseTotalPhp,
          depositsPhp,
          expectedCashRemittancePhp,
          actualCashRemittedPhp,
          variancePhp,
          invoiceScanRef,
          remittanceProofRef,
          collections,
          expenses,
          returns,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save daily report.");

      setMessage(
        `Daily report saved. Report ID: ${data.reportId}. Status: ${data.accountingReviewStatus}. Variance: ${money(Number(data.variancePhp) || 0)}.`
      );
      resetForm();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save daily report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Internal Use Only</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Daily Liquidation & Reconciliation</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">
          This module supports internal auditing, salesman liquidation, and accounting reconciliation. It does not issue official BIR invoices or receipts and does not replace registered books of accounts.
        </p>
        {message ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Report Header</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Salesman Name" value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Route / Area" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Cash Summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Cash Advance" value={cashAdvancePhp} onChange={(e) => setCashAdvancePhp(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Cash Sales" value={cashSalesPhp} onChange={(e) => setCashSalesPhp(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Deposits / Bank Transfers" value={depositsPhp} onChange={(e) => setDepositsPhp(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Actual Cash Remitted" value={actualCashRemittedPhp} onChange={(e) => setActualCashRemittedPhp(Number(e.target.value))} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Collections</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{money(collectionTotalPhp)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Approved Expenses</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{money(approvedExpenseTotalPhp)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Pending Expenses</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{money(pendingExpenseTotalPhp)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Expected Cash</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{money(expectedCashRemittancePhp)}</p>
            </div>
            <div className={`rounded-2xl p-4 ${hasVariance ? "bg-red-50" : "bg-emerald-50"}`}>
              <p className={`text-xs ${hasVariance ? "text-red-600" : "text-emerald-700"}`}>Variance</p>
              <p className={`mt-1 text-lg font-semibold ${hasVariance ? "text-red-700" : "text-emerald-700"}`}>{money(variancePhp)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Collections</h2>
            <button type="button" onClick={() => setCollections((prev) => [...prev, { customerName: "", invoiceRef: "", amountPhp: 0, paymentMethod: "Cash", proofRef: "" }])} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Add Collection</button>
          </div>
          <div className="mt-4 space-y-3">
            {collections.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-6">
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Customer" value={line.customerName} onChange={(e) => updateCollection(index, { customerName: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Invoice Ref" value={line.invoiceRef} onChange={(e) => updateCollection(index, { invoiceRef: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Amount" value={line.amountPhp} onChange={(e) => updateCollection(index, { amountPhp: Number(e.target.value) })} />
                <select className="rounded-xl border border-slate-300 px-3 py-2" value={line.paymentMethod} onChange={(e) => updateCollection(index, { paymentMethod: e.target.value })}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Proof / Scan Ref" value={line.proofRef} onChange={(e) => updateCollection(index, { proofRef: e.target.value })} />
                <button type="button" onClick={() => setCollections((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Expenses</h2>
            <button type="button" onClick={() => setExpenses((prev) => [...prev, { category: "Fuel", description: "", amountPhp: 0, receiptRef: "", approvalStatus: "Pending" }])} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Add Expense</button>
          </div>
          <div className="mt-4 space-y-3">
            {expenses.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-6">
                <select className="rounded-xl border border-slate-300 px-3 py-2" value={line.category} onChange={(e) => updateExpense(index, { category: e.target.value })}>
                  {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Description" value={line.description} onChange={(e) => updateExpense(index, { description: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Amount" value={line.amountPhp} onChange={(e) => updateExpense(index, { amountPhp: Number(e.target.value) })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Receipt Scan Ref" value={line.receiptRef} onChange={(e) => updateExpense(index, { receiptRef: e.target.value })} />
                <select className="rounded-xl border border-slate-300 px-3 py-2" value={line.approvalStatus} onChange={(e) => updateExpense(index, { approvalStatus: e.target.value as ExpenseLine["approvalStatus"] })}>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button type="button" onClick={() => setExpenses((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Remove</button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Only approved expenses are deducted from expected cash. Pending expenses stay visible for accounting review.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Returns / Bad Orders</h2>
            <button type="button" onClick={() => setReturns((prev) => [...prev, { customerName: "", product: "", qty: 0, reason: "" }])} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Add Return</button>
          </div>
          <div className="mt-4 space-y-3">
            {returns.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-5">
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Customer" value={line.customerName} onChange={(e) => updateReturn(index, { customerName: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Product" value={line.product} onChange={(e) => updateReturn(index, { product: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" placeholder="Qty" value={line.qty} onChange={(e) => updateReturn(index, { qty: Number(e.target.value) })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Reason" value={line.reason} onChange={(e) => updateReturn(index, { reason: e.target.value })} />
                <button type="button" onClick={() => setReturns((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Document Proof</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Invoice Scan Reference / File Name" value={invoiceScanRef} onChange={(e) => setInvoiceScanRef(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Remittance / Deposit Proof Ref" value={remittanceProofRef} onChange={(e) => setRemittanceProofRef(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Accounting Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
            {saving ? "Saving Report..." : "Save Daily Report"}
          </button>
          <p className="text-sm text-slate-600">
            Formula: Expected Cash = Cash Advance + Cash Sales + Collections - Approved Expenses - Deposits / Bank Transfers
          </p>
        </div>
      </form>
    </section>
  );
}
