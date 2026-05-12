"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type DeliveryForm = {
  uploadDate: string;
  arrivalDate: string;
  supplier: string;
  batchReference: string;
  description: string;
  specification: string;
  qtyAdded: string;
  unitPriceUsd: string;
  invoiceValid: string;
  status: string;
  notes: string;
};

type FieldKey = keyof DeliveryForm;

type ApiError = {
  error?: unknown;
};

const today = new Date().toISOString().slice(0, 10);

const initialState: DeliveryForm = {
  uploadDate: today,
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

const supplierSuggestions = [
  "XIAMEN STO ENERGY TECH. CO., LTD.",
  "Bluesun Group Limited",
  "Suntree Electric Group Co., Ltd.",
];

const itemSuggestions = [
  { description: "Rail", specification: "2400 mm" },
  { description: "Mid clamp", specification: "H35/30,L40" },
  { description: "End clamp", specification: "H35/30,L41" },
  { description: "L Feet", specification: "80x40" },
  { description: "PV Combiner Box", specification: "TC20NB-1T1" },
  { description: "DC Breaker", specification: "125A 1000V" },
  { description: "Bluesun 5.5KW Inverter", specification: "BSM-5500BLV-48DA" },
];

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback = "Failed to add delivery.") {
  return error instanceof Error ? error.message : fallback;
}

function Icon({ type }: { type: "truck" | "upload" | "calendar" | "box" | "dollar" | "note" | "check" | "arrow" }) {
  const common = "h-5 w-5";
  if (type === "upload") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></svg>;
  if (type === "calendar") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /></svg>;
  if (type === "box") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></svg>;
  if (type === "dollar") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></svg>;
  if (type === "note") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6V3Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>;
  if (type === "check") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
  if (type === "arrow") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>;
  return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-2" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
}

function Field({ label, value, onChange, type = "text", placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
      />
    </label>
  );
}

function SectionCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: "calendar" | "box" | "dollar" | "note"; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon type={icon} /></div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AddDeliveryPage() {
  const [form, setForm] = useState<DeliveryForm>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  function updateField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseItem(value: string) {
    const item = itemSuggestions.find((entry) => `${entry.description}|||${entry.specification}` === value);
    if (!item) return;
    setForm((prev) => ({ ...prev, description: item.description, specification: item.specification }));
  }

  const totalCost = useMemo(() => {
    const qty = Number(form.qtyAdded) || 0;
    const price = Number(form.unitPriceUsd) || 0;
    return qty * price;
  }, [form.qtyAdded, form.unitPriceUsd]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const res = await fetch("/api/add-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data: unknown = await res.json();
      if (!res.ok) {
        const errorMessage = typeof data === "object" && data !== null && "error" in data ? String((data as ApiError).error) : "Failed to add delivery";
        throw new Error(errorMessage);
      }

      setMessage("Delivery saved successfully.");
      setMessageType("success");
      setForm(initialState);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon type="truck" /></div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950">Add Delivery</h1>
              <p className="mt-2 max-w-3xl text-base text-slate-500">Create a clean delivery record for incoming stock, receiving, or available inventory.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/incoming-deliveries" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"><Icon type="arrow" />Back to deliveries</Link>
            <Link href="/upload-deliveries" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"><Icon type="upload" />Import CSV</Link>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <SectionCard title="Delivery Details" subtitle="Set the supplier, reference, and delivery timeline." icon="calendar">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Upload Date" type="date" value={form.uploadDate} onChange={(value) => updateField("uploadDate", value)} required />
              <Field label="Expected Arrival" type="date" value={form.arrivalDate} onChange={(value) => updateField("arrivalDate", value)} />
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Supplier <span className="text-rose-500">*</span></span>
                <input list="supplier-options" value={form.supplier} required onChange={(event) => updateField("supplier", event.target.value)} placeholder="Type or select supplier" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50" />
                <datalist id="supplier-options">{supplierSuggestions.map((supplier) => <option key={supplier} value={supplier} />)}</datalist>
              </label>
              <Field label="Batch / Reference" value={form.batchReference} onChange={(value) => updateField("batchReference", value)} placeholder="PROFORMA-2025-05-06-STO" />
            </div>
          </SectionCard>

          <SectionCard title="Item Information" subtitle="Choose an existing item or type a new product/specification." icon="box">
            <div className="mb-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Quick item picker</span>
                <select defaultValue="" onChange={(event) => chooseItem(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50">
                  <option value="">Select common solar item</option>
                  {itemSuggestions.map((item) => <option key={`${item.description}-${item.specification}`} value={`${item.description}|||${item.specification}`}>{item.description} · {item.specification}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Description" value={form.description} onChange={(value) => updateField("description", value)} placeholder="Rail, Inverter, Battery..." required />
              <Field label="Specification" value={form.specification} onChange={(value) => updateField("specification", value)} placeholder="2400 mm, H35/30,L40..." required />
              <Field label="Quantity" type="number" value={form.qtyAdded} onChange={(value) => updateField("qtyAdded", value)} required />
              <Field label="Unit Price (USD)" type="number" value={form.unitPriceUsd} onChange={(value) => updateField("unitPriceUsd", value)} />
            </div>
          </SectionCard>

          <SectionCard title="Status & Notes" subtitle="Choose how this stock should appear in operations." icon="note">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Status <span className="text-rose-500">*</span></span>
                <select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50">
                  <option value="Incoming">Incoming</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Received">Received</option>
                  <option value="Available">Available</option>
                </select>
              </label>
              <Field label="Invoice Valid" type="date" value={form.invoiceValid} onChange={(value) => updateField("invoiceValid", value)} />
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Notes</span>
                <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={4} placeholder="Optional remarks" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50" />
              </label>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon type="check" /></span><div><h2 className="text-lg font-bold text-slate-950">Review</h2><p className="text-sm text-slate-500">Confirm before saving.</p></div></div>
            <div className="space-y-4 text-sm">
              <SummaryRow label="Supplier" value={form.supplier || "Not set"} />
              <SummaryRow label="Item" value={form.description || "Not set"} />
              <SummaryRow label="Specification" value={form.specification || "Not set"} />
              <SummaryRow label="Quantity" value={form.qtyAdded || "0"} />
              <SummaryRow label="Status" value={form.status} />
              <SummaryRow label="Est. Total" value={`$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            </div>
            <button type="submit" disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Saving..." : "Save Delivery"}</button>
            {message ? <div className={cn("mt-4 rounded-2xl px-4 py-3 text-sm font-semibold", messageType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{message}</div> : null}
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <h2 className="text-lg font-bold text-slate-950">Status guide</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <Guide label="Incoming" detail="Expected or newly entered delivery." />
              <Guide label="In Transit" detail="Shipment is already moving." />
              <Guide label="Received" detail="Warehouse has received the item." />
              <Guide label="Available" detail="Stock is ready to sell/use." />
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><span className="font-semibold text-slate-500">{label}</span><span className="max-w-[180px] text-right font-bold text-slate-900">{value}</span></div>;
}

function Guide({ label, detail }: { label: string; detail: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="font-bold text-slate-900">{label}</p><p className="mt-1 text-xs font-medium text-slate-500">{detail}</p></div>;
}
