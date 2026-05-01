"use client";

import { useEffect, useMemo, useState } from "react";

type Sale = {
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
};

type PriceRow = {
  description: string;
  specification: string;
  category: string;
  sellingPricePhp: number;
  dealerPricePhp: number;
  minimumPricePhp: number;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm: Sale = {
  saleDate: "",
  salesRefNo: "",
  customerName: "",
  description: "",
  specification: "",
  qty: 1,
  unitPricePhp: 0,
  totalSalePhp: 0,
  costPricePhp: 0,
  totalCostPhp: 0,
  grossProfitPhp: 0,
  paymentStatus: "Pending",
  salesperson: "",
  notes: "",
};

export default function SalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [pricing, setPricing] = useState<PriceRow[]>([]);
  const [form, setForm] = useState<Sale>(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [salesRes, pricingRes] = await Promise.all([
      fetch("/api/sales", { cache: "no-store" }),
      fetch("/api/pricing-base", { cache: "no-store" }),
    ]);
    const salesData = await salesRes.json();
    const pricingData = await pricingRes.json();
    setRows(Array.isArray(salesData) ? salesData : []);
    setPricing(Array.isArray(pricingData) ? pricingData : []);
  }

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  const matchingPricing = useMemo(() => {
    return pricing.find(
      (row) => row.description === form.description && row.specification === form.specification
    );
  }, [pricing, form.description, form.specification]);

  useEffect(() => {
    if (matchingPricing && !form.unitPricePhp) {
      setForm((prev) => ({
        ...prev,
        unitPricePhp: Number(matchingPricing.sellingPricePhp) || 0,
      }));
    }
  }, [matchingPricing]);

  const totalPreview = (Number(form.qty) || 0) * (Number(form.unitPricePhp) || 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save sale");
      setMessage("Sale saved successfully.");
      setForm(emptyForm);
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record sales in pesos. Pricing can still be manually adjusted per deal when needed.
        </p>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Sales Ref No." value={form.salesRefNo} onChange={(e) => setForm({ ...form, salesRefNo: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Customer Name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Specification" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" type="number" step="0.01" placeholder="Manual Unit Price (PHP)" value={form.unitPricePhp} onChange={(e) => setForm({ ...form, unitPricePhp: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Payment Status" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Salesperson" value={form.salesperson} onChange={(e) => setForm({ ...form, salesperson: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>Sale Total Preview: <span className="font-semibold">{money(totalPreview)}</span></p>
          <p>Selected Pricing Row: <span className="font-semibold">{matchingPricing ? "Matched" : "Manual / No Match"}</span></p>
        </div>

        <div className="mt-4">
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save Sale"}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Sales Ledger</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["Date","Customer","Description","Specification","Qty","Unit Price","Total Sale","Cost Price","Total Cost","Gross Profit","Payment Status"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.salesRefNo}-${index}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{row.saleDate}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customerName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                  <td className="px-4 py-3 text-slate-700">{row.qty}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.unitPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.totalSalePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.costPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.totalCostPhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.grossProfitPhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.paymentStatus}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
