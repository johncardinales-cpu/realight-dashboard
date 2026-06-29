"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardData = { incomingUnits?: number; warehouseReceived?: number; actualOnHand?: number; sellableUnits?: number; totalSales?: number; totalExpenses?: number };
type ActivityItem = { id?: string; title: string; note: string; time: string };
type TopProduct = { name: string; sold: number };
type Trend = { date: string; sales: number; collections: number; expenses: number; grossProfit: number; netProfit: number; receivables: number };
type ReportsData = { error?: string; summary: Record<string, number>; dailyTrend: Trend[]; productMovement: Array<{ description: string; qty: number; confirmedQty: number }> };
type PaymentSummary = { saleDate: string; balancePhp: number; saleStatus: string };
type PeriodMode = "daily" | "weekly" | "monthly" | "ytd" | "lastYear" | "overall" | "custom";

type StatTone = "emerald" | "blue" | "violet" | "orange" | "rose" | "slate";

const periodOptions: Array<{ value: PeriodMode; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "ytd", label: "YTD" },
  { value: "lastYear", label: "Last Year" },
  { value: "overall", label: "Overall" },
  { value: "custom", label: "Custom" },
];

function peso(value: number | undefined) { return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function num(value: number | undefined) { return Number(value || 0).toLocaleString(); }
function fmt(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function today() { return fmt(new Date()); }
function safeDate(value: string) { const [year, month, day] = String(value || today()).split("-").map(Number); const date = year && month && day ? new Date(year, month - 1, day) : new Date(); return Number.isNaN(date.getTime()) ? new Date() : date; }
function title(mode: PeriodMode) { return periodOptions.find((item) => item.value === mode)?.label || "Daily"; }

function rangeForMode(mode: PeriodMode, anchorValue = today()) {
  const anchor = safeDate(anchorValue);
  const start = new Date(anchor);
  const end = new Date(anchor);

  if (mode === "daily") return { start: fmt(start), end: fmt(end) };

  if (mode === "weekly") {
    const day = start.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + offset);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    return { start: fmt(start), end: fmt(end) };
  }

  if (mode === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1, 0);
    return { start: fmt(start), end: fmt(end) };
  }

  if (mode === "ytd") {
    start.setMonth(0, 1);
    end.setTime(anchor.getTime());
    return { start: fmt(start), end: fmt(end) };
  }

  if (mode === "lastYear") {
    const year = anchor.getFullYear() - 1;
    start.setFullYear(year, 0, 1);
    end.setFullYear(year, 11, 31);
    return { start: fmt(start), end: fmt(end) };
  }

  if (mode === "overall") return { start: "1900-01-01", end: "2999-12-31" };

  return { start: fmt(start), end: fmt(end) };
}

function dateRange(start: string, end: string) {
  const a = safeDate(start);
  const b = safeDate(end);
  if (a > b) return [];
  const days: string[] = [];
  const d = new Date(a);
  while (d <= b && days.length < 730) { days.push(fmt(d)); d.setDate(d.getDate() + 1); }
  return days;
}

function emptyTrend(date: string): Trend { return { date, sales: 0, collections: 0, expenses: 0, grossProfit: 0, netProfit: 0, receivables: 0 }; }
function emptyReports(): ReportsData { return { summary: {}, dailyTrend: [], productMovement: [] }; }
function isInactive(value: unknown) { return ["cancelled", "canceled", "voided"].includes(String(value || "").trim().toLowerCase()); }
function round(value: number) { return Math.round((Number(value) || 0) * 100) / 100; }
function inRange(date: string, start: string, end: string) { return date >= start && date <= end; }

function combineReports(items: ReportsData[], days: string[]) {
  const combined = emptyReports();
  const trend = new Map<string, Trend>();
  const movement = new Map<string, { description: string; qty: number; confirmedQty: number }>();
  days.forEach((day) => trend.set(day, emptyTrend(day)));

  items.forEach((item) => {
    Object.entries(item?.summary || {}).forEach(([key, value]) => {
      if (key === "endingReceivables") combined.summary[key] = Number(value || 0);
      else combined.summary[key] = Number(combined.summary[key] || 0) + Number(value || 0);
    });

    (item?.dailyTrend || []).forEach((row) => {
      const current = trend.get(row.date) || emptyTrend(row.date);
      current.sales += Number(row.sales || 0);
      current.collections += Number(row.collections || 0);
      current.expenses += Number(row.expenses || 0);
      current.grossProfit += Number(row.grossProfit || 0);
      current.netProfit += Number(row.netProfit || 0);
      current.receivables += Number(row.receivables || 0);
      trend.set(row.date, current);
    });

    (item?.productMovement || []).forEach((product) => {
      const key = product.description || "Unknown Product";
      const current = movement.get(key) || { description: key, qty: 0, confirmedQty: 0 };
      current.qty += Number(product.qty || 0);
      current.confirmedQty += Number(product.confirmedQty || 0);
      movement.set(key, current);
    });
  });

  combined.dailyTrend = Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date));
  combined.productMovement = Array.from(movement.values()).sort((a, b) => Number(b.confirmedQty || b.qty || 0) - Number(a.confirmedQty || a.qty || 0));
  return combined;
}

