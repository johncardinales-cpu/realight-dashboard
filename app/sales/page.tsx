"use client";

import { useEffect, useMemo, useState } from "react";

type PriceRow = {
  description: string;
  specification: string;
  costPricePhp: number;
  sellingPricePhp: number;
};

type SaleLine = {
  description: string;
  specification: string;
  qty: number;
  unitPricePhp: number;
};

type SavedSale = {
  saleDate: string;
  salesRefNo: string;
  customerName: string;
  description: string;
  specification: string;
  qty: number;
  unitPricePhp: number;
  totalSalePhp: number;
  costPricePhp: number;
  totalCostPhp: number;
  grossProfitPhp: number;
  paymentStatus: string;
  salesperson: string;
  notes: string;
  groupRef: string;
  paymentMethod: string;
  amountPaidPhp: number;
  balancePhp: number;
  transactionRef: string;
  cashierName: string;
  saleStatus: string;
  confirmedAt: string;
  productSubtotalPhp?: number;
  taxRatePct?: number;
  taxAmountPhp?: number;
  grandTotalPhp?: number;
};

type InventoryRow = Record<string, string | number>;

type AlertState = {
  type: "success" | "warning" | "error";
  title: string;
  message: string;
  detail?: string;
};

const emptyLine: SaleLine = {
  description: "",
  specification: "",
  qty: 1,
  unitPricePhp: 0,
};

const paymentStatusOptions = ["Pending", "Paid", "Partial"];
const paymentMethodOptions = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];
const saleStatusOptions = ["Draft", "Confirmed", "Cancelled"];

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function itemKey(description: string, specification: string) {
  return `${description.trim()}|||${specification.trim()}`;
}

function formatApiError(message: string): AlertState {
  const stockPrefix = "Insufficient confirmed stock.";

  if (message.startsWith(stockPrefix)) {
    const detail = message.replace(stockPrefix, "").trim();
    return {
      type: "warning",
      title: "Sale cannot be confirmed",
      message: "The requested quantity is higher than the stock currently available for confirmed sales.",
      detail: detail || message,
    };
  }

  return {
    type: "error",
    title: "Sale was not saved",
    message,
  };
}

