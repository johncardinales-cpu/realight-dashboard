"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type PriceRow = {
  rowNumber: number;
  itemId: string;
  description: string;
  specification: string;
  category: string;
  unit: string;
  costPriceUsd: number;
  fxRate: number;
  costPricePhp: number;
  sellingPricePhp: number;
  dealerPricePhp: number;
  minimumPricePhp: number;
  grossMargin: number;
  status: string;
  notes: string;
};

const emptyForm = {
  rowNumber: 0,
  itemId: "",
  description: "",
  specification: "",
  category: "",
  unit: "pc",
  costPriceUsd: 0,
  fxRate: 56,
  sellingPricePhp: 0,
  dealerPricePhp: 0,
  minimumPricePhp: 0,
  status: "Active",
  notes: "",
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(value: number) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}

function calcCostPhp(costPriceUsd: number, fxRate: number) {
  return Math.round((Number(costPriceUsd || 0) * Number(fxRate || 0)) * 100) / 100;
}

function calcMargin(sellingPricePhp: number, costPricePhp: number) {
  return sellingPricePhp ? (sellingPricePhp - costPricePhp) / sellingPricePhp : 0;
}

export default function PricingPage() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading pricing...");
  const [saving, setSaving] = useState(false);

  async function loadRows() {
    setMessage("Loading pricing...");
    try {
      const res = await fetch("/api/pricing-base", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load pricing");
      setRows(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load pricing.");
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const costPricePhp = calcCostPhp(form.costPriceUsd, form.fxRate);
  const grossMargin = calcMargin(form.sellingPricePhp, costPricePhp);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const text = `${row.itemId} ${row.description} ${row.specification} ${row.category} ${row.status}`.toLowerCase();
      return !query || text.includes(query);
    });
  }, [rows, search]);

  function editRow(row: PriceRow) {
    setForm({
      rowNumber: row.rowNumber,
      itemId: row.itemId,
      description: row.description,
      specification: row.specification,
      category: row.category,
      unit: row.unit,
      costPriceUsd: row.costPriceUsd,
      fxRate: row.fxRate,
      sellingPricePhp: row.sellingPricePhp,
      dealerPricePhp: row.dealerPricePhp,
      minimumPricePhp: row.minimumPricePhp,
      status: row.status || "Active",
      notes: row.notes || "",
    });
    setMessage(`Editing ${row.description} / ${row.specification}. Saving will affect new sales only.`);
  }

  function resetForm() {
    setForm(emptyForm);
    setMessage("");
  }

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function savePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/pricing-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save pricing");
      setMessage(`Pricing ${data?.mode || "saved"}. New sales will use the latest active price.`);
      resetForm();
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save pricing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Product Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Pricing Management</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Add or update product cost and selling prices. Price increases should be updated here before creating new sales. Old sales keep their saved price and are not rewritten.
        </p>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <form onSubmit={savePricing} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">{form.rowNumber ? "Update Price" : "Add Price"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use this when supplier cost, exchange rate, or selling price changes.</p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Item ID</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.itemId} onChange={(e) => updateField("itemId", e.target.value)} placeholder="Auto or product code" /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Description</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Example: 5.5KW Hybrid Inverter" required /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Specification</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.specification} onChange={(e) => updateField("specification", e.target.value)} placeholder="Example: BSM-5500BLV-48DA" required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Category</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.category} onChange={(e) => updateField("category", e.target.value)} /></label>
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Unit</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.unit} onChange={(e) => updateField("unit", e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Cost USD</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.costPriceUsd} onChange={(e) => updateField("costPriceUsd", Number(e.target.value))} /></label>
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">FX Rate</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.fxRate} onChange={(e) => updateField("fxRate", Number(e.target.value))} /></label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-500">Calculated Cost PHP</p><p className="mt-1 text-2xl font-bold text-slate-950">{money(costPricePhp)}</p></div>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Selling Price PHP</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.sellingPricePhp} onChange={(e) => updateField("sellingPricePhp", Number(e.target.value))} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Dealer Price</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.dealerPricePhp} onChange={(e) => updateField("dealerPricePhp", Number(e.target.value))} /></label>
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Minimum Price</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.minimumPricePhp} onChange={(e) => updateField("minimumPricePhp", Number(e.target.value))} /></label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-500">Gross Margin Preview</p><p className="mt-1 text-2xl font-bold text-slate-950">{percent(grossMargin)}</p></div>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Status</span><select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.status} onChange={(e) => updateField("status", e.target.value)}><option>Active</option><option>Inactive</option></select></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Notes / Reason</span><textarea className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Example: Supplier price increased effective today." /></label>
            <div className="flex gap-3"><button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : form.rowNumber ? "Update Price" : "Add Price"}</button><button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Clear</button></div>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-bold text-slate-950">Current Pricing</h2><p className="mt-1 text-sm text-slate-600">These prices feed product autocomplete and new sales.</p></div>
            <button type="button" onClick={loadRows} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
          </div>
          <input className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, model, category..." />
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 font-semibold">Item</th><th className="px-4 py-3 font-semibold">Spec</th><th className="px-4 py-3 font-semibold">Cost</th><th className="px-4 py-3 font-semibold">Sell</th><th className="px-4 py-3 font-semibold">Margin</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => <tr key={`${row.rowNumber}-${row.itemId}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-950">{row.description}<p className="mt-1 text-xs font-normal text-slate-500">{row.category}</p></td><td className="px-4 py-3 text-slate-700">{row.specification}</td><td className="px-4 py-3 text-slate-700">{money(row.costPricePhp)}</td><td className="px-4 py-3 font-semibold text-slate-950">{money(row.sellingPricePhp)}</td><td className="px-4 py-3 text-slate-700">{percent(row.grossMargin)}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => editRow(row)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button></td></tr>)}
                {!filteredRows.length ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No pricing records found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-amber-950">Where supplier/product expenses go</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">Use Pricing Management to update product cost and selling price. Use Expenses to record actual company-paid costs such as supplier fees, bank charges, freight, customs, delivery cost paid by the company, or product-related costs. If the cost belongs to a customer sale, link it with Related Sales Ref No.</p>
      </div>
    </section>
  );
}
