"use client";

import { useEffect, useMemo, useState } from "react";

type CostRow = Record<string, string>;

type FormState = {
  uploadDate: string;
  supplier: string;
  batchReference: string;
  invoiceNo: string;
  invoiceValid: string;
  productSubtotal: string;
  freightCost: string;
  deliveryCost: string;
  customsCost: string;
  otherCost: string;
  notes: string;
};

const initialForm: FormState = {
  uploadDate: "",
  supplier: "",
  batchReference: "",
  invoiceNo: "",
  invoiceValid: "",
  productSubtotal: "",
  freightCost: "",
  deliveryCost: "",
  customsCost: "",
  otherCost: "",
  notes: "",
};

function toNumber(value: string) {
  return Number(value || 0) || 0;
}

export default function SupplierInvoiceCostsPage() {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRows() {
    const res = await fetch("/api/supplier-invoice-costs", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const totalInvoiceCost = useMemo(() => {
    return (
      toNumber(form.productSubtotal) +
      toNumber(form.freightCost) +
      toNumber(form.deliveryCost) +
      toNumber(form.customsCost) +
      toNumber(form.otherCost)
    );
  }, [form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/supplier-invoice-costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          productSubtotal: toNumber(form.productSubtotal),
          freightCost: toNumber(form.freightCost),
          deliveryCost: toNumber(form.deliveryCost),
          customsCost: toNumber(form.customsCost),
          otherCost: toNumber(form.otherCost),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save supplier invoice cost");

      setMessage("Supplier invoice cost saved successfully.");
      setForm(initialForm);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save supplier invoice cost.");
    } finally {
      setSaving(false);
    }
  }

  const headers = [
    "Upload Date",
    "Supplier",
    "Batch / Reference",
    "Invoice No.",
    "Invoice Valid",
    "Product Subtotal",
    "Freight Cost",
    "Delivery Cost",
    "Customs Cost",
    "Other Cost",
    "Total Invoice Cost",
    "Notes",
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Supplier Invoice Costs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track total landed cost per supplier invoice or batch reference.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Upload Date" type="date" value={form.uploadDate} onChange={(e) => setForm({ ...form, uploadDate: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Batch / Reference" value={form.batchReference} onChange={(e) => setForm({ ...form, batchReference: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Invoice No." value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Invoice Valid" type="date" value={form.invoiceValid} onChange={(e) => setForm({ ...form, invoiceValid: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Product Subtotal" type="number" step="0.01" value={form.productSubtotal} onChange={(e) => setForm({ ...form, productSubtotal: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Freight Cost" type="number" step="0.01" value={form.freightCost} onChange={(e) => setForm({ ...form, freightCost: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Delivery Cost" type="number" step="0.01" value={form.deliveryCost} onChange={(e) => setForm({ ...form, deliveryCost: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Customs Cost" type="number" step="0.01" value={form.customsCost} onChange={(e) => setForm({ ...form, customsCost: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Other Cost" type="number" step="0.01" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} />
          <input className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="text-sm text-slate-700">
            Total Invoice Cost: <span className="font-semibold">{totalInvoiceCost.toFixed(2)}</span>
          </div>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save Invoice Cost"}
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Saved Supplier Invoice Costs</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {headers.map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row["_rowNumber"] || idx} className="border-t border-slate-100">
                  {headers.map((head) => (
                    <td key={head} className="px-4 py-3 text-slate-700">{row[head]}</td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-500">
                    No supplier invoice costs saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
