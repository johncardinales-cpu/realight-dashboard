"use client";

import { useEffect, useMemo, useState } from "react";

type ReportMode = "daily" | "weekly" | "monthly";

type ReportData = {
  reportDate: string;
  mode: ReportMode;
  startDate: string;
  endDate: string;
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
  expensesByCategory: Array<{ category: string; amount: number }>;
  dailyTrend: Array<{ date: string; sales: number; collections: number; expenses: number; grossProfit: number; netProfit: number; receivables: number }>;
  productMovement: Array<{ description: string; specification: string; qty: number; confirmedQty: number; totalSalePhp: number; grossProfitPhp: number }>;
  dailySales: Array<{ saleDate: string; salesRefNo: string; customerName: string; totalSalePhp: number; totalPaidPhp: number; balancePhp: number; grossProfitPhp: number; paymentStatus: string; saleStatus: string }>;
  dailyExpenses: Array<{ date: string; category: string; description: string; amount: number; source: string }>;
  openReceivables: Array<{ saleDate: string; salesRefNo: string; customerName: string; totalSalePhp: number; totalPaidPhp: number; balancePhp: number; paymentStatus: string; saleStatus: string }>;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleForMode(mode: ReportMode) {
  if (mode === "weekly") return "Weekly";
  if (mode === "monthly") return "Monthly";
  return "Daily";
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
  const [mode, setMode] = useState<ReportMode>("daily");
  const [data, setData] = useState<ReportData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReport(date: string, selectedMode: ReportMode) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/reports?date=${date}&mode=${selectedMode}`, { cache: "no-store" });
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
    loadReport(reportDate, mode).catch(console.error);
  }, []);

  const summary = data?.summary;
  const collectionMethodTotal = useMemo(() => data?.collectionsByMethod.reduce((sum, item) => sum + item.amount, 0) || 0, [data]);
  const periodTitle = data ? `${titleForMode(data.mode)} Report: ${data.startDate} to ${data.endDate}` : "Reports";

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-1 text-sm text-slate-600">
              Sales use Sale Date. Collections use Payment Date. Inventory will use Confirmed sales only.
            </p>
            {data ? <p className="mt-2 text-sm font-semibold text-slate-800">{periodTitle}</p> : null}
          </div>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); loadReport(reportDate, mode).catch(console.error); }}>
            <select className="rounded-xl border border-slate-300 px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value as ReportMode)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
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
            <StatCard label={`${titleForMode(data!.mode)} Sales`} value={money(summary.totalSalesToday)} helper={`${summary.dailySaleCount} sale transaction(s)`} />
            <StatCard label={`${titleForMode(data!.mode)} Collections`} value={money(summary.collectionsToday)} helper="Initial + follow-up payments" />
            <StatCard label="Gross Profit" value={money(summary.grossProfitToday)} helper="Based on sale date" />
            <StatCard label="Net Profit" value={money(summary.netProfitToday)} helper="Gross profit minus expenses" />
            <StatCard label="Confirmed Sales" value={money(summary.confirmedSalesToday)} helper="Inventory-affecting sales" />
            <StatCard label="Expenses" value={money(summary.expensesToday)} helper="Manual + supplier costs" />
            <StatCard label="New Receivables" value={money(summary.newReceivablesToday)} helper="Balances from period sales" />
            <StatCard label="Ending Receivables" value={money(summary.endingReceivables)} helper="All open balances" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Daily Trend</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales", "Collections", "Expenses", "Gross Profit", "Net Profit", "Receivables"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {data.dailyTrend.map((row) => (
                    <tr key={row.date} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.date}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.sales)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.collections)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.expenses)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.grossProfit)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{money(row.netProfit)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.receivables)}</td>
                    </tr>
                  ))}
                  {!data.dailyTrend.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No activity for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Collections Breakdown</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3 text-left font-medium">Method</th><th className="px-4 py-3 text-left font-medium">Amount</th><th className="px-4 py-3 text-left font-medium">Share</th></tr></thead>
                  <tbody>{data.collectionsByMethod.map((item) => <tr key={item.method} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{item.method}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(item.amount)}</td><td className="px-4 py-3 text-slate-700">{collectionMethodTotal ? `${((item.amount / collectionMethodTotal) * 100).toFixed(1)}%` : "0%"}</td></tr>)}{!data.collectionsByMethod.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No collections for this period.</td></tr>}</tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Expense Breakdown</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3 text-left font-medium">Category</th><th className="px-4 py-3 text-left font-medium">Amount</th></tr></thead>
                  <tbody>{data.expensesByCategory.map((item) => <tr key={item.category} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{item.category}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(item.amount)}</td></tr>)}{!data.expensesByCategory.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">No expenses for this period.</td></tr>}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Product Movement Audit</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr>{["Description", "Specification", "Qty Sold", "Confirmed Qty", "Total Sale", "Gross Profit"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{data.productMovement.map((item) => <tr key={`${item.description}-${item.specification}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{item.description}</td><td className="px-4 py-3 text-slate-700">{item.specification}</td><td className="px-4 py-3 text-slate-700">{item.qty}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.confirmedQty}</td><td className="px-4 py-3 text-slate-700">{money(item.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(item.grossProfitPhp)}</td></tr>)}{!data.productMovement.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No product movement for this period.</td></tr>}</tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Sales Detail</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Total Sale", "Paid", "Balance", "Gross Profit", "Payment", "Sale"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{data.dailySales.map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{sale.saleDate}</td><td className="px-4 py-3 text-slate-700">{sale.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{sale.customerName}</td><td className="px-4 py-3 text-slate-700">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(sale.balancePhp)}</td><td className="px-4 py-3 text-slate-700">{money(sale.grossProfitPhp)}</td><td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td><td className="px-4 py-3"><StatusPill value={sale.saleStatus} /></td></tr>)}{!data.dailySales.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No sales for this period.</td></tr>}</tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-semibold text-slate-900">Open Receivables</h2><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Sales Ref", "Customer", "Total", "Paid", "Balance", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{data.openReceivables.slice(0, 20).map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{sale.saleDate}</td><td className="px-4 py-3 text-slate-700">{sale.salesRefNo}</td><td className="px-4 py-3 text-slate-700">{sale.customerName}</td><td className="px-4 py-3 text-slate-700">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-slate-700">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(sale.balancePhp)}</td><td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td></tr>)}{!data.openReceivables.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No open receivables.</td></tr>}</tbody></table></div></div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-semibold text-slate-900">Expense Detail</h2><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Date", "Category", "Description", "Amount", "Source"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{data.dailyExpenses.map((expense, index) => <tr key={`${expense.source}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{expense.date}</td><td className="px-4 py-3 text-slate-700">{expense.category}</td><td className="px-4 py-3 text-slate-700">{expense.description}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(expense.amount)}</td><td className="px-4 py-3 text-slate-700">{expense.source}</td></tr>)}{!data.dailyExpenses.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No expenses for this period.</td></tr>}</tbody></table></div></div>
          </div>
        </>
      ) : null}
    </section>
  );
}
