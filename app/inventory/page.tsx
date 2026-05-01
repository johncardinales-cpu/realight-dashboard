"use client";

import { useEffect, useMemo, useState } from "react";

type InventoryRow = Record<string, string | number>;
type InventoryStatus = "In Stock" | "Low Stock" | "Incoming" | "Out of Stock";
type ProductKind = "battery" | "inverter" | "rack" | "cable" | "clamp" | "panel" | "default";

function parseDateValue(value: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function qty(row: InventoryRow, key: string) {
  return Number(row[key] || 0) || 0;
}

function rowKey(row: InventoryRow) {
  return `${String(row["Description"] || "")}|||${String(row["Specification"] || "")}`;
}

function formatDisplayDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatus(row: InventoryRow): InventoryStatus {
  const actualOnHand = qty(row, "Actual On Hand");
  const sellable = qty(row, "Sellable Qty");
  const incoming = qty(row, "Incoming Qty");
  const minimumBuffer = qty(row, "Minimum Buffer");

  if (actualOnHand <= 0 && incoming > 0) return "Incoming";
  if (actualOnHand <= 0 && sellable <= 0) return "Out of Stock";
  if (minimumBuffer > 0 && sellable <= minimumBuffer) return "Low Stock";
  if (sellable > 0 && sellable <= 2) return "Low Stock";
  return "In Stock";
}

function getProductKind(row: InventoryRow): ProductKind {
  const text = `${String(row["Description"] || "")} ${String(row["Specification"] || "")}`.toLowerCase();

  if (text.includes("panel") || text.includes("mono") || text.includes("550w")) return "panel";
  if (text.includes("cable") || text.includes("dc ")) return "cable";
  if (text.includes("clamp")) return "clamp";
  if (text.includes("rack")) return "rack";
  if (text.includes("inverter")) return "inverter";
  if (text.includes("battery") || text.includes("lithium") || text.includes("kwh")) return "battery";

  return "default";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to update dates.";
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ type }: { type: "box" | "layers" | "tag" | "truck" | "warning" | "search" | "download" }) {
  if (type === "layers") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 17 8 4 8-4" />
      </svg>
    );
  }

  if (type === "tag") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m20.6 13.4-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
        <path d="M7.5 7.5h.01" />
      </svg>
    );
  }

  if (type === "truck") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 9h4l4 4v4h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  if (type === "download") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function KpiCard({ title, value, subtitle, tone, icon }: { title: string; value: string; subtitle: string; tone: string; icon: "box" | "layers" | "tag" | "truck" | "warning" }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", tone)}>
          <Icon type={icon} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const styles: Record<InventoryStatus, string> = {
    "In Stock": "bg-emerald-50 text-emerald-700",
    "Low Stock": "bg-amber-50 text-amber-700",
    Incoming: "bg-blue-50 text-blue-700",
    "Out of Stock": "bg-rose-50 text-rose-700",
  };

  const dots: Record<InventoryStatus, string> = {
    "In Stock": "bg-emerald-500",
    "Low Stock": "bg-amber-500",
    Incoming: "bg-blue-500",
    "Out of Stock": "bg-rose-500",
  };

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", styles[status])}>
      <span className={cn("h-2 w-2 rounded-full", dots[status])} />
      {status}
    </span>
  );
}

