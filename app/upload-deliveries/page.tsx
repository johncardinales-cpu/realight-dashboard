"use client";

import { useMemo, useState } from "react";

type ParsedRow = {
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

const expectedHeaders = [
  "Upload Date",
  "Arrival Date",
  "Supplier",
  "Batch / Reference",
  "Description",
  "Specification",
  "Qty Added",
  "Unit Price (USD)",
  "Invoice Valid",
  "Status",
  "Notes",
];

const sampleCsv = `Upload Date,Arrival Date,Supplier,Batch / Reference,Description,Specification,Qty Added,Unit Price (USD),Invoice Valid,Status,Notes
2026-04-24,2026-04-25,BLUESUN,DEL-20260424-01,10KWh LV Lithium Battery,BSM48200W,20,1000,2026/04/30,Incoming,Sample import`;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapRow(headers: string[], cells: string[]): ParsedRow {
  const get = (label: string) => {
    const index = headers.findIndex((h) => normalizeHeader(h) === normalizeHeader(label));
    return index >= 0 ? String(cells[index] ?? "").trim() : "";
  };

  return {
    uploadDate: get("Upload Date"),
    arrivalDate: get("Arrival Date"),
    supplier: get("Supplier"),
    batchReference: get("Batch / Reference"),
    description: get("Description"),
    specification: get("Specification"),
    qtyAdded: get("Qty Added"),
    unitPriceUsd: get("Unit Price (USD)"),
    invoiceValid: get("Invoice Valid"),
    status: get("Status") || "Incoming",
    notes: get("Notes"),
  };
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((v) => v.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((v) => v.trim());
    return mapRow(headers, cells);
  });
}

export default function UploadDeliveriesPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => rows.length > 0, [rows]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage("");

    if (!file) return;

    setFileName(file.name);

    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
  }

  async function onImport() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/upload-deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to import deliveries");
      }

      setMessage(`Imported ${data.imported} row(s) successfully.`);
      setRows([]);
      setFileName("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to import deliveries.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Upload Deliveries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a CSV template and import many delivery rows into App_Deliveries.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Required CSV headers</h2>
          <p className="text-sm text-slate-600">{expectedHeaders.join(" | ")}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Sample CSV</h3>
          <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
{sampleCsv}
          </pre>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="block w-full text-sm text-slate-700"
          />
          {fileName ? <span className="text-sm text-slate-600">Loaded: {fileName}</span> : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={onImport}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Importing..." : "Confirm Import"}
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Import Preview</h2>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {expectedHeaders.map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{row.uploadDate}</td>
                  <td className="px-4 py-3 text-slate-700">{row.arrivalDate}</td>
                  <td className="px-4 py-3 text-slate-700">{row.supplier}</td>
                  <td className="px-4 py-3 text-slate-700">{row.batchReference}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                  <td className="px-4 py-3 text-slate-700">{row.qtyAdded}</td>
                  <td className="px-4 py-3 text-slate-700">{row.unitPriceUsd}</td>
                  <td className="px-4 py-3 text-slate-700">{row.invoiceValid}</td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                  <td className="px-4 py-3 text-slate-700">{row.notes}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No rows loaded yet.
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
