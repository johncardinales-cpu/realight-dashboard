"use client";

import { useEffect, useState } from "react";

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

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const kpis = [
    { title: "Incoming Units", value: data ? data.incomingUnits.toLocaleString() : "..." },
    { title: "Warehouse Received", value: data ? data.warehouseReceived.toLocaleString() : "..." },
    { title: "Actual On Hand", value: data ? data.actualOnHand.toLocaleString() : "..." },
    { title: "Sellable Units", value: data ? data.sellableUnits.toLocaleString() : "..." },
    { title: "Total Sales", value: data ? peso(data.totalSales) : "..." },
    { title: "Total Expenses", value: data ? peso(data.totalExpenses) : "..." },
    { title: "Net Gain", value: data ? peso(data.netGain) : "..." },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Dashboard Overview</h1>
            <p className="mt-1 text-sm text-slate-700">
              Live data from Google Sheets.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Export Report
            </button>
            <button className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Add Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">{item.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}