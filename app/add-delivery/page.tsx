"use client";

import { useState } from "react";
import Link from "next/link";

const initialState = {
  uploadDate: "",
  arrivalDate: "",
  supplier: "",
  batchReference: "",
  description: "",
  specification: "",
  qtyAdded: "",
  unitPriceUsd: "",
  invoiceValid: "",
  status: "Incoming",
  notes: "",
};

export default function AddDeliveryPage() {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(key: keyof typeof initialState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/add-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to add delivery");
      }

      setMessage("Delivery saved successfully.");
      setForm(initialState);
    } catch (error: any) {
      setMessage(error?.message || "Failed to add delivery.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Add Delivery</h1>
            <p className="mt-1 text-sm text-slate-600">
              Save new incoming stock into the App_Deliveries sheet.
            </p>
          </div>
          <Link
            href="/upload-deliveries"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Upload CSV
          </Link>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Upload Date" type="date" value={form.uploadDate} onChange={(v) => updateField("uploadDate", v)} required />
          <Field label="Arrival Date" type="date" value={form.arrivalDate} onChange={(v) => updateField("arrivalDate", v)} />
          <Field label="Supplier" value={form.supplier} onChange={(v) => updateField("supplier", v)} required />
          <Field label="Batch / Reference" value={form.batchReference} onChange={(v) => updateField("batchReference", v)} />
          <Field label="Description" value={form.description} onChange={(v) => updateField("description", v)} required />
          <Field label="Specification" value={form.specification} onChange={(v) => updateField("specification", v)} required />
          <Field label="Qty Added" type="number" value={form.qtyAdded} onChange={(v) => updateField("qtyAdded", v)} required />
          <Field label="Unit Price (USD)" type="number" value={form.unitPriceUsd} onChange={(v) => updateField("unitPriceUsd", v)} />
          <Field label="Invoice Valid" placeholder="YYYY/MM/DD" value={form.invoiceValid} onChange={(v) => updateField("invoiceValid", v)} />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              <option value="Incoming">Incoming</option>
              <option value="In Transit">In Transit</option>
              <option value="Received">Received</option>
              <option value="Available">Available</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            placeholder="Optional remarks"
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Delivery"}
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
      />
    </div>
  );
}
