"use client";

import { useEffect, useMemo, useState } from "react";

type PaymentSummary = {
  key: string;
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

const paymentMethodOptions = ["Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : normalized === "partial"
      ? "bg-amber-50 text-amber-700"
      : normalized === "confirmed"
        ? "bg-emerald-50 text-emerald-700"
        : normalized === "cancelled"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountPaidPhp, setAmountPaidPhp] = useState(0);
  const [transactionRef, setTransactionRef] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPayments() {
    const res = await fetch("/api/payments", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadPayments().catch(console.error);
  }, []);

  const selectedSale = useMemo(() => rows.find((row) => row.key === selectedKey), [rows, selectedKey]);
  const openBalances = rows.filter((row) => row.balancePhp > 0);
  const paymentAmount = Number(amountPaidPhp) || 0;
  const balanceAfterPayment = Math.max((selectedSale?.balancePhp || 0) - paymentAmount, 0);

  function selectSale(key: string) {
    const sale = rows.find((row) => row.key === key);
    setSelectedKey(key);
    setAmountPaidPhp(sale?.balancePhp || 0);
    setMessage("");
  }

  function resetPaymentForm() {
    setSelectedKey("");
    setPaymentDate(today());
    setPaymentMethod("Cash");
    setAmountPaidPhp(0);
    setTransactionRef("");
    setCashierName("");
    setNotes("");
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!selectedSale) throw new Error("Select a sale with open balance first.");
      if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero.");
      if (paymentAmount > selectedSale.balancePhp) throw new Error(`Payment cannot exceed balance of ${money(selectedSale.balancePhp)}.`);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selectedSale.key,
          salesRefNo: selectedSale.salesRefNo,
          groupRef: selectedSale.groupRef,
          paymentDate,
          paymentMethod,
          amountPaidPhp: paymentAmount,
          transactionRef,
          cashierName,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save payment.");

      setMessage(`Payment saved. ${data.paymentStatus} - remaining balance ${money(data.balancePhp)}.`);
      resetPaymentForm();
      await loadPayments();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete partial payments by selecting an existing sale, recording the payment, and updating the balance.
        </p>
        {message ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Open Balances</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {["Date", "Sales Ref", "Customer", "Total", "Paid", "Balance", "Payment", "Sale", "Action"].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openBalances.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{row.saleDate}</td>
                    <td className="px-4 py-3 text-slate-700">{row.salesRefNo}</td>
                    <td className="px-4 py-3 text-slate-700">{row.customerName}</td>
                    <td className="px-4 py-3 text-slate-700">{money(row.totalSalePhp)}</td>
                    <td className="px-4 py-3 text-slate-700">{money(row.totalPaidPhp)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(row.balancePhp)}</td>
                    <td className="px-4 py-3"><StatusPill value={row.paymentStatus} /></td>
                    <td className="px-4 py-3"><StatusPill value={row.saleStatus} /></td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => selectSale(row.key)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm">
                        Add Payment
                      </button>
                    </td>
                  </tr>
                ))}
                {!openBalances.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No open balances found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={savePayment} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Complete Payment</h2>
          <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={selectedKey} onChange={(e) => selectSale(e.target.value)}>
            <option value="">Select sale with balance</option>
            {openBalances.map((row) => (
              <option key={row.key} value={row.key}>{row.salesRefNo} - {row.customerName} - {money(row.balancePhp)}</option>
            ))}
          </select>

          {selectedSale ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Customer:</span> {selectedSale.customerName}</p>
              <p><span className="font-semibold">Total Sale:</span> {money(selectedSale.totalSalePhp)}</p>
              <p><span className="font-semibold">Already Paid:</span> {money(selectedSale.totalPaidPhp)}</p>
              <p><span className="font-semibold">Current Balance:</span> {money(selectedSale.balancePhp)}</p>
              <p><span className="font-semibold">Balance After Payment:</span> {money(balanceAfterPayment)}</p>
            </div>
          ) : null}

          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {paymentMethodOptions.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Amount Paid" value={amountPaidPhp} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Transaction / Receipt Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Cashier Name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <button type="submit" disabled={saving || !selectedSale} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Saving Payment..." : "Save Payment"}
          </button>
        </form>
      </div>
    </section>
  );
}