function reconcileWithPayments(report: ReportsData, payments: PaymentSummary[], start: string, end: string): ReportsData {
  const open = payments.filter((p) => !isInactive(p.saleStatus) && Number(p.balancePhp || 0) > 0);
  const openInPeriod = open.filter((p) => inRange(String(p.saleDate || ""), start, end));
  const receivablesByDate = new Map<string, number>();
  openInPeriod.forEach((p) => receivablesByDate.set(p.saleDate, round((receivablesByDate.get(p.saleDate) || 0) + Number(p.balancePhp || 0))));

  return {
    ...report,
    summary: {
      ...report.summary,
      newReceivablesToday: round(openInPeriod.reduce((sum, p) => sum + Number(p.balancePhp || 0), 0)),
      endingReceivables: round(open.reduce((sum, p) => sum + Number(p.balancePhp || 0), 0)),
    },
    dailyTrend: report.dailyTrend.map((row) => ({ ...row, receivables: round(receivablesByDate.get(row.date) || row.receivables || 0) })),
  };
}

function StatCard({ label, value, status, helper, tone = "emerald" }: { label: string; value: string; status: string; helper: string; tone?: StatTone }) {
  const badge = tone === "orange" ? "bg-orange-50 text-orange-600" : tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "slate" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-600";
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${badge}`}>₱</span><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className={`mt-2 text-sm font-bold ${tone === "orange" ? "text-orange-600" : tone === "rose" ? "text-rose-600" : "text-emerald-600"}`}>{status}</p><p className="mt-1 text-sm text-slate-500">{helper}</p></div></div></div>;
}

function MiniChart({ rows }: { rows: Trend[] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.sales || 0, r.collections || 0, r.grossProfit || 0, r.expenses || 0)), 1);
  const hasData = rows.some((r) => Number(r.sales || 0) > 0 || Number(r.collections || 0) > 0 || Number(r.grossProfit || 0) > 0 || Number(r.expenses || 0) > 0);
  const bars = [{ key: "sales", label: "Sales", color: "bg-emerald-500" }, { key: "collections", label: "Collections", color: "bg-blue-500" }, { key: "grossProfit", label: "Gross Profit", color: "bg-violet-500" }, { key: "expenses", label: "Expenses", color: "bg-orange-500" }] as const;

  if (!rows.length) return <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><p className="font-bold text-slate-500">No date range selected.</p></div>;

  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">{!hasData ? <p className="mb-3 text-center text-sm font-semibold text-slate-500">No sales in this selected period yet.</p> : null}<div className="flex h-[220px] items-end gap-4 overflow-x-auto pb-2">{rows.map((row) => <div key={row.date} className="flex min-w-[90px] flex-1 flex-col items-center justify-end gap-2"><div className="flex h-[170px] items-end gap-1.5">{bars.map((bar) => <div key={bar.key} className={`w-4 rounded-t-lg ${bar.color}`} style={{ height: `${Math.max((Number(row[bar.key] || 0) / max) * 170, hasData ? 2 : 0)}px` }} />)}</div><p className="text-xs font-semibold text-slate-500">{row.date.slice(5)}</p></div>)}</div><div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">{bars.map((bar) => <span key={bar.key} className="inline-flex items-center gap-2"><span className={`h-3 w-3 rounded ${bar.color}`} />{bar.label}</span>)}</div></div>;
}

export default function DashboardClient() {
  const initialRange = rangeForMode("weekly");
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("weekly");
  const [rangeStart, setRangeStart] = useState(initialRange.start);
  const [rangeEnd, setRangeEnd] = useState(initialRange.end);
  const [loading, setLoading] = useState(false);

  async function fetchReports(start: string, end: string, mode: PeriodMode): Promise<ReportsData> {
    if (mode !== "custom") {
      const reportDate = mode === "overall" ? today() : end;
      const res = await fetch(`/api/reports?mode=${mode}&date=${reportDate}&t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      return json && !json.error ? json : emptyReports();
    }

    const days = dateRange(start, end);
    if (!days.length) return emptyReports();
    const responses = await Promise.all(days.map((day) => fetch(`/api/reports?mode=daily&date=${day}&t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json())));
    return combineReports(responses.filter((item: ReportsData) => item && !item.error), days);
  }

  async function loadDashboard(start = rangeStart, end = rangeEnd, mode = periodMode) {
    setLoading(true);
    try {
      const [dashboardRes, reportsData, activityRes, productsRes, paymentsRes] = await Promise.all([
        fetch(`/api/dashboard?t=${Date.now()}`, { cache: "no-store" }),
        fetchReports(start, end, mode),
        fetch(`/api/recent-activity?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/dashboard/top-products?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const dashboardData = await dashboardRes.json();
      const activityData = await activityRes.json();
      const productData = await productsRes.json();
      const paymentData = await paymentsRes.json();
      setData(dashboardData && !dashboardData.error ? dashboardData : null);
      setReports(reconcileWithPayments(reportsData, Array.isArray(paymentData) ? paymentData : [], start, end));
      setActivities(Array.isArray(activityData) ? activityData : []);
      setTopProducts(Array.isArray(productData) ? productData : []);
    } finally {
      setLoading(false);
    }
  }

  function selectPreset(mode: PeriodMode) {
    if (mode === "custom") { setPeriodMode("custom"); return; }
    const next = rangeForMode(mode, rangeEnd || today());
    setPeriodMode(mode);
    setRangeStart(next.start);
    setRangeEnd(next.end);
    loadDashboard(next.start, next.end, mode).catch(console.error);
  }

  function applyCustomRange() { setPeriodMode("custom"); loadDashboard(rangeStart, rangeEnd, "custom").catch(console.error); }

  useEffect(() => { loadDashboard(initialRange.start, initialRange.end, "weekly").catch(console.error); }, []);

  const s = reports?.summary || {};
  const totalSales = s.totalSalesToday ?? data?.totalSales ?? 0;
  const totalOrders = s.dailySaleCount ?? topProducts.reduce((sum, item) => sum + Number(item.sold || 0), 0);
  const unitsSold = reports?.productMovement?.reduce((sum, item) => sum + Number(item.confirmedQty || item.qty || 0), 0) ?? totalOrders;
  const collections = s.collectionsToday ?? 0;
  const cashReceived = s.cashReceivedToday ?? 0;
  const changeGiven = s.changeGivenToday ?? 0;
  const netCash = s.netCashAfterChangeToday ?? 0;
  const expenses = s.expensesToday ?? data?.totalExpenses ?? 0;
  const grossProfit = s.grossProfitToday ?? 0;
  const netProfit = s.netProfitToday ?? grossProfit - expenses;
  const receivables = s.endingReceivables ?? 0;
  const totalItems = (data?.incomingUnits ?? 0) + (data?.warehouseReceived ?? 0) + (data?.actualOnHand ?? 0);
  const inStock = data?.sellableUnits ?? 0;
  const outOfStock = totalItems > 0 && inStock === 0 ? totalItems : 0;
  const lowStockItems = 0;
  const rangeLabel = periodMode === "overall" ? "All available records" : `${rangeStart} to ${rangeEnd}`;
  const dateControlsDisabled = periodMode === "overall";

  const stats = useMemo(() => [
    { label: "Sales", value: peso(totalSales), status: totalSales ? "Live" : "Zero state", helper: `${title(periodMode).toLowerCase()} confirmed sales`, tone: "emerald" as const },
    { label: "Collections", value: peso(collections), status: collections ? "Collected" : "Zero state", helper: "applied payments", tone: "blue" as const },
    { label: "Net Cash", value: peso(netCash), status: cashReceived ? `${peso(cashReceived)} tendered` : "Zero state", helper: `less ${peso(changeGiven)} change`, tone: "emerald" as const },
    { label: "Net Profit", value: peso(netProfit), status: expenses ? `${peso(expenses)} expenses` : "No expenses", helper: `${peso(grossProfit)} gross profit`, tone: netProfit < 0 ? "rose" as const : "violet" as const },
    { label: "Expenses", value: peso(expenses), status: expenses ? "Recorded" : "Zero state", helper: "manual + supplier costs", tone: expenses ? "orange" as const : "slate" as const },
    { label: "Receivables", value: peso(receivables), status: receivables ? "Open balances" : "Clear", helper: "from Payments open balances", tone: receivables ? "orange" as const : "emerald" as const },
    { label: "Orders", value: num(totalOrders), status: totalOrders ? "Live" : "Zero state", helper: `${num(unitsSold)} confirmed units sold`, tone: "blue" as const },
    { label: "Low Stock", value: num(lowStockItems), status: lowStockItems ? "Needs review" : "Clear", helper: "live inventory", tone: "orange" as const },
  ], [totalSales, collections, netCash, cashReceived, changeGiven, netProfit, expenses, grossProfit, receivables, totalOrders, unitsSold, lowStockItems, periodMode]);

  return <section className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Live business snapshot from Reports plus reconciled Payments open balances.</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{title(periodMode)} dashboard: {rangeLabel}</p>
      </div>
      <button onClick={() => loadDashboard(rangeStart, rangeEnd, periodMode).catch(console.error)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">{loading ? "Refreshing..." : "Refresh"}</button>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">{stats.map((item) => <StatCard key={item.label} {...item} />)}</div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Sales Overview</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Showing {rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{periodOptions.map((option) => <button key={option.value} onClick={() => selectPreset(option.value)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${periodMode === option.value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{option.label}</button>)}</div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <input type="date" value={rangeStart} disabled={dateControlsDisabled} onChange={(event) => { setRangeStart(event.target.value); setPeriodMode("custom"); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50" />
              <span className="text-xs font-bold text-slate-400">to</span>
              <input type="date" value={rangeEnd} disabled={dateControlsDisabled} onChange={(event) => { setRangeEnd(event.target.value); setPeriodMode("custom"); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50" />
              <button onClick={applyCustomRange} disabled={dateControlsDisabled} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Apply</button>
            </div>
          </div>
        </div>
        <MiniChart rows={reports?.dailyTrend || []} />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5 md:divide-x md:divide-slate-200">
          <div className="md:px-4 md:first:pl-0"><p className="text-lg font-bold text-slate-950">{peso(totalSales)}</p><p className="text-sm text-slate-500">Sales</p></div>
          <div className="md:px-4"><p className="text-lg font-bold text-slate-950">{peso(collections)}</p><p className="text-sm text-slate-500">Collections</p></div>
          <div className="md:px-4"><p className="text-lg font-bold text-slate-950">{peso(expenses)}</p><p className="text-sm text-slate-500">Expenses</p></div>
          <div className="md:px-4"><p className="text-lg font-bold text-slate-950">{peso(grossProfit)}</p><p className="text-sm text-slate-500">Gross Profit</p></div>
          <div className="md:px-4"><p className={`text-lg font-bold ${netProfit < 0 ? "text-rose-600" : "text-emerald-600"}`}>{peso(netProfit)}</p><p className="text-sm text-slate-500">Net Profit</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Recent Activities</h2><a href="/reports" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View All</a></div>
        {activities.length ? <div className="divide-y divide-slate-100">{activities.slice(0, 5).map((item) => <div key={item.id || item.title} className="py-4 first:pt-0 last:pb-0"><p className="font-bold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.note}</p><p className="mt-1 text-xs text-slate-400">{item.time}</p></div>)}</div> : <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><p className="font-bold text-slate-500">No recent activities</p></div>}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.6fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Inventory Summary</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 md:divide-x md:divide-slate-200">
          <div className="md:px-4 md:first:pl-0"><p className="text-sm text-slate-500">Total Items</p><p className="mt-2 text-2xl font-bold text-slate-950">{num(totalItems)}</p><p className="text-sm text-slate-500">All items in inventory</p></div>
          <div className="md:px-4"><p className="text-sm text-slate-500">In Stock</p><p className="mt-2 text-2xl font-bold text-blue-600">{num(inStock)}</p><p className="text-sm text-slate-500">Items available</p></div>
          <div className="md:px-4"><p className="text-sm text-slate-500">Low Stock</p><p className="mt-2 text-2xl font-bold text-orange-600">{num(lowStockItems)}</p><p className="text-sm text-slate-500">Need attention</p></div>
          <div className="md:px-4"><p className="text-sm text-slate-500">Out of Stock</p><p className="mt-2 text-2xl font-bold text-rose-600">{num(outOfStock)}</p><p className="text-sm text-slate-500">Restock required</p></div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Top Selling Products</h2><a href="/reports" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View Report</a></div>
        {topProducts.length ? <div className="space-y-4">{topProducts.slice(0, 5).map((item, index) => <div key={item.name} className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{index + 1}</span><p className="font-bold text-slate-950">{item.name}</p></div><p className="text-sm font-semibold text-slate-500">{num(item.sold)} sold</p></div>)}</div> : <p className="text-sm text-slate-500">No product sales yet.</p>}
      </div>
    </div>
  </section>;
}
