"use client";

import { useEffect, useMemo, useState } from "react";

type PriceRow = { description: string; specification: string; costPricePhp: number; sellingPricePhp: number };
type SaleLine = { productSearch?: string; description: string; specification: string; qty: number; unitPricePhp: number };
type SavedSale = {
  saleDate: string; salesRefNo: string; customerName: string; description: string; specification: string; qty: number; unitPricePhp: number;
  totalSalePhp: number; costPricePhp: number; totalCostPhp: number; grossProfitPhp: number; paymentStatus: string; salesperson: string; notes: string;
  groupRef: string; paymentMethod: string; amountPaidPhp: number; balancePhp: number; transactionRef: string; cashierName: string; saleStatus: string; confirmedAt: string;
  productSubtotalPhp?: number; taxRatePct?: number; taxAmountPhp?: number; grandTotalPhp?: number; deliveryFeePhp?: number; installationFeePhp?: number; otherChargePhp?: number; discountPhp?: number;
};
type InventoryRow = Record<string, string | number>;
type AlertState = { type: "success" | "warning" | "error"; title: string; message: string; detail?: string };

const emptyLine: SaleLine = { productSearch: "", description: "", specification: "", qty: 1, unitPricePhp: 0 };
const paymentStatusOptions = ["Pending", "Paid", "Partial"];
const paymentMethodOptions = ["", "Cash", "Bank Transfer", "GCash", "Maya", "Check", "Credit", "Installment", "Mixed Payment"];
const saleStatusOptions = ["Draft", "Confirmed", "Cancelled"];

function money(value: number) { return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function roundMoney(value: number) { return Math.round((Number(value) || 0) * 100) / 100; }
function itemKey(description: string, specification: string) { return `${description.trim()}|||${specification.trim()}`; }
function productLabel(row: PriceRow) { return `${row.description} | ${row.specification}`; }

function formatApiError(message: string): AlertState {
  const stockPrefix = "Insufficient confirmed stock.";
  if (message.startsWith(stockPrefix)) {
    const detail = message.replace(stockPrefix, "").trim();
    return { type: "warning", title: "Sale cannot be confirmed", message: "The requested quantity is higher than the stock currently available for confirmed sales.", detail: detail || message };
  }
  return { type: "error", title: "Sale was not saved", message };
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
      {helper ? <span className="block text-[11px] leading-4 text-slate-500">{helper}</span> : null}
    </label>
  );
}

