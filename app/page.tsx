const recentActivities = [
  { title: "New sale completed", note: "Invoice #INV-2024-0523", time: "2m ago", tone: "emerald", icon: "M6 6h15l-2 8H8L6 6Zm0 0L5 3H3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  { title: "Stock updated", note: "50 items updated", time: "15m ago", tone: "blue", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { title: "Delivery received", note: "From ABC Supplier", time: "1h ago", tone: "violet", icon: "M3 7h11v10H3V7Zm11 4h3l3 3v3h-6v-6Zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  { title: "New customer added", note: "Juan Dela Cruz", time: "2h ago", tone: "amber", icon: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
  { title: "Expense recorded", note: "Office Supplies", time: "3h ago", tone: "emerald", icon: "M12 6v12M8 10h6a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h6" },
];

const kpis = [
  { label: "Total Sales", value: "₱128,430.00", change: "↑ 12.5%", helper: "vs last 7 days", tone: "emerald", icon: "M6 6h15l-2 8H8L6 6Zm0 0L5 3H3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  { label: "Total Orders", value: "245", change: "↑ 8.3%", helper: "vs last 7 days", tone: "blue", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { label: "Total Customers", value: "1,234", change: "↑ 6.7%", helper: "vs last 7 days", tone: "violet", icon: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-6a3 3 0 1 1 0 6" },
  { label: "Low Stock Items", value: "28", change: "↓ 5", helper: "vs yesterday", tone: "orange", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
];

const toneClasses: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  amber: "bg-orange-50 text-orange-600",
};

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
  const chartPoints = "40,170 160,145 280,170 400,120 520,55 640,50 760,165";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Welcome back, Admin! Here's what's happening with your business today.</p>
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
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">This Week⌄</button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white">
            <svg viewBox="0 0 820 310" className="h-[310px] w-full" role="img" aria-label="Sales overview chart">
              <defs>
                <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[60,120,180,240].map((y) => <line key={y} x1="40" x2="780" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />)}
              <text x="0" y="64" className="fill-slate-500 text-xs font-semibold">₱30K</text>
              <text x="0" y="124" className="fill-slate-500 text-xs font-semibold">₱20K</text>
              <text x="0" y="184" className="fill-slate-500 text-xs font-semibold">₱10K</text>
              <text x="0" y="244" className="fill-slate-500 text-xs font-semibold">₱0</text>
              <polygon points={`40,245 ${chartPoints} 760,245`} fill="url(#salesFill)" />
              <polyline points={chartPoints} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {chartPoints.split(" ").map((point, index) => { const [x, y] = point.split(","); return <circle key={index} cx={x} cy={y} r="6" fill="#059669" stroke="white" strokeWidth="3" />; })}
              {[
                [60, "Mon"], [180, "Tue"], [300, "Wed"], [420, "Thu"], [540, "Fri"], [660, "Sat"], [760, "Sun"],
              ].map(([x, label]) => <text key={label} x={x} y="285" textAnchor="middle" className="fill-slate-500 text-xs font-semibold">{label}</text>)}
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200">
            <div className="px-4 first:pl-0"><p className="text-lg font-bold text-slate-950">₱128,430.00</p><p className="text-sm text-slate-500">Total Sales</p></div>
            <div className="px-4"><p className="text-lg font-bold text-slate-950">₱18,347.14</p><p className="text-sm text-slate-500">Daily Average</p></div>
            <div className="px-4"><p className="text-lg font-bold text-emerald-600">12.5%</p><p className="text-sm text-slate-500">↑ vs Last Week</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Recent Activities</h2>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View All</button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.map((item) => (
              <div key={item.title} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${toneClasses[item.tone] || toneClasses.emerald}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.note}</p>
                </div>
                <p className="text-sm text-slate-500">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Inventory Summary</h2>
          <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4 md:divide-x md:divide-slate-200">
            <div><p className="text-sm text-slate-500">Total Items</p><p className="mt-2 text-2xl font-bold text-slate-950">1,245</p><p className="text-sm text-slate-500">All items in inventory</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">In Stock</p><p className="mt-2 text-2xl font-bold text-emerald-600">987</p><p className="text-sm text-slate-500">Items available</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">Low Stock</p><p className="mt-2 text-2xl font-bold text-orange-600">28</p><p className="text-sm text-slate-500">Need attention</p></div>
            <div className="md:pl-6"><p className="text-sm text-slate-500">Out of Stock</p><p className="mt-2 text-2xl font-bold text-rose-600">15</p><p className="text-sm text-slate-500">Restock required</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Top Selling Products</h2>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">View Report</button>
          </div>
          <div className="space-y-4">
            {[["LED Bulb 9W", "432 sold"], ["Electrical Wire 2mm", "312 sold"], ["Circuit Breaker 20A", "256 sold"]].map(([name, sold], index) => (
              <div key={name} className="flex items-center gap-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{index + 1}</span>
                <p className="min-w-0 flex-1 font-bold text-slate-950">{name}</p>
                <p className="text-sm font-semibold text-slate-500">{sold}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