function ProductArtwork({ kind }: { kind: ProductKind }) {
  if (kind === "panel") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <rect x="9" y="8" width="30" height="34" rx="3" fill="#0f2a4f" />
        <path d="M15 8v34M24 8v34M33 8v34M9 17h30M9 26h30M9 35h30" stroke="#e0f2fe" strokeWidth="1.4" />
        <path d="M14 5h20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "cable") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <ellipse cx="24" cy="16" rx="15" ry="7" fill="#ef4444" />
        <path d="M9 16v16c0 4 7 7 15 7s15-3 15-7V16" fill="#dc2626" />
        <ellipse cx="24" cy="32" rx="15" ry="7" fill="#f97316" />
        <ellipse cx="24" cy="16" rx="8" ry="3.5" fill="#7f1d1d" />
        <path d="M39 27c5 1 6 5 2 8" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "clamp") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <path d="M14 15h20l5 8-5 10H14L9 23l5-8Z" fill="#d1d5db" stroke="#64748b" strokeWidth="1.5" />
        <path d="M18 19h12l3 5-3 5H18l-3-5 3-5Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M10 36h28" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "rack") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <rect x="13" y="6" width="22" height="36" rx="3" fill="#111827" />
        <rect x="17" y="11" width="14" height="5" rx="1" fill="#374151" />
        <rect x="17" y="19" width="14" height="5" rx="1" fill="#374151" />
        <rect x="17" y="27" width="14" height="5" rx="1" fill="#374151" />
        <path d="M35 10h4M35 34h4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "inverter") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <rect x="14" y="5" width="20" height="38" rx="4" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
        <rect x="18" y="10" width="12" height="9" rx="2" fill="#0f766e" />
        <circle cx="20" cy="28" r="2" fill="#22c55e" />
        <circle cx="28" cy="28" r="2" fill="#f59e0b" />
        <path d="M18 35h12" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "battery") {
    return (
      <svg viewBox="0 0 48 48" className="h-11 w-11">
        <rect x="12" y="7" width="24" height="34" rx="4" fill="#111827" />
        <rect x="18" y="4" width="12" height="5" rx="1.5" fill="#334155" />
        <rect x="16" y="13" width="16" height="7" rx="2" fill="#1f2937" />
        <path d="M18 29h12M18 34h12" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 12v7" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11">
      <rect x="11" y="11" width="26" height="26" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="m17 18 7-4 7 4-7 4-7-4ZM17 24l7 4 7-4M17 30l7 4 7-4" stroke="#0f766e" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProductThumb({ row, index }: { row: InventoryRow; index: number }) {
  const kind = getProductKind(row);
  const backgrounds: Record<ProductKind, string> = {
    battery: "from-slate-100 to-slate-50",
    inverter: "from-sky-50 to-white",
    rack: "from-slate-100 to-white",
    cable: "from-orange-50 to-white",
    clamp: "from-zinc-100 to-white",
    panel: "from-blue-50 to-white",
    default: "from-emerald-50 to-white",
  };

  return (
    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br shadow-sm", backgrounds[kind])}>
      <ProductArtwork kind={kind} />
      <span className="sr-only">Product image {index + 1}</span>
    </div>
  );
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadRows() {
    const res = await fetch("/api/inventory", { cache: "no-store" });
    const data: unknown = await res.json();
    setRows(Array.isArray(data) ? (data as InventoryRow[]) : []);
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  function setField(keyValue: string, field: "Latest Received" | "Latest Incoming", value: string) {
    setRows((prev) =>
      prev.map((row) =>
        rowKey(row) === keyValue
          ? {
              ...row,
              [field]: value,
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

      const data: unknown = await res.json();
      if (!res.ok) {
        const errorMessage =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: unknown }).error)
            : "Failed to update dates";
        throw new Error(errorMessage);
      }

      setMessage(`Updated dates for ${description}.`);
      await loadRows();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
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

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedRows.filter((row) => {
      const status = getStatus(row);
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      const text = `${String(row["Description"] || "")} ${String(row["Specification"] || "")}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [sortedRows, search, statusFilter]);

  const summary = useMemo(() => {
    const actualOnHand = rows.reduce((total, row) => total + qty(row, "Actual On Hand"), 0);
    const sellable = rows.reduce((total, row) => total + qty(row, "Sellable Qty"), 0);
    const incoming = rows.reduce((total, row) => total + qty(row, "Incoming Qty"), 0);
    const lowStock = rows.filter((row) => ["Low Stock", "Out of Stock"].includes(getStatus(row))).length;

    return {
      totalSkus: rows.length,
      actualOnHand,
      sellable,
      incoming,
      lowStock,
    };
  }, [rows]);

  const attentionRows = useMemo(() => {
    return rows
      .filter((row) => ["Low Stock", "Out of Stock", "Incoming"].includes(getStatus(row)))
      .slice(0, 4);
  }, [rows]);

  return (
    <section className="w-full space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon type="box" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">Inventory</h1>
            <p className="mt-2 max-w-3xl text-base text-slate-500">
              Track stock, incoming deliveries, sellable units, and expected arrival dates in one place.
            </p>
            {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total SKUs" value={summary.totalSkus.toLocaleString()} subtitle="All inventory items" tone="bg-blue-50 text-blue-600" icon="layers" />
        <KpiCard title="Actual On Hand" value={summary.actualOnHand.toLocaleString()} subtitle="Total units in stock" tone="bg-emerald-50 text-emerald-600" icon="box" />
        <KpiCard title="Sellable Units" value={summary.sellable.toLocaleString()} subtitle="Ready to sell" tone="bg-violet-50 text-violet-600" icon="tag" />
        <KpiCard title="Incoming Units" value={summary.incoming.toLocaleString()} subtitle="In transit / expected" tone="bg-sky-50 text-sky-600" icon="truck" />
        <KpiCard title="Low Stock Items" value={summary.lowStock.toLocaleString()} subtitle="Below minimum level" tone="bg-amber-50 text-amber-600" icon="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-slate-400"><Icon type="search" /></span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search items..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
              >
                <option>All</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Incoming</option>
                <option>Out of Stock</option>
              </select>

              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Sort: Name (A-Z)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <Icon type="download" />
                Export
              </button>
              <button className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20">
                + Add Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Item</th>
                  <th className="px-5 py-4 font-semibold">Specification</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">On Hand</th>
                  <th className="px-5 py-4 font-semibold">Sellable</th>
                  <th className="px-5 py-4 font-semibold">Incoming</th>
                  <th className="px-5 py-4 font-semibold">Dates</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const keyValue = rowKey(row);
                  const status = getStatus(row);
                  const hasReceivedStock = qty(row, "Received Qty") > 0 || qty(row, "Actual On Hand") > 0 || qty(row, "Sellable Qty") > 0;
                  const hasIncomingStock = qty(row, "Incoming Qty") > 0;

                  return (
                    <tr key={keyValue} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <ProductThumb row={row} index={index} />
                          <span className="max-w-[260px] font-semibold text-slate-900">{String(row["Description"] || "")}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">{String(row["Specification"] || "")}</td>
                      <td className="px-5 py-4"><StatusBadge status={status} /></td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{String(row["Actual On Hand"] || 0)}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{String(row["Sellable Qty"] || 0)}</td>
                      <td className="px-5 py-4 font-semibold text-blue-600">{String(row["Incoming Qty"] || 0)}</td>
                      <td className="px-5 py-4">
                        <div className="space-y-2 text-xs font-medium text-slate-500">
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-slate-400">Received</span>
                            <input
                              type="date"
                              value={String(row["Latest Received"] || "")}
                              onChange={(event) => setField(keyValue, "Latest Received", event.target.value)}
                              disabled={!hasReceivedStock}
                              className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-slate-700 disabled:bg-slate-50 disabled:text-slate-300"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-slate-400">Expected</span>
                            <input
                              type="date"
                              value={String(row["Latest Incoming"] || "")}
                              onChange={(event) => setField(keyValue, "Latest Incoming", event.target.value)}
                              disabled={!hasIncomingStock}
                              className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-slate-700 disabled:bg-slate-50 disabled:text-slate-300"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => saveDates(row)}
                          disabled={savingKey === keyValue}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {savingKey === keyValue ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                      No inventory rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Needs Attention</h2>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-600">
              {attentionRows.length}
            </span>
          </div>

          <div className="space-y-3">
            {attentionRows.map((row) => {
              const status = getStatus(row);
              const danger = status === "Out of Stock";
              const incoming = status === "Incoming";
              return (
                <div key={rowKey(row)} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex gap-3">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", danger ? "bg-rose-50 text-rose-600" : incoming ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600")}>
                      <Icon type={incoming ? "truck" : "warning"} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{String(row["Description"] || "")}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {status === "Incoming"
                          ? `${String(row["Incoming Qty"] || 0)} incoming · ${formatDisplayDate(String(row["Latest Incoming"] || ""))}`
                          : status === "Out of Stock"
                            ? "Out of stock"
                            : `Only ${String(row["Sellable Qty"] || 0)} sellable left`}
                      </p>
                      <button className="mt-2 text-sm font-semibold text-blue-600">View item</button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!attentionRows.length ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                No urgent inventory issues right now.
              </div>
            ) : null}
          </div>

          <button className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            View all inventory
          </button>
        </aside>
      </div>
    </section>
  );
}
