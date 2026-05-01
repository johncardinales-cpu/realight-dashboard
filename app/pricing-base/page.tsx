"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  rowNumber?: number;
  itemId?: string;
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

const emptyForm: Item = {
  description: "",
  specification: "",
  category: "",
  unit: "pc",
  costPriceUsd: 0,
  fxRate: 56,
  costPricePhp: 0,
  sellingPricePhp: 0,
  dealerPricePhp: 0,
  minimumPricePhp: 0,
  grossMargin: 0,
  status: "Active",
  notes: "",
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PricingBasePage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [form, setForm] = useState<Item>(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRows() {
    const res = await fetch("/api/pricing-base", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const previewCostPhp = useMemo(() => {
    return (Number(form.costPriceUsd) || 0) * (Number(form.fxRate) || 0);
  }, [form.costPriceUsd, form.fxRate]);

  const previewMargin = useMemo(() => {
    const selling = Number(form.sellingPricePhp) || 0;
    if (!selling) return 0;
    return (selling - previewCostPhp) / selling;
  }, [form.sellingPricePhp, previewCostPhp]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      setMessage("Pricing saved successfully.");
      setForm(emptyForm);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save pricing.");
    } finally {
      setSaving(false);
    }
  }

  function editRow(row: Item) {
    setForm(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Pricing Base</h1>
        <p className="mt-1 text-sm text-slate-600">
          Selling prices are in pesos. Pricing can be manually edited or keyed in any time.
        </p>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Specification" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Cost Price (USD)" type="number" step="0.01" value={form.costPriceUsd} onChange={(e) => setForm({ ...form, costPriceUsd: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="FX Rate" type="number" step="0.01" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Selling Price (PHP)" type="number" step="0.01" value={form.sellingPricePhp} onChange={(e) => setForm({ ...form, sellingPricePhp: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Dealer Price (PHP)" type="number" step="0.01" value={form.dealerPricePhp} onChange={(e) => setForm({ ...form, dealerPricePhp: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Minimum Price (PHP)" type="number" step="0.01" value={form.minimumPricePhp} onChange={(e) => setForm({ ...form, minimumPricePhp: Number(e.target.value) })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>Converted Cost (PHP): <span className="font-semibold">{money(previewCostPhp)}</span></p>
          <p>Gross Margin: <span className="font-semibold">{(previewMargin * 100).toFixed(2)}%</span></p>
        </div>

        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : form.rowNumber ? "Update Price" : "Save Price"}
          </button>
          <button type="button" onClick={() => setForm(emptyForm)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Clear
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Price List</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["Description","Specification","Category","Cost (PHP)","Selling (PHP)","Dealer (PHP)","Minimum (PHP)","Margin","Status","Actions"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.description}-${row.specification}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                  <td className="px-4 py-3 text-slate-700">{row.category}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.costPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.sellingPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.dealerPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.minimumPricePhp)}</td>
                  <td className="px-4 py-3 text-slate-700">{(row.grossMargin * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <button type="button" onClick={() => editRow(row)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">No pricing rows found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
