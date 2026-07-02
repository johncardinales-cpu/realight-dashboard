"use client";

import { useEffect, useMemo, useState } from "react";

type SupplierCostRow = {
  "Upload Date"?: string;
  Supplier?: string;
  "Batch / Reference"?: string;
  "Invoice No."?: string;
  "Invoice Valid"?: string;
  "Product Subtotal"?: string;
  "Freight Cost"?: string;
  "Delivery Cost"?: string;
  "Customs Cost"?: string;
  "Other Cost"?: string;
  "Total Invoice Cost"?: string;
  Notes?: string;
  _rowNumber?: string;
};

const presets = [
  { value: "overall", label: "Overall" },
  { value: "monthly", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" },
] as const;

type Preset = (typeof presets)[number]["value"];

function text(value: unknown) {
  return String(value || "").trim();
}

function amount(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function peso(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function today() {
  return formatDate(new Date());
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : formatDate(parsed);
}

function rangeForPreset(preset: Preset) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (preset === "overall") return { start: "1900-01-01", end: "2999-12-31" };
  if (preset === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1, 0);
    return { start: formatDate(start), end: formatDate(end) };
  }
  if (preset === "lastMonth") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1, 0);
    return { start: formatDate(start), end: formatDate(end) };
  }
  if (preset === "ytd") {
    start.setMonth(0, 1);
    return { start: formatDate(start), end: today() };
  }
  return { start: today(), end: today() };
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function isValidInvoice(value: unknown) {
  const status = text(value).toLowerCase();
  return !["no", "false", "invalid", "void", "voided", "cancelled", "canceled"].includes(status);
}

function supplierName(row: SupplierCostRow) {
  return text(row.Supplier) || "Unspecified Supplier";
}

function invoiceRef(row: SupplierCostRow) {
  return text(row["Invoice No."]) || text(row["Batch / Reference"]) || `Row ${row._rowNumber || "-"}`;
}

function StatCard({ label, value, helper, tone = "slate" }: { label: string; value: string; helper: string; tone?: "emerald" | "blue" | "amber" | "rose" | "slate" }) {
  const toneClass = tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : tone === "blue" ? "border-blue-100 bg-blue-50 text-blue-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-700" : tone === "rose" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><p className="text-sm font-semibold opacity-80">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs font-semibold opacity-75">{helper}</p></div>;
}

