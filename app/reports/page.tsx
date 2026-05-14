"use client";

import { useEffect, useMemo, useState } from "react";

type ReportData = {
  reportDate: string;
  summary: {
    totalSalesToday: number;
    confirmedSalesToday: number;
    grossProfitToday: number;
    expensesToday: number;
    netProfitToday: number;
    initialCollectionsToday: number;
    followUpCollectionsToday: number;
    collectionsToday: number;
    newReceivablesToday: number;
    endingReceivables: number;
    dailySaleCount: number;
    paymentStatusCounts: Record<string, number>;
  };
  collectionsByMethod: Array<{ method: string; amount: number }>;
  dailySales: Array<{
    saleDate: string;
    salesRefNo: string;
    customerName: string;
    totalSalePhp: number;
    totalPaidPhp: number;
    balancePhp: number;
    grossProfitPhp: number;
    paymentStatus: string;
    saleStatus: string;
  }>;
  dailyExpenses: Array<{
    date: string;
    category: string;
    description: string;
    amount: number;
    source: string;
  }>;
  openReceivables: Array<{
    saleDate: string;
    salesRefNo: string;
    customerName: string;
    totalSalePhp: number;
    totalPaidPhp: number;
    balancePhp: number;
    paymentStatus: string;
    saleStatus: string;
  }>;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized === "paid" || normalized === "confirmed"
    ? "bg-emerald-50 text-emerald-700"
    : normalized === "partial"
      ? "bg-amber-50 text-amber-700"
      : normalized === "cancelled"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

export default function ReportsPage() {
  const [reportDate, setReportDate] = useState(today());
  const [data, setData] = useState<ReportData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReport(date: string) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/reports?date=${date}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load report");
      setData(json);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(reportDate).catch(console.error);
  }, []);

  const summary = data?.summary;
  const collectionMethodTotal = useMemo(
    () => data?.collectionsByMethod.reduce((sum, item) => sum + item.amount, 0) || 0,
    [data]
  );

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-1 text-sm text-slate-600">
              Sales are reported by Sale Date. Collections are reported by Payment Date to avoid double-counting partial payments.
            </p>
          </div>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              loadReport(reportDate).catch(console.error);
            }}
          >
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            <button type="submit" disabled={loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {loading ? "Loading..." : "Load Report"}
            </button>
          </form>
        </div>
        {message ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sales Today" value={money(summary.totalSalesToday)} helper={`${summary.dailySaleCount} sale transaction(s)`} />
            <StatCard label="Collections Today" value={money(summary.collectionsToday)} helper="Initial + follow-up payments" />
            <StatCard label="Gross Profit Today" value={money(summary.grossProfitToday)} helper="Based on sale date" />
            <StatCard label="Net Profit Today" value={money(summary.netProfitToday)} helper="Gross profit minus expenses" />
            <StatCard label="Confirmed Sales" value={money(summary.confirmedSalesToday)} helper="Inventory-affecting sales" />
            <StatCard label="Expenses Today" value={money(summary.expensesToday)} helper="Manual + supplier costs" />
            <StatCard label="New Receivables" value={money(summary.newReceivablesToday)} helper="Balance from today's sales" />
            <StatCard label="Ending Receivables" value={money(summary.endingReceivables)} helper="All open balances" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Collections Breakdown</h2>
              <p className="mt-1 text-sm text-slate-600">Cash collection by payment method for the selected date.</p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Method</th>
                      <th className="px-4 py-3 text-left font-medium">Amount</th>
                      <th className="px-4 py-3 text-left font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.collectionsByMethod.map((item) => (
                      <tr key={item.method} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{item.method}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{money(item.amount)}</td>
                        <td className="px-4 py-3 text-slate-700">{collectionMethodTotal ? `${((item.amount / collectionMethodTotal) * 100).toFixed(1)}%` : "0%"}</td>
                      </tr>
                    ))}
                    {!data?.collectionsByMethod.length && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No collections for this date.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Payment Status Summary</h2>
              <p className="mt-1 text-sm text-slate-600">Counts from sales created on the selected date.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {Object.entries(summary.paymentStatusCounts || {}).map(([status, count]) => (
                  <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <StatusPill value={status} />
                    <p className="mt-3 text-2xl font-bold text-slate-950">{count}</p>
                  </div>
                ))}
                {!Object.keys(summary.paymentStatusCounts || {}).length && (
                  <p className="text-sm text-slate-500">No sales for this date.</p>
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p><span className="font-semibold">Initial collections:</span> {money(summary.initialCollectionsToday)}</p>
                <p><span className="font-semibold">Follow-up collections:</span> {money(summary.followUpCollectionsToday)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Daily Sales</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    {["Sales Ref", "Customer", "Total Sale", "Paid", "Balance", "Gross Profit", "Payment", "Sale"].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.dailySales.map((sale) => (
                    <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{sale.salesRefNo}</td>
                      <td className="px-4 py-3 text-slate-700">{sale.customerName}</td>
                      <td className="px-4 py-3 text-slate-700">{money(sale.totalSalePhp)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(sale.totalPaidPhp)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{money(sale.balancePhp)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(sale.grossProfitPhp)}</td>
                      <td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={sale.saleStatus} /></td>
                    </tr>
                  ))}
                  {!data.dailySales.length && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No sales for this date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Open Receivables</h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {["Date", "Sales Ref", "Customer", "Total", "Paid", "Balance", "Status"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.openReceivables.slice(0, 10).map((sale) => (
                      <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{sale.saleDate}</td>
                        <td className="px-4 py-3 text-slate-700">{sale.salesRefNo}</td>
                        <td className="px-4 py-3 text-slate-700">{sale.customerName}</td>
                        <td className="px-4 py-3 text-slate-700">{money(sale.totalSalePhp)}</td>
                        <td className="px-4 py-3 text-slate-700">{money(sale.totalPaidPhp)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{money(sale.balancePhp)}</td>
                        <td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td>
                      </tr>
                    ))}
                    {!data.openReceivables.length && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No open receivables.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Daily Expenses</h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {["Category", "Description", "Amount", "Source"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-medium whitespace-nowrap">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyExpenses.map((expense, index) => (
                      <tr key={`${expense.source}-${index}`} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{expense.category}</td>
                        <td className="px-4 py-3 text-slate-700">{expense.description}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{money(expense.amount)}</td>
                        <td className="px-4 py-3 text-slate-700">{expense.source}</td>
                      </tr>
                    ))}
                    {!data.dailyExpenses.length && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No expenses for this date.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
