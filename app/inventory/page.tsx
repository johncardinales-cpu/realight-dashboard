"use client";

import { useEffect, useMemo, useState } from "react";

type InventoryRow = Record<string, string | number>;

function parseDateValue(value: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function qty(row: InventoryRow, key: string) {
  return Number(row[key] || 0) || 0;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");

  async function loadRows() {
    const res = await fetch("/api/inventory", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  function setField(index: number, key: "Latest Received" | "Latest Incoming", value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
            }
          : row
      )
    );
  }

  async function saveDates(row: InventoryRow) {
    const description = String(row["Description"] || "");
    const specification = String(row["Specification"] || "");
    const latestReceived = String(row["Latest Received"] || "");
    const latestIncoming = String(row["Latest Incoming"] || "");
    const saveKey = `${description}|||${specification}`;

    setSavingKey(saveKey);
    setMessage("");

    try {
      const res = await fetch("/api/inventory/update-dates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          specification,
          latestReceived,
          latestIncoming,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update dates");

      setMessage(`Updated dates for ${description}.`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to update dates.");
    } finally {
      setSavingKey("");
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aHasIncoming = qty(a, "Incoming Qty") > 0;
      const bHasIncoming = qty(b, "Incoming Qty") > 0;

      const aPrimary = aHasIncoming
        ? parseDateValue(String(a["Latest Incoming"] || ""))
        : parseDateValue(String(a["Latest Received"] || ""));
      const bPrimary = bHasIncoming
        ? parseDateValue(String(b["Latest Incoming"] || ""))
        : parseDateValue(String(b["Latest Received"] || ""));

      if (aPrimary !== bPrimary) return aPrimary - bPrimary;

      const aName = `${String(a["Description"] || "")} ${String(a["Specification"] || "")}`.toLowerCase();
      const bName = `${String(b["Description"] || "")} ${String(b["Specification"] || "")}`.toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [rows]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live inventory report from Google Sheets. Dates are arranged by expected arrival for incoming stock and by available/received date for stock already in hand.
        </p>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p><span className="font-medium">Expected Arrival</span> is for Incoming or In Transit stock.</p>
          <p><span className="font-medium">Available / Received Date</span> is for stock already received or available.</p>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Inventory Report</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Description</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Specification</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Incoming Qty</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Received Qty</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sold Qty</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Actual On Hand</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Minimum Buffer</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sellable Qty</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Available / Received Date</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Expected Arrival</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => {
                const saveKey = `${row["Description"]}|||${row["Specification"]}`;
                const hasReceivedStock =
                  qty(row, "Received Qty") > 0 ||
                  qty(row, "Actual On Hand") > 0 ||
                  qty(row, "Sellable Qty") > 0;
                const hasIncomingStock = qty(row, "Incoming Qty") > 0;

                return (
                  <tr key={saveKey} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">{String(row["Description"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Specification"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Incoming Qty"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Received Qty"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Sold Qty"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Actual On Hand"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Minimum Buffer"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row["Sellable Qty"] || "")}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <input
                        type="date"
                        value={String(row["Latest Received"] || "")}
                        onChange={(e) => setField(index, "Latest Received", e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1"
                        disabled={!hasReceivedStock}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <input
                        type="date"
                        value={String(row["Latest Incoming"] || "")}
                        onChange={(e) => setField(index, "Latest Incoming", e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1"
                        disabled={!hasIncomingStock}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <button
                        type="button"
                        onClick={() => saveDates(row)}
                        disabled={savingKey === saveKey}
                        className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                      >
                        {savingKey === saveKey ? "Saving..." : "Save Dates"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!sortedRows.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No inventory rows found.
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