export default function SupplierCostsPage() {
  const overallRange = rangeForPreset("overall");
  const [rows, setRows] = useState<SupplierCostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preset, setPreset] = useState<Preset>("overall");
  const [startDate, setStartDate] = useState(overallRange.start);
  const [endDate, setEndDate] = useState(overallRange.end);
  const [supplierFilter, setSupplierFilter] = useState("All");

  async function loadRows() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/supplier-invoice-costs?t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load supplier costs.");
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load supplier costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  function selectPreset(nextPreset: Preset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const nextRange = rangeForPreset(nextPreset);
      setStartDate(nextRange.start);
      setEndDate(nextRange.end);
    }
  }

  const suppliers = useMemo(() => {
    const names = Array.from(new Set(rows.map(supplierName))).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return ["All", ...names];
  }, [rows]);

  const filteredRows = useMemo(() => rows
    .map((row) => ({ ...row, normalizedDate: normalizeDate(row["Upload Date"]) }))
    .filter((row) => inRange(row.normalizedDate, startDate, endDate))
    .filter((row) => supplierFilter === "All" || supplierName(row) === supplierFilter)
    .sort((a, b) => `${b.normalizedDate}-${invoiceRef(b)}`.localeCompare(`${a.normalizedDate}-${invoiceRef(a)}`)), [rows, startDate, endDate, supplierFilter]);

  const validRows = useMemo(() => filteredRows.filter((row) => isValidInvoice(row["Invoice Valid"])), [filteredRows]);
  const invalidRows = useMemo(() => filteredRows.filter((row) => !isValidInvoice(row["Invoice Valid"])), [filteredRows]);
  const totalSupplierCost = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Total Invoice Cost"]), 0), [validRows]);
  const productSubtotal = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Product Subtotal"]), 0), [validRows]);
  const freightCost = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Freight Cost"]), 0), [validRows]);
  const deliveryCost = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Delivery Cost"]), 0), [validRows]);
  const customsCost = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Customs Cost"]), 0), [validRows]);
  const otherCost = useMemo(() => validRows.reduce((sum, row) => sum + amount(row["Other Cost"]), 0), [validRows]);
  const supplierCount = useMemo(() => new Set(validRows.map(supplierName)).size, [validRows]);

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Internal Accounting</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Supplier Costs</h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">Read-only supplier invoice cost view from Supplier_Invoice_Costs. This page is intentionally separate from Dashboard and Reports navigation.</p>
        </div>
        <button type="button" onClick={() => loadRows().catch(console.error)} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">{loading ? "Refreshing..." : "Refresh"}</button>
      </div>
      {message ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Note: the current Supplier_Invoice_Costs sheet has invoice-cost fields but no separate payment-status, amount-paid, or supplier-balance columns. Until those columns are added, this page treats valid supplier invoice costs as supplier cost recorded / paid.</p>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Filter Supplier Cost View</h2>
          <p className="mt-1 text-sm text-slate-500">Use this to review supplier cost totals without changing Dashboard or Reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((item) => <button key={item.value} type="button" onClick={() => selectPreset(item.value)} className={`rounded-xl px-3 py-2 text-sm font-bold ${preset === item.value ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block space-y-1"><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Start Date</span><input type="date" value={startDate === "1900-01-01" ? "" : startDate} onChange={(event) => { setPreset("custom"); setStartDate(event.target.value || "1900-01-01"); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" /></label>
        <label className="block space-y-1"><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">End Date</span><input type="date" value={endDate === "2999-12-31" ? "" : endDate} onChange={(event) => { setPreset("custom"); setEndDate(event.target.value || "2999-12-31"); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" /></label>
        <label className="block space-y-1"><span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Supplier</span><select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">{suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select></label>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Supplier Cost Recorded" value={peso(totalSupplierCost)} helper="valid invoice rows" tone="emerald" />
      <StatCard label="Paid / Recorded" value={peso(totalSupplierCost)} helper="same as recorded until payment columns exist" tone="blue" />
      <StatCard label="Supplier Payable" value={peso(0)} helper="needs payment-status columns later" tone="slate" />
      <StatCard label="Product Subtotal" value={peso(productSubtotal)} helper="product portion" tone="slate" />
      <StatCard label="Logistics / Customs" value={peso(freightCost + deliveryCost + customsCost)} helper="freight + delivery + customs" tone="amber" />
      <StatCard label="Suppliers" value={supplierCount.toLocaleString()} helper={`${validRows.length} valid invoice rows`} tone="slate" />
    </div>

    <div className="grid gap-4 md:grid-cols-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Freight Cost</p><p className="mt-1 text-lg font-bold text-slate-950">{peso(freightCost)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Delivery Cost</p><p className="mt-1 text-lg font-bold text-slate-950">{peso(deliveryCost)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Customs Cost</p><p className="mt-1 text-lg font-bold text-slate-950">{peso(customsCost)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Other Cost</p><p className="mt-1 text-lg font-bold text-slate-950">{peso(otherCost)}</p></div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm"><p className="text-xs font-semibold text-rose-600">Invalid / Voided Rows</p><p className="mt-1 text-lg font-bold text-rose-700">{invalidRows.length.toLocaleString()}</p></div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Supplier Invoice Cost Records</h2>
          <p className="mt-1 text-sm text-slate-500">Showing {filteredRows.length.toLocaleString()} row(s). Invalid / voided rows are shown but excluded from totals.</p>
        </div>
      </div>
      <div className="overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>{["Date", "Supplier", "Batch / Ref", "Invoice No.", "Valid", "Product", "Freight", "Delivery", "Customs", "Other", "Total", "Notes"].map((header) => <th key={header} className="px-4 py-3 text-left font-medium whitespace-nowrap">{header}</th>)}</tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const valid = isValidInvoice(row["Invoice Valid"]);
              return <tr key={`${row._rowNumber || invoiceRef(row)}-${invoiceRef(row)}`} className={`border-t border-slate-100 ${valid ? "" : "bg-rose-50/50"}`}>
                <td className="px-4 py-3 text-slate-700">{normalizeDate(row["Upload Date"]) || "-"}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{supplierName(row)}</td>
                <td className="px-4 py-3 text-slate-700">{text(row["Batch / Reference"]) || "-"}</td>
                <td className="px-4 py-3 text-slate-700">{text(row["Invoice No."]) || "-"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${valid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{text(row["Invoice Valid"]) || "Valid"}</span></td>
                <td className="px-4 py-3 text-slate-700">{peso(amount(row["Product Subtotal"]))}</td>
                <td className="px-4 py-3 text-slate-700">{peso(amount(row["Freight Cost"]))}</td>
                <td className="px-4 py-3 text-slate-700">{peso(amount(row["Delivery Cost"]))}</td>
                <td className="px-4 py-3 text-slate-700">{peso(amount(row["Customs Cost"]))}</td>
                <td className="px-4 py-3 text-slate-700">{peso(amount(row["Other Cost"]))}</td>
                <td className="px-4 py-3 font-bold text-slate-950">{peso(amount(row["Total Invoice Cost"]))}</td>
                <td className="px-4 py-3 text-slate-700">{text(row.Notes) || "-"}</td>
              </tr>;
            })}
            {!filteredRows.length ? <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No supplier cost records found for the selected filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
