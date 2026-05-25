"use client";

import { useEffect, useMemo, useState } from "react";

type SaleRow = {
  saleId: string;
  saleDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  description: string;
  specification: string;
  qty: number;
  totalSalePhp: number;
  amountPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  paymentMethod?: string;
  transactionRef?: string;
  saleStatus: string;
  cashierName: string;
};

type SaleSummary = {
  saleId: string;
  key: string;
  saleDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  totalSalePhp: number;
  paidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionRef: string;
  saleStatus: string;
  cashierName: string;
  lineCount: number;
  items: string[];
};

type PaymentEdit = {
  paymentStatus: string;
  amountPaidPhp: string;
  paymentMethod: string;
  transactionRef: string;
  cashierName: string;
};

const paymentStatusOptions = ["Paid", "Partial", "Pending"];
const paymentMethodOptions = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized === "confirmed" || normalized === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : normalized === "partial"
      ? "bg-amber-50 text-amber-700"
      : normalized === "cancelled"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

function buildPaymentEdit(sale: SaleSummary): PaymentEdit {
  return {
    paymentStatus: sale.paymentStatus || "Pending",
    amountPaidPhp: String(sale.paidPhp || 0),
    paymentMethod: sale.paymentMethod || "",
    transactionRef: sale.transactionRef || "",
    cashierName: sale.cashierName || "Admin",
  };
}

