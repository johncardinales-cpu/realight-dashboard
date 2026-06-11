"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardData = { incomingUnits: number; warehouseReceived: number; actualOnHand: number; sellableUnits: number; totalSales: number; totalExpenses: number; netGain: number };
type ActivityItem = { id: string; title: string; note: string; time: string; icon: string };
type TopProduct = { name: string; sold: number };
type Trend = { date: string; sales: number; collections: number; expenses: number; grossProfit: number; netProfit: number; receivables: number };
type ReportsData = { summary: Record<string, number>; dailyTrend: Trend[]; productMovement: Array<{ description: string; qty: number; confirmedQty: number }> };
type PeriodMode = "daily" | "weekly" | "monthly" | "yearly";

const icons = {
  sales: "M6 6h15l-2 8H8L6 6Zm0 0L5 3H3M9 20a1 1 0 1 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  orders: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  lowStock: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  activity: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  money: "M12 6v12m-4-8c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4 1.79-4 4",
};
const toneClasses: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", orange: "bg-orange-50 text-orange-600", rose: "bg-rose-50 text-rose-600", slate: "bg-slate-100 text-slate-600" };
function peso(value: number) { return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function num(value: number) { return Number(value || 0).toLocaleString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function title(mode: PeriodMode) { return mode === "daily" ? "Daily" : mode === "weekly" ? "Weekly" : mode === "monthly" ? "Monthly" : "Yearly"; }
function go(path: string) { globalThis.location.assign(path); }

function IconCircle({ icon, tone = "emerald" }: { icon: string; tone?: string }) {
  return <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toneClasses[tone] || toneClasses.emerald}`}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg></span>;
}

function MiniChart({ rows }: { rows: Trend[] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.sales || 0, r.grossProfit || 0)), 1);
  if (!rows.length || max <= 1) return <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><div><p className="text-lg font-bold text-slate-950">No sales data available</p><p className="mt-2 text-sm text-slate-500">Confirmed sales will appear here.</p></div></div>;
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex h-[220px] items-end gap-4 overflow-x-auto pb-2">{rows.map((r) => <div key={r.date} className="flex min-w-[80px] flex-1 flex-col items-center justify-end gap-2"><div className="flex h-[180px] items-end gap-2"><div className="w-5 rounded-t-lg bg-emerald-500" style={{ height: `${Math.max((r.sales / max) * 180, r.sales ? 8 : 0)}px` }} /><div className="w-5 rounded-t-lg bg-blue-500" style={{ height: `${Math.max((r.grossProfit / max) * 180, r.grossProfit ? 8 : 0)}px` }} /></div><p className="text-xs font-semibold text-slate-500">{r.date.slice(5)}</p></div>)}</div><div className="mt-3 flex gap-5 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-emerald-500" />Sales</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-blue-500" />Gross Profit</span></div></div>;
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("weekly");
  const reportDate = today();

  async function loadDashboard(mode = periodMode) {
    const [dashboardRes, reportsRes, activityRes, productsRes] = await Promise.all([fetch("/api/dashboard", { cache: "no-store" }), fetch(`/api/reports?mode=${mode}&date=${reportDate}`, { cache: "no-store" }), fetch("/api/recent-activity", { cache: "no-store" }), fetch("/api/dashboard/top-products", { cache: "no-store" })]);
    const dashboardData = await dashboardRes.json();
    const reportsData = await reportsRes.json();
    const activityData = await activityRes.json();
    const productData = await productsRes.json();
    setData(dashboardData && !dashboardData.error ? dashboardData : null);
    setReports(reportsData && !reportsData.error ? reportsData : null);
    setActivities(Array.isArray(activityData) ? activityData : []);
    setTopProducts(Array.isArray(productData) ? productData : []);
  }
  useEffect(() => { loadDashboard(periodMode).catch(console.error); }, [periodMode]);

  const s = reports?.summary || {};
  const totalSales = s.totalSalesToday ?? data?.totalSales ?? 0;
  const totalOrders = s.dailySaleCount ?? topProducts.reduce((a, x) => a + Number(x.sold || 0), 0);
  const unitsSold = reports?.productMovement?.reduce((a, x) => a + Number(x.confirmedQty || x.qty || 0), 0) ?? totalOrders;
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

  const kpis = useMemo(() => [
    { label: "Sales", value: peso(totalSales), change: totalSales ? "Live" : "Zero state", helper: `${title(periodMode).toLowerCase()} confirmed sales`, tone: "emerald", icon: icons.sales },
    { label: "Collections", value: peso(collections), change: collections ? "Collected" : "Zero state", helper: "applied payments", tone: "blue", icon: icons.money },
    { label: "Net Cash", value: peso(netCash), change: cashReceived ? `${peso(cashReceived)} tendered` : "Zero state", helper: `less ${peso(changeGiven)} change`, tone: "emerald", icon: icons.money },
    { label: "Net Profit", value: peso(netProfit), change: expenses ? `${peso(expenses)} expenses` : "No expenses", helper: `${peso(grossProfit)} gross profit`, tone: netProfit < 0 ? "rose" : "violet", icon: icons.money },
    { label: "Expenses", value: peso(expenses), change: expenses ? "Recorded" : "Zero state", helper: "manual + supplier costs", tone: expenses ? "orange" : "slate", icon: icons.money },
    { label: "Receivables", value: peso(receivables), change: receivables ? "Open balances" : "Clear", helper: "all unpaid balances", tone: receivables ? "orange" : "emerald", icon: icons.money },
    { label: "Orders", value: num(totalOrders), change: totalOrders ? "Live" : "Zero state", helper: `${num(unitsSold)} confirmed units sold`, tone: "blue", icon: icons.orders },
    { label: "Low Stock", value: num(lowStockItems), change: lowStockItems ? "Needs review" : "Clear", helper: "live inventory", tone: "orange", icon: icons.lowStock },
  ], [totalSales, collections, netCash, cashReceived, changeGiven, netProfit, expenses, grossProfit, receivables, totalOrders, unitsSold, lowStockItems, periodMode]);

  return <section className="space-y-6"><div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1><p className="mt-1 text-sm font-medium text-slate-500">Live business snapshot from the same totals used in Reports.</p></div><button onClick={() => loadDashboard(periodMode).catch(console.error)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">Refresh</button></div><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><IconCircle icon={item.icon} tone={item.tone} /><div><p className="text-sm font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{item.value}</p><p className={`mt-2 text-sm font-bold ${item.tone === "rose" ? "text-rose-600" : item.tone === "orange" ? "text-orange-600" : "text-emerald-600"}`}>{item.change}</p><p className="mt-1 text-sm text-slate-500">{item.helper}</p></div></div></div>)}</div><div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-950">Sales Overview</h2><div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{(["daily", "weekly", "monthly", "yearly"] as PeriodMode[]).map((mode) => <button key={mode} onClick={() => setPeriodMode(mode)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${periodMode === mode ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{title(mode)}</button>)}</div></div><MiniChart rows={reports?.dailyTrend || []} /><div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 md:divide-x md:divide-slate-200"><div className="md:px-4 md:first:pl-0"><p className="text-lg font-bold text-slate-950">{peso(totalSales)}</p><p className="text-sm text-slate-500">Sales</p></div><div className="md:px-4"><p className="text-lg font-bold text-slate-950">{peso(collections)}</p><p className="text-sm text-slate-500">Collections</p></div><div className="md:px-4"><p className="text-lg font-bold text-slate-950">{peso(grossProfit)}</p><p className="text-sm text-slate-500">Gross Profit</p></div><div className="md:px-4"><p className={`text-lg font-bold ${netProfit < 0 ? "text-rose-600" : "text-emerald-600"}`}>{peso(netProfit)}</p><p className="text-sm text-slate-500">Net Profit</p></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Recent Activities</h2><button onClick={() => go("/reports")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View All</button></div>{activities.length ? <div className="divide-y divide-slate-100">{activities.slice(0, 5).map((item) => <div key={item.id || item.title} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icons.activity} /></svg></span><div className="min-w-0 flex-1"><p className="font-bold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.note}</p></div><p className="text-sm text-slate-500">{item.time}</p></div>)}</div> : <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><div><p className="font-bold text-slate-950">No recent activities</p><p className="mt-1 text-sm text-slate-500">Activity will appear after testing begins.</p></div></div>}</div></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-950">Inventory Summary</h2><div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4 md:divide-x md:divide-slate-200"><div><p className="text-sm text-slate-500">Total Items</p><p className="mt-2 text-2xl font-bold text-slate-950">{num(totalItems)}</p><p className="text-sm text-slate-500">All items in inventory</p></div><div className="md:pl-6"><p className="text-sm text-slate-500">In Stock</p><p className="mt-2 text-2xl font-bold text-emerald-600">{num(inStock)}</p><p className="text-sm text-slate-500">Items available</p></div><div className="md:pl-6"><p className="text-sm text-slate-500">Low Stock</p><p className="mt-2 text-2xl font-bold text-orange-600">{num(lowStockItems)}</p><p className="text-sm text-slate-500">Need attention</p></div><div className="md:pl-6"><p className="text-sm text-slate-500">Out of Stock</p><p className="mt-2 text-2xl font-bold text-rose-600">{num(outOfStock)}</p><p className="text-sm text-slate-500">Restock required</p></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Top Selling Products</h2><button onClick={() => go("/reports")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View Report</button></div>{topProducts.length ? <div className="space-y-4">{topProducts.map((item, index) => <div key={item.name} className="flex items-center gap-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{index + 1}</span><p className="min-w-0 flex-1 font-bold text-slate-950">{item.name}</p><p className="text-sm font-semibold text-slate-500">{num(item.sold)} sold</p></div>)}</div> : <div className="flex h-[150px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><div><p className="font-bold text-slate-950">No sales data available</p><p className="mt-1 text-sm text-slate-500">Top products will appear after confirmed sales.</p></div></div>}</div></div></section>;
}
