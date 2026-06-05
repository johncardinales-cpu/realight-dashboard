"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardData = {
  incomingUnits: number;
  warehouseReceived: number;
  actualOnHand: number;
  sellableUnits: number;
  totalSales: number;
  totalExpenses: number;
  netGain: number;
};

type ActivityItem = {
  id: string;
  title: string;
  note: string;
  time: string;
  icon: string;
};

type TopProduct = {
  name: string;
  sold: number;
};

const icons = {
  sales: "M6 6h15l-2 8H8L6 6Zm0 0L5 3H3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  orders: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  customers: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-6a3 3 0 1 1 0 6",
  lowStock: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  activity: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

const toneClasses: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  amber: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
};

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function num(value: number) {
  return Number(value || 0).toLocaleString();
}

function IconCircle({ icon, tone = "emerald" }: { icon: string; tone?: string }) {
  return (
    <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${toneClasses[tone] || toneClasses.emerald}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </span>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  async function loadDashboard() {
    const [dashboardRes, activityRes, productsRes] = await Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }),
      fetch("/api/recent-activity", { cache: "no-store" }),
      fetch("/api/dashboard/top-products", { cache: "no-store" }),
    ]);

    const dashboardData = await dashboardRes.json();
    const activityData = await activityRes.json();
    const productData = await productsRes.json();

    setData(dashboardData && !dashboardData.error ? dashboardData : null);
    setActivities(Array.isArray(activityData) ? activityData : []);
    setTopProducts(Array.isArray(productData) ? productData : []);
  }

  useEffect(() => {
    loadDashboard().catch(console.error);
  }, []);

  const totalSales = data?.totalSales ?? 0;
  const totalOrders = topProducts.reduce((sum, item) => sum + Number(item.sold || 0), 0);
  const totalCustomers = 0;
  const lowStockItems = 0;
  const totalItems = (data?.incomingUnits ?? 0) + (data?.warehouseReceived ?? 0) + (data?.actualOnHand ?? 0);
  const inStock = data?.sellableUnits ?? 0;
  const outOfStock = totalItems > 0 && inStock === 0 ? totalItems : 0;

  const kpis = useMemo(() => [
    { label: "Total Sales", value: peso(totalSales), change: totalSales > 0 ? "Live" : "Zero state", helper: "from confirmed sales", tone: "emerald", icon: icons.sales },
    { label: "Total Orders", value: num(totalOrders), change: totalOrders > 0 ? "Live" : "Zero state", helper: "confirmed units sold", tone: "blue", icon: icons.orders },
    { label: "Total Customers", value: num(totalCustomers), change: "Zero state", helper: "from customers sheet", tone: "violet", icon: icons.customers },
    { label: "Low Stock Items", value: num(lowStockItems), change: lowStockItems > 0 ? "Needs review" : "Clear", helper: "live inventory", tone: "orange", icon: icons.lowStock },
  ], [totalSales, totalOrders, totalCustomers, lowStockItems]);

  const hasSales = totalSales > 0;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Welcome back, Admin! Here's what's happening with your business today.</p>
        </div>
        <button onClick={() => loadDashboard().catch(console.error)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">Refresh</button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-5">
              <IconCircle icon={item.icon} tone={item.tone} />
              <div>
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{item.value}</p>
                <p className={`mt-2 text-sm font-bold ${item.tone === "orange" ? "text-orange-600" : "text-emerald-600"}`}>{item.change}</p>
                <p className="mt-1 text-sm text-slate-500">{item.helper}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Sales Overview</h2>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">This Week</button>
          </div>
          {hasSales ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">Live chart will populate as confirmed sales are created.</div>
          ) : (
            <div className="flex h-[310px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <div>
                <p className="text-lg font-bold text-slate-950">No sales data available</p>
                <p className="mt-2 text-sm text-slate-500">Confirmed sales will appear here during hard testing.</p>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200">
            <div className="px-4 first:pl-0"><p className="text-lg font-bold text-slate-950">{peso(totalSales)}</p><p className="text-sm text-slate-500">Total Sales</p></div>
            <div className="px-4"><p className="text-lg font-bold text-slate-950">{peso(totalOrders ? totalSales / totalOrders : 0)}</p><p className="text-sm text-slate-500">Average Per Unit</p></div>
            <div className="px-4"><p className="text-lg font-bold text-emerald-600">{hasSales ? "Live" : "0%"}</p><p className="text-sm text-slate-500">vs Last Week</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Recent Activities</h2>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View All</button>
          </div>
          {activities.length ? (
            <div className="divide-y divide-slate-100">
              {activities.slice(0, 5).map((item) => (
                <div key={item.id || item.title} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icons.activity} /></svg>
                  </span>
                  <div className="min-w-0 flex-1"><p className="font-bold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.note}</p></div>
                  <p className="text-sm text-slate-500">{item.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <div><p className="font-bold text-slate-950">No recent activities</p><p className="mt-1 text-sm text-slate-500">Activity will appear after testing begins.</p></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Inventory Summary</h2>
          <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4 md:divide-x md:divide-slate-200">
            <div><p className="text-sm text-slate-500">Total Items</p><p className="mt-2 text-2xl font-bold text-slate-950">{num(totalItems)}</p><p className="text-sm text-slate-500">All items in inventory</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">In Stock</p><p className="mt-2 text-2xl font-bold text-emerald-600">{num(inStock)}</p><p className="text-sm text-slate-500">Items available</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">Low Stock</p><p className="mt-2 text-2xl font-bold text-orange-600">{num(lowStockItems)}</p><p className="text-sm text-slate-500">Need attention</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">Out of Stock</p><p className="mt-2 text-2xl font-bold text-rose-600">{num(outOfStock)}</p><p className="text-sm text-slate-500">Restock required</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Top Selling Products</h2><button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View Report</button></div>
          {topProducts.length ? (
            <div className="space-y-4">
              {topProducts.map((item, index) => (
                <div key={item.name} className="flex items-center gap-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{index + 1}</span><p className="min-w-0 flex-1 font-bold text-slate-950">{item.name}</p><p className="text-sm font-semibold text-slate-500">{num(item.sold)} sold</p></div>
              ))}
            </div>
          ) : (
            <div className="flex h-[150px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><div><p className="font-bold text-slate-950">No sales data available</p><p className="mt-1 text-sm text-slate-500">Top products will appear after confirmed sales.</p></div></div>
          )}
        </div>
      </div>
    </section>
  );
}