function AlertBanner({ alert, onDismiss }: { alert: AlertState; onDismiss: () => void }) {
  const styles = { success: "border-emerald-200 bg-emerald-50 text-emerald-900", warning: "border-amber-200 bg-amber-50 text-amber-950", error: "border-rose-200 bg-rose-50 text-rose-950" }[alert.type];
  const iconStyles = { success: "bg-emerald-600 text-white", warning: "bg-amber-500 text-white", error: "bg-rose-600 text-white" }[alert.type];
  return <div className={`mt-4 rounded-2xl border p-4 shadow-sm ${styles}`} role="alert"><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconStyles}`}>{alert.type === "success" ? "✓" : "!"}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{alert.title}</p><p className="mt-1 text-sm leading-6">{alert.message}</p>{alert.detail ? <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold leading-6">{alert.detail}</p> : null}</div><button type="button" onClick={onDismiss} className="rounded-full px-2 py-1 text-xs font-bold opacity-70 hover:bg-white/60 hover:opacity-100">Close</button></div></div>;
}

function WarningModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
  if (alert.type !== "warning" && alert.type !== "error") return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-600">!</div><div className="min-w-0 flex-1"><h2 className="text-2xl font-bold tracking-tight text-slate-950">{alert.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{alert.message}</p>{alert.detail ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">{alert.detail}</div> : null}<p className="mt-4 text-sm leading-6 text-slate-500">To proceed, lower the quantity, select Draft instead of Confirmed, or replenish inventory first.</p></div></div><div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm">Review Sale</button></div></div></div>;
}

function StatusPill({ value, kind }: { value: string; kind: "sale" | "payment" }) {
  const normalized = value.toLowerCase();
  const color = normalized === "confirmed" || normalized === "paid" ? "bg-emerald-50 text-emerald-700" : normalized === "partial" ? "bg-amber-50 text-amber-700" : normalized === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700";
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
  const [deliveryFeePhp, setDeliveryFeePhp] = useState(0);
  const [installationFeePhp, setInstallationFeePhp] = useState(0);
  const [otherChargePhp, setOtherChargePhp] = useState(0);
  const [discountPhp, setDiscountPhp] = useState(0);
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
    const [salesRes, pricingRes, inventoryRes] = await Promise.all([fetch("/api/sales", { cache: "no-store" }), fetch("/api/pricing-base", { cache: "no-store" }), fetch("/api/inventory", { cache: "no-store" })]);
    const salesData = await salesRes.json();
    const pricingData = await pricingRes.json();
    const inventoryData = await inventoryRes.json();
    setRows(Array.isArray(salesData) ? salesData : []);
    setPricing(Array.isArray(pricingData) ? pricingData : []);
    setInventory(Array.isArray(inventoryData) ? inventoryData : []);
  }

  useEffect(() => { loadAll().catch(console.error); }, []);

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

  const productOptions = useMemo(() => pricing.map(productLabel), [pricing]);

  function findProduct(value: string) {
    const query = value.trim().toLowerCase();
    if (!query) return null;
    return pricing.find((row) => productLabel(row).toLowerCase() === query) || pricing.find((row) => productLabel(row).toLowerCase().includes(query)) || null;
  }

  function selectProduct(index: number, value: string) {
    const match = findProduct(value);
    if (!match) {
      updateItem(index, { productSearch: value });
      return;
    }
    updateItem(index, { productSearch: productLabel(match), description: match.description, specification: match.specification, unitPricePhp: match.sellingPricePhp || 0 });
  }

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
      requested.set(key, { description: item.description, specification: item.specification, qty: (current?.qty || 0) + (Number(item.qty) || 0) });
    });
    const issues: string[] = [];
    requested.forEach(({ description, specification, qty }, key) => {
      const available = stockByKey.get(key);
      if (available !== undefined && qty > available) issues.push(`${description} / ${specification}: requested ${qty}, available ${available}`);
    });
    return issues.join("; ");
  }

  function updateItem(index: number, patch: Partial<SaleLine>) { setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function addLine() { setItems((prev) => [...prev, { ...emptyLine }]); }
  function removeLine(index: number) { setItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index)); }

  const totals = useMemo(() => {
    const base = items.reduce((acc, item) => {
      const matched = pricing.find((row) => row.description === item.description && row.specification === item.specification);
      const qty = Number(item.qty) || 0;
      const unit = Number(item.unitPricePhp) || 0;
      const cost = Number(matched?.costPricePhp) || 0;
      acc.subtotal += qty * unit;
      acc.cost += qty * cost;
      return acc;
    }, { subtotal: 0, cost: 0 });
    const charges = roundMoney((Number(deliveryFeePhp) || 0) + (Number(installationFeePhp) || 0) + (Number(otherChargePhp) || 0));
    const taxableBase = roundMoney(Math.max(base.subtotal + charges - (Number(discountPhp) || 0), 0));
    const tax = roundMoney(taxableBase * ((Number(taxRatePct) || 0) / 100));
    const grandTotal = roundMoney(taxableBase + tax);
    return { subtotal: roundMoney(base.subtotal), charges, taxableBase, tax, grandTotal, cost: roundMoney(base.cost), profit: roundMoney(grandTotal - base.cost) };
  }, [items, pricing, taxRatePct, deliveryFeePhp, installationFeePhp, otherChargePhp, discountPhp]);

  const balancePhp = Math.max(totals.grandTotal - (Number(amountPaidPhp) || 0), 0);

  function resetForm() {
    setSaleDate(""); setSalesRefNo(""); setCustomerName(""); setPaymentStatus("Pending"); setPaymentMethod(""); setAmountPaidPhp(0); setDeliveryFeePhp(0); setInstallationFeePhp(0); setOtherChargePhp(0); setDiscountPhp(0); setTaxRatePct(0); setTransactionRef(""); setCashierName(""); setSaleStatus("Draft"); setSalesperson(""); setNotes(""); setItems([{ ...emptyLine }]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const cleanItems = items.filter((item) => item.description && item.specification && Number(item.qty) > 0);
      if (!cleanItems.length) { setAlert({ type: "warning", title: "No valid product line", message: "Add at least one product with description, specification, and quantity before saving." }); return; }
      const clientStockIssue = validateClientStock(cleanItems);
      if (clientStockIssue) { setAlert({ type: "warning", title: "Sale cannot be confirmed", message: "The requested quantity is higher than the stock currently available for confirmed sales.", detail: clientStockIssue }); return; }
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleDate, salesRefNo, customerName, paymentStatus, paymentMethod, amountPaidPhp, deliveryFeePhp, installationFeePhp, otherChargePhp, discountPhp, taxRatePct, taxAmountPhp: totals.tax, transactionRef, cashierName, saleStatus, salesperson, notes, items: cleanItems }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save sale");
      setAlert({ type: "success", title: "Sale saved successfully", message: `The sale was recorded with ${data?.lines || 0} line(s). Grand total: ${money(data?.grandTotalPhp || totals.grandTotal)}.` });
      resetForm();
      await loadAll();
    } catch (error: any) {
      setAlert(formatApiError(error?.message || "Failed to save sale."));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50";
  const readOnlyClass = "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

  return (
    <section className="space-y-6">
      {alert ? <WarningModal alert={alert} onClose={() => setAlert(null)} /> : null}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-1 text-sm text-slate-600">Create customer sales, add delivery/installation charges, calculate tax, record payment, and save. Inventory deducts only after confirmation.</p>
        {alert ? <AlertBanner alert={alert} onDismiss={() => setAlert(null)} /> : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Sale Information</h2>
          <p className="mb-4 text-xs text-slate-500">Use this section to identify the customer and sales reference. This reference can later connect related expenses.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Sale Date" helper="Date the customer order is created."><input className={inputClass} type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></Field>
            <Field label="Sales Ref No." helper="Unique sale reference, used for payments and linked expenses."><input className={inputClass} placeholder="Example: SALE-001" value={salesRefNo} onChange={(e) => setSalesRefNo(e.target.value)} /></Field>
            <Field label="Customer Name" helper="Customer or company name."><input className={inputClass} placeholder="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
            <Field label="Payment Status" helper="Pending, Partial, or Paid."><select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>{paymentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
            <Field label="Salesperson" helper="Person who handled the sale."><input className={inputClass} placeholder="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} /></Field>
            <Field label="Notes" helper="Optional internal remarks."><input className={inputClass} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Product Lines</h2>
          <p className="mb-4 text-xs text-slate-500">Start typing a product name/model in Product Search. Select a matching item to auto-fill Description, Specification, and Unit Price from Pricing Base.</p>
          <datalist id="product-options">{productOptions.map((option) => <option key={option} value={option} />)}</datalist>
          <div className="space-y-3">
            {items.map((item, index) => {
              const availableStock = stockForLine(item);
              return (
                <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-6">
                  <Field label="Product Search" helper="Type letters to search product."><input list="product-options" className={inputClass} placeholder="Start typing product..." value={item.productSearch || ""} onChange={(e) => selectProduct(index, e.target.value)} onBlur={(e) => selectProduct(index, e.target.value)} /></Field>
                  <Field label="Description" helper="Auto-filled product description."><input className={inputClass} placeholder="Description" value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} /></Field>
                  <Field label="Specification" helper="Auto-filled model/specification."><input className={inputClass} placeholder="Specification" value={item.specification} onChange={(e) => updateItem(index, { specification: e.target.value })} /></Field>
                  <Field label="Qty" helper="Quantity to sell."><input className={inputClass} type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(index, { qty: Number(e.target.value) })} /></Field>
                  <Field label="Unit Price" helper="Auto-filled but editable."><input className={inputClass} type="number" step="0.01" placeholder="Unit Price" value={item.unitPricePhp} onChange={(e) => updateItem(index, { unitPricePhp: Number(e.target.value) })} /></Field>
                  <div className="flex items-end gap-2"><div className="pb-1 text-sm text-slate-700"><p>Line: <span className="font-semibold">{money((Number(item.qty) || 0) * (Number(item.unitPricePhp) || 0))}</span></p><p className="mt-1 text-xs font-semibold text-slate-500">{availableStock === null ? "Stock: select valid item" : `Available: ${availableStock}`}</p></div><button type="button" onClick={() => removeLine(index)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Remove</button></div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addLine} className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Add Product Line</button>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Cashiering and Charges</h2>
          <p className="mb-4 text-xs text-slate-600">Customer-billed delivery and installation belong here. Company-paid delivery or installer cost belongs in Expenses and can be linked to this Sales Ref No.</p>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Payment Method" helper="How customer pays."><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{paymentMethodOptions.map((method) => <option key={method || "blank"} value={method}>{method || "Payment Method"}</option>)}</select></Field>
            <Field label="Delivery Fee" helper="Charge billed to customer for delivery."><input className={inputClass} type="number" step="0.01" min="0" value={deliveryFeePhp} onChange={(e) => setDeliveryFeePhp(Number(e.target.value))} /></Field>
            <Field label="Installation Fee" helper="Charge billed to customer for installation."><input className={inputClass} type="number" step="0.01" min="0" value={installationFeePhp} onChange={(e) => setInstallationFeePhp(Number(e.target.value))} /></Field>
            <Field label="Other Charge" helper="Other customer-billed add-on."><input className={inputClass} type="number" step="0.01" min="0" value={otherChargePhp} onChange={(e) => setOtherChargePhp(Number(e.target.value))} /></Field>
            <Field label="Discount" helper="Discount reduces customer bill."><input className={inputClass} type="number" step="0.01" min="0" value={discountPhp} onChange={(e) => setDiscountPhp(Number(e.target.value))} /></Field>
            <Field label="Tax Rate (%)" helper="Tax applied after charges and discount."><input className={inputClass} type="number" step="0.01" min="0" value={taxRatePct} onChange={(e) => setTaxRatePct(Number(e.target.value))} /></Field>
            <Field label="Amount Paid" helper="Payment collected now."><input className={inputClass} type="number" step="0.01" min="0" value={amountPaidPhp} onChange={(e) => setAmountPaidPhp(Number(e.target.value))} /></Field>
            <Field label="Sale Status" helper="Confirmed deducts inventory."><select className={inputClass} value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)}>{saleStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
            <Field label="Transaction Ref" helper="Receipt, bank, or wallet ref."><input className={inputClass} placeholder="Transaction / Receipt Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} /></Field>
            <Field label="Cashier Name" helper="Staff who received payment."><input className={inputClass} placeholder="Cashier Name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} /></Field>
            <Field label="Tax Amount" helper="Calculated automatically."><input className={readOnlyClass} value={money(totals.tax)} readOnly /></Field>
            <Field label="Balance" helper="Grand total minus paid."><input className={readOnlyClass} value={money(balancePhp)} readOnly /></Field>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-6">
            <p>Product Subtotal: <span className="font-semibold">{money(totals.subtotal)}</span></p>
            <p>Charges: <span className="font-semibold">{money(totals.charges)}</span></p>
            <p>Discount: <span className="font-semibold">{money(discountPhp)}</span></p>
            <p>Taxable Base: <span className="font-semibold">{money(totals.taxableBase)}</span></p>
            <p>Tax: <span className="font-semibold">{money(totals.tax)}</span></p>
            <p>Grand Total: <span className="font-semibold">{money(totals.grandTotal)}</span></p>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Sale"}</button>
          <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Clear</button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Sales Ledger</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr>{["Date","Sales Ref","Customer","Description","Specification","Qty","Unit Price","Subtotal","Delivery","Install","Other","Discount","Tax","Grand Total","Cost Price","Gross Profit","Payment Status","Method","Paid","Balance","Sale Status"].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3 text-left font-medium">{head}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => <tr key={`${row.groupRef}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{row.saleDate}</td><td className="px-4 py-3 text-slate-700">{row.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{row.customerName}</td><td className="px-4 py-3 text-slate-700">{row.description}</td><td className="px-4 py-3 text-slate-700">{row.specification}</td><td className="px-4 py-3 text-slate-700">{row.qty}</td><td className="px-4 py-3 text-slate-700">{money(row.unitPricePhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.productSubtotalPhp ?? row.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.deliveryFeePhp ?? 0)}</td><td className="px-4 py-3 text-slate-700">{money(row.installationFeePhp ?? 0)}</td><td className="px-4 py-3 text-slate-700">{money(row.otherChargePhp ?? 0)}</td><td className="px-4 py-3 text-slate-700">{money(row.discountPhp ?? 0)}</td><td className="px-4 py-3 text-slate-700">{money(row.taxAmountPhp ?? 0)}</td><td className="px-4 py-3 text-slate-700">{money(row.grandTotalPhp ?? row.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.costPricePhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.grossProfitPhp)}</td><td className="px-4 py-3 text-slate-700"><StatusPill value={row.paymentStatus} kind="payment" /></td><td className="px-4 py-3 text-slate-700">{row.paymentMethod}</td><td className="px-4 py-3 text-slate-700">{money(row.amountPaidPhp)}</td><td className="px-4 py-3 text-slate-700">{money(row.balancePhp)}</td><td className="px-4 py-3 text-slate-700"><StatusPill value={row.saleStatus} kind="sale" /></td></tr>)}
              {!rows.length && <tr><td colSpan={21} className="px-4 py-8 text-center text-slate-500">No sales recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
