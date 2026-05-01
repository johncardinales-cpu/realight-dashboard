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

function peso(value: number) {
  return `₱${value.toLocaleString()}`;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

const iconPaths = {
  incoming: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  warehouse: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01",
  sales: "M6 6h15l-2 8H8L6 6Zm0 0L5 3H3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  expenses: "M4 7h16v12H4V7Zm0 4h16M16 15h2",
  gain: "M4 17 10 11l4 4 6-8M20 7v6h-6",
};

function MetricIcon({ path, tone = "emerald" }: { path: string; tone?: "emerald" | "blue" | "amber" | "violet" | "rose" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const kpis = useMemo(
    () => [
      { title: "Incoming Units", value: data ? formatNumber(data.incomingUnits) : "...", icon: iconPaths.incoming, tone: "emerald" as const },
      { title: "Warehouse Received", value: data ? formatNumber(data.warehouseReceived) : "...", icon: iconPaths.warehouse, tone: "blue" as const },
      { title: "Actual On Hand", value: data ? formatNumber(data.actualOnHand) : "...", icon: iconPaths.incoming, tone: "emerald" as const },
      { title: "Sellable Units", value: data ? formatNumber(data.sellableUnits) : "...", icon: iconPaths.tag, tone: "amber" as const },
      { title: "Total Sales", value: data ? peso(data.totalSales) : "...", icon: iconPaths.sales, tone: "violet" as const },
      { title: "Total Expenses", value: data ? peso(data.totalExpenses) : "...", icon: iconPaths.expenses, tone: "rose" as const },
      { title: "Net Gain", value: data ? peso(data.netGain) : "...", icon: iconPaths.gain, tone: "emerald" as const },
    ],
    [data]
  );

  const onHand = data?.actualOnHand ?? 0;
  const trend = [
    Math.max(Math.round(onHand * 0.64), 0),
    Math.max(Math.round(onHand * 0.72), 0),
    Math.max(Math.round(onHand * 0.81), 0),
    Math.max(Math.round(onHand * 0.9), 0),
    Math.max(Math.round(onHand * 0.96), 0),
    onHand,
  ];
  const maxTrend = Math.max(...trend, 20000);
  const chartLeft = 58;
  const chartRight = 1060;
  const chartBottom = 310;
  const chartTop = 40;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const points = trend
    .map((value, index) => {
      const x = chartLeft + index * (chartWidth / (trend.length - 1));
      const y = chartBottom - (value / maxTrend) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const activity = [
    { title: "Delivery added", note: "New delivery was recorded", time: "10:24 AM", tone: "emerald", icon: "M3 7h11v10H3V7Zm11 4h3l3 3v3h-6v-6Z" },
    { title: "Inventory updated", note: "Stock levels updated", time: "9:15 AM", tone: "blue", icon: iconPaths.warehouse },
    { title: "Sales recorded", note: "New sales entry added", time: "Yesterday", tone: "violet", icon: iconPaths.sales },
    { title: "Expense recorded", note: "New expense entry added", time: "Yesterday", tone: "amber", icon: iconPaths.expenses },
    { title: "User added", note: "New user account created", time: "May 28", tone: "emerald", icon: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-4v6m3-3h-6" },
  ];

  return (
    <section className="w-full space-y-5">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Dashboard Overview</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Live data from Google Sheets.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
              Export Report
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">
              <span className="text-lg leading-none">+</span>
              Add Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {kpis.slice(0, 4).map((item) => (
          <div key={item.title} className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-4">
              <MetricIcon path={item.icon} tone={item.tone} />
              <div><p className="text-sm font-medium text-slate-500">{item.title}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {kpis.slice(4).map((item) => (
          <div key={item.title} className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-4">
              <MetricIcon path={item.icon} tone={item.tone} />
              <div><p className="text-sm font-medium text-slate-500">{item.title}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths.gain} /></svg></span>
              <div><h2 className="text-xl font-semibold tracking-tight text-slate-950">Inventory Trend</h2><p className="mt-1 text-sm text-slate-500">Actual on hand over the last 6 months.</p></div>
            </div>
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm">Last 6 Months</button>
          </div>

          <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-slate-50 to-white px-3 pb-2 pt-4">
            <svg viewBox="0 0 1120 380" className="h-[390px] w-full" role="img" aria-label="Inventory trend chart" preserveAspectRatio="none">
              {[0, 1, 2, 3].map((line) => (
                <line key={line} x1={chartLeft} x2={chartRight} y1={chartTop + line * 72} y2={chartTop + line * 72} stroke="#e2e8f0" strokeDasharray="4 6" />
              ))}
              <polyline points={`${chartLeft},${chartBottom} ${points} ${chartRight},${chartBottom}`} fill="#10b981" fillOpacity="0.08" stroke="none" />
              <polyline points={points} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {trend.map((value, index) => {
                const x = chartLeft + index * (chartWidth / (trend.length - 1));
                const y = chartBottom - (value / maxTrend) * chartHeight;
                return <circle key={index} cx={x} cy={y} r="6" fill="#059669" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />;
              })}
              <g className="text-xs fill-slate-500">
                <text x="18" y="44">20K</text><text x="18" y="116">15K</text><text x="18" y="188">10K</text><text x="24" y="260">5K</text><text x="32" y="314">0</text>
                {['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month, index) => (
                  <text key={month} x={chartLeft - 8 + index * (chartWidth / (trend.length - 1))} y="350">{month}</text>
                ))}
              </g>
              <foreignObject x="790" y="150" width="155" height="90">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl">
                  <p className="font-medium text-slate-500">May 2025</p><p className="mt-1 text-slate-500">Actual On Hand</p><p className="mt-1 font-semibold text-slate-950">{data ? formatNumber(data.actualOnHand) : "..."}</p>
                </div>
              </foreignObject>
            </svg>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Actual On Hand</div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5l3 2" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span><h2 className="text-xl font-semibold tracking-tight text-slate-950">Recent Activity</h2></div>
            <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">View all</button>
          </div>
          <div className="divide-y divide-slate-100">
            {activity.map((item) => (
              <div key={item.title} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><MetricIcon path={item.icon} tone={item.tone as "emerald" | "blue" | "amber" | "violet" | "rose"} /><div className="min-w-0 flex-1"><p className="font-semibold text-slate-950">{item.title}</p><p className="mt-1 truncate text-sm text-slate-500">{item.note}</p></div><p className="whitespace-nowrap text-sm font-medium text-slate-500">{item.time}</p></div>
            ))}
          </div>
        </div>
      </div>

      <p className="pb-2 text-center text-sm text-slate-400">© 2025 Realight Corporation. All rights reserved.</p>
    </section>
  );
}