function summarizeSales(rows: SaleRow[]) {
  const map = new Map<string, SaleSummary>();

  rows.forEach((row) => {
    const key = row.saleId || row.groupRef || row.salesRefNo;
    if (!key) return;

    const current = map.get(key) || {
      saleId: row.saleId || "",
      key,
      saleDate: row.saleDate,
      salesRefNo: row.salesRefNo,
      groupRef: row.groupRef,
      customerName: row.customerName,
      totalSalePhp: 0,
      paidPhp: 0,
      balancePhp: 0,
      paymentStatus: row.paymentStatus || "Pending",
      paymentMethod: row.paymentMethod || "",
      transactionRef: row.transactionRef || "",
      saleStatus: row.saleStatus || "Draft",
      cashierName: row.cashierName || "",
      lineCount: 0,
      items: [],
    };

    current.totalSalePhp += Number(row.totalSalePhp) || 0;
    current.paidPhp += Number(row.amountPaidPhp) || 0;
    current.balancePhp += Number(row.balancePhp) || 0;
    current.lineCount += 1;
    current.items.push(`${row.description} / ${row.specification} x ${row.qty}`);
    if (!current.saleId && row.saleId) current.saleId = row.saleId;
    if (!current.cashierName && row.cashierName) current.cashierName = row.cashierName;
    if (!current.paymentMethod && row.paymentMethod) current.paymentMethod = row.paymentMethod;
    if (!current.transactionRef && row.transactionRef) current.transactionRef = row.transactionRef;
    current.paymentStatus = row.paymentStatus || current.paymentStatus;
    current.saleStatus = row.saleStatus || current.saleStatus;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => `${b.saleDate}-${b.salesRefNo}`.localeCompare(`${a.saleDate}-${a.salesRefNo}`));
}

export default function ConfirmSalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState("");
  const [paymentEdits, setPaymentEdits] = useState<Record<string, PaymentEdit>>({});

  async function loadSales() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/sales", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load sales");
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }

  function getPaymentEdit(sale: SaleSummary) {
    return paymentEdits[sale.key] || buildPaymentEdit(sale);
  }

  function updatePaymentEdit(sale: SaleSummary, patch: Partial<PaymentEdit>) {
    setPaymentEdits((current) => ({
      ...current,
      [sale.key]: { ...getPaymentEdit(sale), ...patch },
    }));
  }

  async function updateSalePayment(sale: SaleSummary) {
    const edit = getPaymentEdit(sale);
    setWorkingKey(`payment-${sale.key}`);
    setMessage("");

    try {
      const res = await fetch("/api/sales/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-payment",
          saleId: sale.saleId,
          salesRefNo: sale.salesRefNo,
          groupRef: sale.groupRef,
          paymentStatus: edit.paymentStatus,
          amountPaidPhp: Number(edit.amountPaidPhp) || 0,
          paymentMethod: edit.paymentMethod,
          transactionRef: edit.transactionRef,
          cashierName: edit.cashierName,
          actor: edit.cashierName || sale.cashierName || "Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update payment");
      setMessage(data?.message || "Payment updated successfully.");
      setPaymentEdits((current) => {
        const next = { ...current };
        delete next[sale.key];
        return next;
      });
      await loadSales();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update payment.");
    } finally {
      setWorkingKey("");
    }
  }

  async function updateConfirmation(sale: SaleSummary, action: "confirm" | "undo") {
    const isUndo = action === "undo";
    const edit = getPaymentEdit(sale);
    const prompt = isUndo
      ? `Undo confirmation for ${sale.salesRefNo || sale.groupRef}?\n\nThis will return the sale to Draft and restore inventory calculations.`
      : `Confirm sale ${sale.salesRefNo || sale.groupRef}?\n\nThis will mark the sale Paid and deduct inventory.`;

    if (!window.confirm(prompt)) return;

    setWorkingKey(`${action}-${sale.key}`);
    setMessage("");

    try {
      const res = await fetch("/api/sales/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          saleId: sale.saleId,
          salesRefNo: sale.salesRefNo,
          groupRef: sale.groupRef,
          paymentMethod: edit.paymentMethod,
          transactionRef: edit.transactionRef,
          cashierName: edit.cashierName,
          actor: edit.cashierName || sale.cashierName || "Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update sale confirmation");
      setMessage(data?.message || "Sale confirmation updated successfully.");
      setPaymentEdits((current) => {
        const next = { ...current };
        delete next[sale.key];
        return next;
      });
      await loadSales();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update sale confirmation.");
    } finally {
      setWorkingKey("");
    }
  }

  useEffect(() => {
    loadSales().catch(console.error);
  }, []);

  const summaries = useMemo(() => summarizeSales(rows), [rows]);
  const reviewSales = summaries.filter((sale) => sale.saleStatus.toLowerCase() !== "cancelled");

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Confirm Sales</h1>
            <p className="mt-1 text-sm text-slate-600">
              Confirm an existing sale to mark it Paid and make it count for inventory deduction. Edit payment details here before confirming if needed.
            </p>
          </div>
          <button type="button" onClick={loadSales} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Sales Confirmation Review</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["Date", "Sales Ref", "Customer", "Items", "Total", "Paid", "Balance", "Payment", "Sale", "Edit Payment", "Action"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewSales.map((sale) => {
                const isConfirmed = sale.saleStatus.toLowerCase() === "confirmed";
                const edit = getPaymentEdit(sale);
                return (
                  <tr key={sale.key} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">{sale.saleDate}</td>
                    <td className="px-4 py-3 text-slate-700">{sale.salesRefNo}</td>
                    <td className="px-4 py-3 text-slate-700">{sale.customerName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="max-w-sm space-y-1">
                        {sale.items.slice(0, 3).map((item) => <p key={item}>{item}</p>)}
                        {sale.items.length > 3 ? <p className="text-xs font-semibold text-slate-500">+{sale.items.length - 3} more</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{money(sale.totalSalePhp)}</td>
                    <td className="px-4 py-3 text-slate-700">{money(sale.paidPhp)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{money(sale.balancePhp)}</td>
                    <td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td>
                    <td className="px-4 py-3"><StatusPill value={sale.saleStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="grid min-w-[360px] gap-2 sm:grid-cols-2">
                        <select value={edit.paymentStatus} onChange={(event) => updatePaymentEdit(sale, { paymentStatus: event.target.value, amountPaidPhp: event.target.value === "Paid" ? String(sale.totalSalePhp) : event.target.value === "Pending" ? "0" : edit.amountPaidPhp })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                          {paymentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <input type="number" step="0.01" min="0" value={edit.amountPaidPhp} onChange={(event) => updatePaymentEdit(sale, { amountPaidPhp: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" placeholder="Amount paid" />
                        <select value={edit.paymentMethod} onChange={(event) => updatePaymentEdit(sale, { paymentMethod: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                          {paymentMethodOptions.map((method) => <option key={method || "blank"} value={method}>{method || "Payment Method"}</option>)}
                        </select>
                        <input value={edit.cashierName} onChange={(event) => updatePaymentEdit(sale, { cashierName: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" placeholder="Cashier" />
                        <input value={edit.transactionRef} onChange={(event) => updatePaymentEdit(sale, { transactionRef: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 sm:col-span-2" placeholder="Receipt / transaction ref" />
                        <button type="button" onClick={() => updateSalePayment(sale)} disabled={workingKey === `payment-${sale.key}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50 sm:col-span-2">
                          {workingKey === `payment-${sale.key}` ? "Saving Payment..." : "Save Payment Changes"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isConfirmed ? (
                        <button type="button" onClick={() => updateConfirmation(sale, "undo")} disabled={workingKey === `undo-${sale.key}`} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300 disabled:text-slate-600">
                          {workingKey === `undo-${sale.key}` ? "Undoing..." : "Undo Confirm"}
                        </button>
                      ) : (
                        <button type="button" onClick={() => updateConfirmation(sale, "confirm")} disabled={workingKey === `confirm-${sale.key}`} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300 disabled:text-slate-600">
                          {workingKey === `confirm-${sale.key}` ? "Confirming..." : "Confirm + Mark Paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!reviewSales.length && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No sales available for confirmation review.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-500">
          Rule: confirming a sale marks it Paid and deducts inventory. Use Edit Payment to correct method, paid amount, cashier, or reference before confirming. Undo Confirm returns the sale to Draft but keeps the payment record for review.
        </p>
      </div>
    </section>
  );
}
