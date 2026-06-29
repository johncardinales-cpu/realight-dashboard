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

type PaymentSummary = {
  key: string;
  saleId?: string;
  salesRefNo?: string;
  groupRef?: string;
  totalSalePhp: number;
  totalPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
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

type SaleAction = "confirm" | "undo" | "void";

const paymentStatusOptions = ["Paid", "Partial", "Pending"];
const paymentMethodOptions = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function computedPaymentStatus(paid: number, total: number) {
  const p = round(paid);
  const t = round(total);
  if (t <= 0 || p <= 0) return "Pending";
  return p + 0.009 >= t ? "Paid" : "Partial";
}

function isInactive(value: string) {
  return ["cancelled", "canceled", "voided"].includes(String(value || "").toLowerCase());
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
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized === "confirmed" || normalized === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : normalized === "partial"
      ? "bg-amber-50 text-amber-700"
      : isInactive(value)
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

function paymentMapKey(row: { saleId?: string; groupRef?: string; salesRefNo?: string; key?: string }) {
  return row.saleId || row.groupRef || row.salesRefNo || row.key || "";
}

function buildPaymentMap(rows: PaymentSummary[]) {
  const map = new Map<string, PaymentSummary>();
  rows.forEach((row) => [row.saleId, row.groupRef, row.salesRefNo, row.key].filter(Boolean).forEach((key) => map.set(String(key), row)));
  return map;
}

function buildPaymentEdit(sale: SaleSummary): PaymentEdit {
  return {
    paymentStatus: computedPaymentStatus(sale.paidPhp, sale.totalSalePhp),
    amountPaidPhp: String(round(sale.paidPhp || 0)),
    paymentMethod: sale.paymentMethod || "",
    transactionRef: sale.transactionRef || "",
    cashierName: sale.cashierName || "Admin",
  };
}

function summarizeSales(rows: SaleRow[], paymentRows: PaymentSummary[]) {
  const payments = buildPaymentMap(paymentRows);
  const map = new Map<string, SaleSummary>();

  rows.forEach((row) => {
    const key = row.saleId || row.groupRef || row.salesRefNo;
    if (!key) return;
    const current = map.get(key) || {
      saleId: row.saleId || "",
      key,
      saleDate: normalizeDate(row.saleDate),
      salesRefNo: row.salesRefNo,
      groupRef: row.groupRef,
      customerName: row.customerName,
      totalSalePhp: 0,
      paidPhp: 0,
      balancePhp: 0,
      paymentStatus: "Pending",
      paymentMethod: row.paymentMethod || "",
      transactionRef: row.transactionRef || "",
      saleStatus: row.saleStatus || "Draft",
      cashierName: row.cashierName || "",
      lineCount: 0,
      items: [],
    };

    current.totalSalePhp = round(current.totalSalePhp + (Number(row.totalSalePhp) || 0));
    current.paidPhp = round(current.paidPhp + (Number(row.amountPaidPhp) || 0));
    current.lineCount += 1;
    current.items.push(`${row.description} / ${row.specification} x ${row.qty}`);
    if (!current.saleId && row.saleId) current.saleId = row.saleId;
    if (!current.cashierName && row.cashierName) current.cashierName = row.cashierName;
    if (!current.paymentMethod && row.paymentMethod) current.paymentMethod = row.paymentMethod;
    if (!current.transactionRef && row.transactionRef) current.transactionRef = row.transactionRef;
    current.saleStatus = row.saleStatus || current.saleStatus;
    map.set(key, current);
  });

  return Array.from(map.values()).map((sale) => {
    const payment = payments.get(paymentMapKey(sale)) || payments.get(sale.saleId) || payments.get(sale.groupRef) || payments.get(sale.salesRefNo);
    if (payment && !isInactive(sale.saleStatus)) {
      const paid = round(payment.totalPaidPhp);
      const balance = round(payment.balancePhp);
      return {
        ...sale,
        paidPhp: paid,
        balancePhp: balance,
        paymentStatus: computedPaymentStatus(paid, payment.totalSalePhp || sale.totalSalePhp),
        saleStatus: payment.saleStatus || sale.saleStatus,
      };
    }
    const paid = round(Math.min(Math.max(sale.paidPhp, 0), sale.totalSalePhp));
    return {
      ...sale,
      paidPhp: paid,
      balancePhp: round(Math.max(sale.totalSalePhp - paid, 0)),
      paymentStatus: computedPaymentStatus(paid, sale.totalSalePhp),
    };
  }).sort((a, b) => `${b.saleDate}-${b.salesRefNo}`.localeCompare(`${a.saleDate}-${a.salesRefNo}`));
}

function targetPayload(sale: SaleSummary) {
  return sale.saleId ? { saleId: sale.saleId, salesRefNo: "", groupRef: "" } : { saleId: "", salesRefNo: sale.salesRefNo, groupRef: sale.groupRef };
}

function validatePaymentEdit(edit: PaymentEdit, sale: SaleSummary) {
  const status = edit.paymentStatus.toLowerCase();
  const method = edit.paymentMethod.toLowerCase();
  const paid = round(Number(edit.amountPaidPhp) || 0);
  const total = round(sale.totalSalePhp);
  const balance = round(Math.max(total - paid, 0));
  if (status === "pending" && paid > 0) return "Pending cannot have a paid amount. Use Partial or Paid.";
  if (status === "partial" && paid <= 0) return "Partial needs a paid amount.";
  if (status === "partial" && paid + 0.009 >= total) return "Partial already covers full total. Use Paid.";
  if (status === "partial" && method === "cash") return "Partial payment cannot use plain Cash. Use Installment or Mixed Payment.";
  if (status === "paid" && paid + 0.009 < total) return `Paid is short by ${money(balance)}. Use Partial or collect the full amount.`;
  return "";
}

export default function ConfirmSalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState("");
  const [paymentEdits, setPaymentEdits] = useState<Record<string, PaymentEdit>>({});
  const [expandedPaymentEditKey, setExpandedPaymentEditKey] = useState("");

  async function loadSales() {
    setLoading(true);
    setMessage("");
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        fetch(`/api/sales?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const salesData = await salesRes.json();
      const paymentsData = await paymentsRes.json();
      if (!salesRes.ok) throw new Error(salesData?.error || "Failed to load sales");
      if (!paymentsRes.ok) throw new Error(paymentsData?.error || "Failed to load reconciled payments");
      setRows(Array.isArray(salesData) ? salesData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSales().catch(console.error); }, []);

  const summaries = useMemo(() => summarizeSales(rows, payments), [rows, payments]);
  const reviewSales = summaries.filter((sale) => !isInactive(sale.saleStatus));
  const compactInputClass = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400";

  function getPaymentEdit(sale: SaleSummary) {
    return paymentEdits[sale.key] || buildPaymentEdit(sale);
  }

  function updatePaymentEdit(sale: SaleSummary, patch: Partial<PaymentEdit>) {
    setPaymentEdits((current) => ({ ...current, [sale.key]: { ...getPaymentEdit(sale), ...patch } }));
  }

  async function updateSalePayment(sale: SaleSummary) {
    const edit = getPaymentEdit(sale);
    const rule = validatePaymentEdit(edit, sale);
    if (rule) {
      setMessage(`Payment procedure review: ${rule}`);
      return;
    }
    setWorkingKey(`payment-${sale.key}`);
    setMessage("");
    try {
      const res = await fetch("/api/sales/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-payment", ...targetPayload(sale), paymentStatus: edit.paymentStatus, amountPaidPhp: Number(edit.amountPaidPhp) || 0, paymentMethod: edit.paymentMethod, transactionRef: edit.transactionRef, cashierName: edit.cashierName, actor: edit.cashierName || sale.cashierName || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update payment");
      setMessage(data?.message || "Payment updated successfully.");
      setPaymentEdits((current) => { const next = { ...current }; delete next[sale.key]; return next; });
      setExpandedPaymentEditKey("");
      await loadSales();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update payment.");
    } finally {
      setWorkingKey("");
    }
  }

  async function updateConfirmation(sale: SaleSummary, action: SaleAction) {
    const edit = getPaymentEdit(sale);
    const ref = sale.salesRefNo || sale.groupRef || sale.customerName;
    const prompt = action === "undo"
      ? `Undo confirmation for ${ref}?`
      : action === "void"
        ? `Void sale and payment for ${ref}?\n\nThis cancels the draft, clears paid/balance/tendered amounts, and excludes it from reports and receivables.`
        : `Confirm sale ${ref}?\n\nThis deducts inventory and keeps unpaid balances open.`;
    if (!window.confirm(prompt)) return;
    setWorkingKey(`${action}-${sale.key}`);
    setMessage("");
    try {
      const res = await fetch("/api/sales/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...targetPayload(sale), actor: edit.cashierName || sale.cashierName || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update sale confirmation");
      setMessage(data?.message || "Sale confirmation updated successfully.");
      setPaymentEdits((current) => { const next = { ...current }; delete next[sale.key]; return next; });
      setExpandedPaymentEditKey("");
      await loadSales();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update sale confirmation.");
    } finally {
      setWorkingKey("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Confirm Sales</h1>
            <p className="mt-1 text-xs text-slate-600">Compact review for confirmation, balance, and payment corrections.</p>
          </div>
          <button type="button" onClick={loadSales} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">{loading ? "Loading..." : "Refresh"}</button>
        </div>
        {message ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sales Confirmation Review</h2>
            <p className="text-xs text-slate-500">Payment edit is hidden until needed so the table stays clean.</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">{reviewSales.length} active sale(s)</p>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
              <tr>{["Date", "Sales / Customer", "Item", "Amounts", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}</tr>
            </thead>
            <tbody>
              {reviewSales.map((sale) => {
                const isConfirmed = sale.saleStatus.toLowerCase() === "confirmed";
                const edit = getPaymentEdit(sale);
                const editOpen = expandedPaymentEditKey === sale.key;
                const firstItem = sale.items[0] || "No item detail";
                return (
                  <>
                    <tr key={sale.key} className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{normalizeDate(sale.saleDate)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-bold text-slate-900">{sale.salesRefNo || sale.groupRef || sale.saleId}</p>
                        <p className="text-xs text-slate-500">{sale.customerName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="max-w-[380px] truncate">{firstItem}</p>
                        {sale.items.length > 1 ? <p className="text-xs font-semibold text-slate-500">+{sale.items.length - 1} more line(s)</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid min-w-[220px] grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-semibold text-slate-500">Total</p><p className="font-bold text-slate-900">{money(sale.totalSalePhp)}</p></div>
                          <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[10px] font-semibold text-emerald-600">Paid</p><p className="font-bold text-emerald-700">{money(sale.paidPhp)}</p></div>
                          <div className="rounded-xl bg-rose-50 px-3 py-2"><p className="text-[10px] font-semibold text-rose-600">Balance</p><p className="font-bold text-rose-700">{money(sale.balancePhp)}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <StatusPill value={sale.paymentStatus} />
                          <StatusPill value={sale.saleStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setExpandedPaymentEditKey(editOpen ? "" : sale.key)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{editOpen ? "Hide Edit" : "Edit Payment"}</button>
                          {isConfirmed ? (
                            <button type="button" onClick={() => updateConfirmation(sale, "undo")} disabled={workingKey === `undo-${sale.key}`} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{workingKey === `undo-${sale.key}` ? "Undoing..." : "Undo"}</button>
                          ) : (
                            <>
                              <button type="button" onClick={() => updateConfirmation(sale, "confirm")} disabled={workingKey === `confirm-${sale.key}`} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{workingKey === `confirm-${sale.key}` ? "Confirming..." : "Confirm"}</button>
                              <button type="button" onClick={() => updateConfirmation(sale, "void")} disabled={workingKey === `void-${sale.key}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">{workingKey === `void-${sale.key}` ? "Voiding..." : "Void"}</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editOpen ? (
                      <tr key={`${sale.key}-edit`} className="border-t border-emerald-100 bg-emerald-50/40">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Payment Edit</p>
                              <p className="text-xs text-slate-500">Adjust only when the payment status or amount needs correction.</p>
                            </div>
                            <div className="grid flex-1 gap-2 md:grid-cols-[130px_130px_160px_150px_minmax(180px,1fr)_auto]">
                              <select value={edit.paymentStatus} onChange={(event) => updatePaymentEdit(sale, { paymentStatus: event.target.value, amountPaidPhp: event.target.value === "Paid" ? String(sale.totalSalePhp) : event.target.value === "Pending" ? "0" : edit.amountPaidPhp })} className={compactInputClass}>{paymentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                              <input type="number" step="0.01" min="0" value={edit.amountPaidPhp} onChange={(event) => updatePaymentEdit(sale, { amountPaidPhp: event.target.value, paymentStatus: computedPaymentStatus(Number(event.target.value) || 0, sale.totalSalePhp) })} className={compactInputClass} placeholder="Amount" />
                              <select value={edit.paymentMethod} onChange={(event) => updatePaymentEdit(sale, { paymentMethod: event.target.value })} className={compactInputClass}>{paymentMethodOptions.map((method) => <option key={method || "blank"} value={method}>{method || "Method"}</option>)}</select>
                              <input value={edit.cashierName} onChange={(event) => updatePaymentEdit(sale, { cashierName: event.target.value })} className={compactInputClass} placeholder="Cashier" />
                              <input value={edit.transactionRef} onChange={(event) => updatePaymentEdit(sale, { transactionRef: event.target.value })} className={compactInputClass} placeholder="Receipt / transaction ref" />
                              <button type="button" onClick={() => updateSalePayment(sale)} disabled={workingKey === `payment-${sale.key}`} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50">{workingKey === `payment-${sale.key}` ? "Saving..." : "Save"}</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
              {!reviewSales.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active sales to review.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