function AlertBanner({ alert, onDismiss }: { alert: AlertState; onDismiss: () => void }) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-rose-200 bg-rose-50 text-rose-950",
  }[alert.type];

  const iconStyles = {
    success: "bg-emerald-600 text-white",
    warning: "bg-amber-500 text-white",
    error: "bg-rose-600 text-white",
  }[alert.type];

  return (
    <div className={`mt-4 rounded-2xl border p-4 shadow-sm ${styles}`} role="alert">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconStyles}`}>
          {alert.type === "success" ? "✓" : "!"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{alert.title}</p>
          <p className="mt-1 text-sm leading-6">{alert.message}</p>
          {alert.detail ? <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold leading-6">{alert.detail}</p> : null}
        </div>
        <button type="button" onClick={onDismiss} className="rounded-full px-2 py-1 text-xs font-bold opacity-70 hover:bg-white/60 hover:opacity-100">
          Close
        </button>
      </div>
    </div>
  );
}

function WarningModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
  if (alert.type !== "warning" && alert.type !== "error") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-600">!</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">{alert.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{alert.message}</p>
            {alert.detail ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
                {alert.detail}
              </div>
            ) : null}
            <p className="mt-4 text-sm leading-6 text-slate-500">
              To proceed, lower the quantity, select Draft instead of Confirmed, or replenish inventory first.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm">
            Review Sale
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ value, kind }: { value: string; kind: "sale" | "payment" }) {
  const normalized = value.toLowerCase();
  const color = normalized === "confirmed" || normalized === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : normalized === "partial"
      ? "bg-amber-50 text-amber-700"
      : normalized === "cancelled"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value || (kind === "sale" ? "Draft" : "Pending")}</span>;
}

export default function SalesPage() {
  const [pricing, setPricing] = useState<PriceRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [rows, setRows] = useState<SavedSale[]>([]);
  const [saleDate, setSaleDate] = useState("");
  const [salesRefNo, setSalesRefNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amountPaidPhp, setAmountPaidPhp] = useState(0);
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [transactionRef, setTransactionRef] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [saleStatus, setSaleStatus] = useState("Draft");
  const [salesperson, setSalesperson] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SaleLine[]>([{ ...emptyLine }]);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [salesRes, pricingRes, inventoryRes] = await Promise.all([
      fetch("/api/sales", { cache: "no-store" }),
      fetch("/api/pricing-base", { cache: "no-store" }),
      fetch("/api/inventory", { cache: "no-store" }),
    ]);
    const salesData = await salesRes.json();
    const pricingData = await pricingRes.json();
    const inventoryData = await inventoryRes.json();
    setRows(Array.isArray(salesData) ? salesData : []);
    setPricing(Array.isArray(pricingData) ? pricingData : []);
    setInventory(Array.isArray(inventoryData) ? inventoryData : []);
  }

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  const stockByKey = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((row) => {
      const description = String(row["Description"] || "").trim();
      const specification = String(row["Specification"] || "").trim();
      if (!description && !specification) return;
      map.set(itemKey(description, specification), Number(row["Sellable Qty"] || 0) || 0);
    });
    return map;
  }, [inventory]);

  function stockForLine(item: SaleLine) {
    if (!item.description || !item.specification) return null;
    return stockByKey.get(itemKey(item.description, item.specification)) ?? null;
  }

  function validateClientStock(cleanItems: SaleLine[]) {
    if (saleStatus.toLowerCase() !== "confirmed") return "";

    const requested = new Map<string, { description: string; specification: string; qty: number }>();
    cleanItems.forEach((item) => {
      const key = itemKey(item.description, item.specification);
      const current = requested.get(key);
      requested.set(key, {
        description: item.description,
        specification: item.specification,
        qty: (current?.qty || 0) + (Number(item.qty) || 0),
      });
    });

    const issues: string[] = [];
    requested.forEach(({ description, specification, qty }, key) => {
      const available = stockByKey.get(key);
      if (available !== undefined && qty > available) {
        issues.push(`${description} / ${specification}: requested ${qty}, available ${available}`);
      }
    });

    return issues.join("; ");
  }

  function updateItem(index: number, patch: Partial<SaleLine>) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function addLine() {
    setItems((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }

  function autofillPrice(index: number, description: string, specification: string) {
    const match = pricing.find(
      (row) => row.description === description && row.specification === specification
    );
    updateItem(index, {
      description,
      specification,
      unitPricePhp: match?.sellingPricePhp || 0,
    });
  }

  const totals = useMemo(() => {
    const base = items.reduce(
      (acc, item) => {
        const matched = pricing.find(
          (row) =>
            row.description === item.description &&
            row.specification === item.specification
        );
        const qty = Number(item.qty) || 0;
        const unit = Number(item.unitPricePhp) || 0;
        const cost = Number(matched?.costPricePhp) || 0;
        acc.subtotal += qty * unit;
        acc.cost += qty * cost;
        return acc;
      },
      { subtotal: 0, cost: 0 }
    );
    const tax = roundMoney(base.subtotal * ((Number(taxRatePct) || 0) / 100));
    const grandTotal = roundMoney(base.subtotal + tax);
    return {
      subtotal: roundMoney(base.subtotal),
      tax,
      grandTotal,
      cost: roundMoney(base.cost),
      profit: roundMoney(grandTotal - base.cost),
    };
  }, [items, pricing, taxRatePct]);

  const balancePhp = Math.max(totals.grandTotal - (Number(amountPaidPhp) || 0), 0);

  function resetForm() {
    setSaleDate("");
    setSalesRefNo("");
    setCustomerName("");
    setPaymentStatus("Pending");
    setPaymentMethod("");
    setAmountPaidPhp(0);
    setTaxRatePct(0);
    setTransactionRef("");
    setCashierName("");
    setSaleStatus("Draft");
    setSalesperson("");
    setNotes("");
    setItems([{ ...emptyLine }]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    try {
      const cleanItems = items.filter(
        (item) => item.description && item.specification && Number(item.qty) > 0
      );

      if (!cleanItems.length) {
        setAlert({
          type: "warning",
          title: "No valid product line",
          message: "Add at least one product with description, specification, and quantity before saving.",
        });
        return;
      }

      const clientStockIssue = validateClientStock(cleanItems);
      if (clientStockIssue) {
        setAlert({
          type: "warning",
          title: "Sale cannot be confirmed",
          message: "The requested quantity is higher than the stock currently available for confirmed sales.",
          detail: clientStockIssue,
        });
        return;
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleDate,
          salesRefNo,
          customerName,
          paymentStatus,
          paymentMethod,
          amountPaidPhp,
          taxRatePct,
          taxAmountPhp: totals.tax,
          transactionRef,
          cashierName,
          saleStatus,
          salesperson,
          notes,
          items: cleanItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save sale");

      setAlert({
        type: "success",
        title: "Sale saved successfully",
        message: `The sale was recorded with ${data?.lines || 0} line(s). Grand total: ${money(data?.grandTotalPhp || totals.grandTotal)}.`,
      });
      resetForm();
      await loadAll();
    } catch (error: any) {
      setAlert(formatApiError(error?.message || "Failed to save sale."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      {alert ? <WarningModal alert={alert} onClose={() => setAlert(null)} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add products, calculate cashiering tax, record payment, and save the sale. Inventory deducts only after confirmation.
        </p>
        {alert ? <AlertBanner alert={alert} onDismiss={() => setAlert(null)} /> : null}
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Sales Ref No." value={salesRefNo} onChange={(e) => setSalesRefNo(e.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <select className="rounded-xl border border-slate-300 px-3 py-2" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {paymentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Cashiering</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {paymentMethodOptions.map((method) => <option key={method || "blank"} value={method}>{method || "Payment Method"}</option>)}
            </select>
            <input className="rounded-xl border border-slate-300 bg-white px-3 py-2" type="number" step="0.01" min="0" placeholder="Tax Rate (%)" value={taxRatePct} onChange={(e) => setTaxRatePct(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" value={`Tax: ${money(totals.tax)}`} readOnly />
            <input className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" value={`Subtotal: ${money(totals.subtotal)}`} readOnly />
            <input className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold" value={`Grand Total: ${money(totals.grandTotal)}`} readOnly />
            <input className="rounded-xl border border-slate-300 bg-white px-3 py-2" type="number" step="0.01" placeholder="Amount Paid (PHP)" value={amountPaidPhp} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" value={`Balance: ${money(balancePhp)}`} readOnly />
            <input className="rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="Transaction / Receipt Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
            <input className="rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="Cashier Name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
            <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)}>
              {saleStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Tax is added to the sale during cashiering. Payments and balance are calculated from Grand Total. Inventory deducts only when a sale is Confirmed.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const availableStock = stockForLine(item);
            return (
              <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-5">
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Specification" value={item.specification} onChange={(e) => updateItem(index, { specification: e.target.value })} onBlur={() => autofillPrice(index, item.description, item.specification)} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(index, { qty: Number(e.target.value) })} />
                <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Unit Price (PHP)" value={item.unitPricePhp} onChange={(e) => updateItem(index, { unitPricePhp: Number(e.target.value) })} />
                <div className="flex items-center gap-2">
                  <div className="text-sm text-slate-700">
                    <p>Line Subtotal: <span className="font-semibold">{money((Number(item.qty) || 0) * (Number(item.unitPricePhp) || 0))}</span></p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{availableStock === null ? "Stock: select valid item" : `Available: ${availableStock}`}</p>
                  </div>
                  <button type="button" onClick={() => removeLine(index)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">Remove</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={addLine} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Add Product Line</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving..." : "Save Sale"}</button>
        </div>

        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-5">
          <p>Product Subtotal: <span className="font-semibold">{money(totals.subtotal)}</span></p>
          <p>Tax: <span className="font-semibold">{money(totals.tax)}</span></p>
          <p>Grand Total: <span className="font-semibold">{money(totals.grandTotal)}</span></p>
          <p>Amount Paid: <span className="font-semibold">{money(amountPaidPhp)}</span></p>
          <p>Balance: <span className="font-semibold">{money(balancePhp)}</span></p>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Sales Ledger</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {[
                  "Date","Sales Ref","Customer","Description","Specification","Qty","Unit Price","Subtotal","Tax","Grand Total",
                  "Cost Price","Gross Profit","Payment Status","Method","Paid","Balance","Sale Status"
                ].map((head) => <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.groupRef}-${index}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{row.saleDate}</td>
                  <td className="px-4 py-3 text-slate-700">{row.salesRefNo}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customerName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                  <td className="px-4 py-3 text-slate-700">{row.qty}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.unitPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.productSubtotalPhp ?? row.totalSalePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.taxAmountPhp ?? 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.grandTotalPhp ?? row.totalSalePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.costPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.grossProfitPhp)}</td>
                  <td className="px-4 py-3 text-slate-700"><StatusPill value={row.paymentStatus} kind="payment" /></td>
                  <td className="px-4 py-3 text-slate-700">{row.paymentMethod}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.amountPaidPhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.balancePhp)}</td>
                  <td className="px-4 py-3 text-slate-700"><StatusPill value={row.saleStatus} kind="sale" /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={17} className="px-4 py-8 text-center text-slate-500">No sales recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
