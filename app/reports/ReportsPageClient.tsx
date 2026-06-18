"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type Mode = "daily" | "weekly" | "monthly";
type CollectionDetail = {
  id: string;
  date: string;
  saleDate: string;
  salesRefNo: string;
  customerName: string;
  method: string;
  amount: number;
  transactionRef: string;
  cashierName: string;
  collectionType: string;
};
type ReportData = {
  mode: Mode;
  startDate: string;
  endDate: string;
  summary: {
    totalSalesToday: number;
    confirmedSalesToday: number;
    grossProfitToday: number;
    expensesToday: number;
    netProfitToday: number;
    collectionsToday: number;
    currentPeriodSaleCollectionsToday?: number;
    priorReceivableCollectionsToday?: number;
    unclassifiedCollectionsToday?: number;
    cashReceivedToday?: number;
    changeGivenToday?: number;
    netCashAfterChangeToday?: number;
    newReceivablesToday: number;
    endingReceivables: number;
    dailySaleCount: number;
    productSubtotalPhp?: number;
    deliveryFeePhp?: number;
    installationFeePhp?: number;
    otherChargePhp?: number;
    discountPhp?: number;
    taxAmountPhp?: number;
  };
  accountingBreakdown?: {
    productSubtotalPhp: number;
    deliveryFeePhp: number;
    installationFeePhp: number;
    otherChargePhp: number;
    discountPhp: number;
    taxAmountPhp: number;
    grandTotalPhp: number;
  };
  collectionTiming?: {
    currentPeriodSaleCollectionsPhp: number;
    priorReceivableCollectionsPhp: number;
    unclassifiedCollectionsPhp: number;
  };
  collectionDetails?: CollectionDetail[];
  collectionsByMethod: Array<{ method: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  dailyTrend: Array<{
    date: string;
    sales: number;
    collections: number;
    cashReceived?: number;
    changeGiven?: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    receivables: number;
  }>;
  productMovement: Array<{
    description: string;
    specification: string;
    qty: number;
    confirmedQty: number;
    totalSalePhp: number;
    grossProfitPhp: number;
  }>;
  dailySales: Array<{
    saleDate: string;
    salesRefNo: string;
    customerName: string;
    productSubtotalPhp?: number;
    deliveryFeePhp?: number;
    installationFeePhp?: number;
    otherChargePhp?: number;
    discountPhp?: number;
    taxAmountPhp?: number;
    totalSalePhp: number;
    totalPaidPhp: number;
    tenderedAmountPhp?: number;
    changeDuePhp?: number;
    balancePhp: number;
    grossProfitPhp: number;
    paymentStatus: string;
    saleStatus: string;
  }>;
  dailyExpenses: Array<{ date: string; category: string; description: string; amount: number; source: string }>;
  openReceivables: Array<{
    saleDate: string;
    salesRefNo: string;
    customerName: string;
    totalSalePhp: number;
    totalPaidPhp: number;
    balancePhp: number;
    paymentStatus: string;
  }>;
};

type PaymentSummary = {
  saleDate: string;
  salesRefNo: string;
  customerName: string;
  totalSalePhp: number;
  totalPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
};

const money = (value: number) => `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const title = (mode: Mode) => (mode === "weekly" ? "Weekly" : mode === "monthly" ? "Monthly" : "Daily");
const inactive = (value: string) => ["voided", "cancelled", "canceled"].includes(String(value || "").toLowerCase());
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const inPeriod = (date: string, start: string, end: string) => date >= start && date <= end;

function Card({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{money(value)}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function Pill({ value }: { value: string }) {
  const normalized = String(value || "").toLowerCase();
  const color = normalized === "paid" || normalized === "confirmed" ? "bg-emerald-50 text-emerald-700" : normalized === "partial" || normalized.includes("receivable") ? "bg-amber-50 text-amber-700" : normalized === "cancelled" || normalized === "canceled" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{value}</span>;
}

function Section({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AuditRow({ label, amount, helper, strong = false }: { label: string; amount: number; helper: string; strong?: boolean }) {
  return (
    <tr className="border-t border-slate-100">
      <td className={`px-4 py-3 ${strong ? "font-bold" : ""}`}>{label}</td>
      <td className={`px-4 py-3 text-right ${strong ? "font-bold" : "font-semibold"}`}>{money(amount)}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{helper}</td>
    </tr>
  );
}

export default function ReportsPageClient() {
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<Mode>("daily");
  const [data, setData] = useState<ReportData | null>(null);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReport(nextDate = date, nextMode = mode) {
    setLoading(true);
    setMessage("");
    try {
      const [reportRes, paymentRes] = await Promise.all([
        fetch(`/api/reports?date=${nextDate}&mode=${nextMode}&t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const reportJson = await reportRes.json();
      const paymentJson = await paymentRes.json();
      if (!reportRes.ok) throw new Error(reportJson?.error || "Failed to load report");
      if (!paymentRes.ok) throw new Error(paymentJson?.error || "Failed to load payments");
      setData(reportJson);
      setPayments(Array.isArray(paymentJson) ? paymentJson : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport().catch(console.error); }, []);

  const openReceivables = useMemo(() => data ? payments.filter((p) => !inactive(p.saleStatus) && Number(p.balancePhp || 0) > 0 && inPeriod(p.saleDate, data.startDate, data.endDate)) : [], [payments, data]);
  const summary = data?.summary;
  const breakdown = data?.accountingBreakdown;
  const productSales = breakdown?.productSubtotalPhp ?? summary?.productSubtotalPhp ?? 0;
  const delivery = breakdown?.deliveryFeePhp ?? summary?.deliveryFeePhp ?? 0;
  const install = breakdown?.installationFeePhp ?? summary?.installationFeePhp ?? 0;
  const other = breakdown?.otherChargePhp ?? summary?.otherChargePhp ?? 0;
  const discount = breakdown?.discountPhp ?? summary?.discountPhp ?? 0;
  const tax = breakdown?.taxAmountPhp ?? summary?.taxAmountPhp ?? 0;
  const charges = round(delivery + install + other);
  const currentCollections = summary?.currentPeriodSaleCollectionsToday ?? data?.collectionTiming?.currentPeriodSaleCollectionsPhp ?? Math.min(summary?.collectionsToday || 0, summary?.totalSalesToday || 0);
  const priorCollections = summary?.priorReceivableCollectionsToday ?? data?.collectionTiming?.priorReceivableCollectionsPhp ?? Math.max((summary?.collectionsToday || 0) - (summary?.totalSalesToday || 0), 0);
  const unknownCollections = summary?.unclassifiedCollectionsToday ?? data?.collectionTiming?.unclassifiedCollectionsPhp ?? 0;
  const collectionTotal = data?.collectionsByMethod.reduce((sum, item) => sum + item.amount, 0) || 0;
  const collectionDetails = data?.collectionDetails || [];

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h1 className="text-3xl font-semibold text-slate-900">Reports</h1><p className="mt-1 text-sm text-slate-600">Sales use Sale Date. Collections from prior receivables are separated for audit.</p>{data ? <p className="mt-2 text-sm font-semibold text-slate-800">{title(data.mode)} Report: {data.startDate} to {data.endDate}</p> : null}</div>
        <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); loadReport().catch(console.error); }}><select className="rounded-xl border border-slate-300 px-3 py-2" value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white" disabled={loading}>{loading ? "Loading..." : "Load Report"}</button></form>
      </div>
      {message ? <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
    </div>

    {summary ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Card label={`${title(mode)} Sales`} value={summary.totalSalesToday} helper={`${summary.dailySaleCount} sale transaction(s)`} /><Card label="Customer Charges Subtotal" value={charges} helper="Delivery + installation + other" /><Card label={`${title(mode)} Collections`} value={summary.collectionsToday} helper="Current sales + prior receivables" /><Card label="From Prior Receivables" value={priorCollections} helper="Payments collected for older balances" /><Card label="Current Sale Collections" value={currentCollections} helper="Collected for sales in this period" /><Card label="Cash Received" value={summary.cashReceivedToday || summary.collectionsToday} helper="Total tendered before change" /><Card label="Change Given" value={summary.changeGivenToday || 0} helper="Returned to customers" /><Card label="Net Cash After Change" value={summary.netCashAfterChangeToday || summary.collectionsToday} helper="Cash received minus change" /><Card label="Gross Profit" value={summary.grossProfitToday} helper="Based on sale date" /><Card label="Net Profit" value={summary.netProfitToday} helper="Gross profit minus expenses" /><Card label="Confirmed Sales" value={summary.confirmedSalesToday} helper="Inventory-affecting sales" /><Card label="Expenses" value={summary.expensesToday} helper="Manual + supplier costs" /><Card label="New Receivables" value={summary.newReceivablesToday} helper="Open balances from period sales" /><Card label="Ending Receivables" value={summary.endingReceivables} helper="All open balances from Payments" /></div> : null}

    <Section title="Collections Timing Audit" helper="This explains why collections can be higher than sales: the period may include payments for older receivables."><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Collection Type</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Audit Meaning</th></tr></thead><tbody><AuditRow label="Collections from Current Period Sales" amount={currentCollections} helper="Cash/payment applied to sales whose Sale Date is inside the selected period." /><AuditRow label="Collections from Prior Receivables" amount={priorCollections} helper="Cash/payment collected this period for sales created before the selected period." />{unknownCollections > 0 ? <AuditRow label="Unclassified Collections" amount={unknownCollections} helper="Collection could not be linked to a sale date; review payment history." /> : null}<AuditRow label="Total Collections" amount={summary?.collectionsToday || 0} helper="Current-period sale collections + prior receivable collections." strong /></tbody></table></div></Section>

    <Section title="Sales Breakdown / Customer Charges" helper="Delivery, installation, and other customer charges are revenue charges, not inventory movement and not company expenses."><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Line</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Audit Meaning</th></tr></thead><tbody><AuditRow label="Product Sales" amount={productSales} helper="Products/items only before customer charges" /><AuditRow label="Customer Charges Subtotal" amount={charges} helper="Subtotal of delivery + installation + other charges billed to customer" strong /><AuditRow label="- Delivery Fee" amount={delivery} helper="Included inside Customer Charges Subtotal" /><AuditRow label="- Installation Fee" amount={install} helper="Included inside Customer Charges Subtotal" /><AuditRow label="- Other Charge" amount={other} helper="Included inside Customer Charges Subtotal" /><AuditRow label="Discount" amount={discount} helper="Deduction given to customer" /><AuditRow label="Tax" amount={tax} helper="Tax or VAT charged to customer" /><AuditRow label="Grand Total Sales" amount={summary?.totalSalesToday || 0} helper="Product sales + customer charges subtotal - discount + tax" strong /></tbody></table></div></Section>

    <Section title="Daily Trend"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Collections</th><th className="px-4 py-3 text-right">Cash Received</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Expenses</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3 text-right">Net Profit</th><th className="px-4 py-3 text-right">Receivables</th></tr></thead><tbody>{data?.dailyTrend.length ? data.dailyTrend.map((row) => <tr key={row.date} className="border-t border-slate-100"><td className="px-4 py-3">{row.date}</td><td className="px-4 py-3 text-right">{money(row.sales)}</td><td className="px-4 py-3 text-right">{money(row.collections)}</td><td className="px-4 py-3 text-right">{money(row.cashReceived ?? row.collections)}</td><td className="px-4 py-3 text-right">{money(row.changeGiven || 0)}</td><td className="px-4 py-3 text-right">{money(row.expenses)}</td><td className="px-4 py-3 text-right">{money(row.grossProfit)}</td><td className="px-4 py-3 text-right font-bold">{money(row.netProfit)}</td><td className="px-4 py-3 text-right">{money(row.receivables)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No activity for this period.</td></tr>}</tbody></table></div></Section>

    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Collections Breakdown" helper="Collection totals by method. Linked orders are inside a scroll box.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Share</th></tr></thead><tbody>{data?.collectionsByMethod.length ? data.collectionsByMethod.map((item) => <tr key={item.method} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{item.method}</td><td className="px-4 py-3 text-right font-semibold">{money(item.amount)}</td><td className="px-4 py-3 text-right">{collectionTotal ? `${((item.amount / collectionTotal) * 100).toFixed(1)}%` : "0.0%"}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={3}>No collections for this period.</td></tr>}</tbody></table></div>
        {collectionDetails.length ? <div className="mt-4 rounded-2xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2"><p className="text-xs font-bold text-slate-600">Linked Payments</p><p className="text-xs text-slate-500">{collectionDetails.length} record(s)</p></div><div className="max-h-72 overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Order / Customer</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Method</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Ref</th></tr></thead><tbody>{collectionDetails.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.date}</td><td className="px-3 py-2"><span className="font-semibold text-slate-800">{item.salesRefNo}</span><p className="text-slate-500">{item.customerName}</p></td><td className="px-3 py-2"><Pill value={item.collectionType} /></td><td className="px-3 py-2">{item.method}</td><td className="px-3 py-2 text-right font-bold">{money(item.amount)}</td><td className="px-3 py-2 text-slate-500">{item.transactionRef || "-"}</td></tr>)}</tbody></table></div></div> : null}
      </Section>
      <Section title="Expense Breakdown"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{data?.expensesByCategory.length ? data.expensesByCategory.map((item) => <tr key={item.category} className="border-t border-slate-100"><td className="px-4 py-3">{item.category}</td><td className="px-4 py-3 text-right font-semibold">{money(item.amount)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={2}>No expenses for this period.</td></tr>}</tbody></table></div></Section>
    </div>

    <Section title="Product Movement Audit" helper="Inventory movement uses product lines only. Customer charges are audited separately above."><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Specification</th><th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Confirmed Qty</th><th className="px-4 py-3 text-right">Item Sale</th><th className="px-4 py-3 text-right">Gross Profit</th></tr></thead><tbody>{data?.productMovement.length ? data.productMovement.map((item) => <tr key={`${item.description}-${item.specification}`} className="border-t border-slate-100"><td className="px-4 py-3">{item.description}</td><td className="px-4 py-3">{item.specification}</td><td className="px-4 py-3 text-right">{item.qty}</td><td className="px-4 py-3 text-right font-bold">{item.confirmedQty}</td><td className="px-4 py-3 text-right">{money(item.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(item.grossProfitPhp)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No product movement for this period.</td></tr>}</tbody></table></div></Section>

    <Section title="Sales Detail"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sales Ref</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Grand Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Cash Received</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Sale</th></tr></thead><tbody>{data?.dailySales.length ? data.dailySales.map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}-${sale.totalSalePhp}`} className="border-t border-slate-100"><td className="px-4 py-3">{sale.saleDate}</td><td className="px-4 py-3">{sale.salesRefNo}</td><td className="px-4 py-3">{sale.customerName}</td><td className="px-4 py-3 text-right font-bold">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.tenderedAmountPhp || sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.balancePhp)}</td><td className="px-4 py-3 text-right">{money(sale.grossProfitPhp)}</td><td className="px-4 py-3"><Pill value={sale.paymentStatus} /></td><td className="px-4 py-3"><Pill value={sale.saleStatus} /></td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={10}>No sales for this period.</td></tr>}</tbody></table></div></Section>

    <div className="grid gap-6 xl:grid-cols-2"><Section title="Open Receivables"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sales Ref</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{openReceivables.length ? openReceivables.map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100"><td className="px-4 py-3">{sale.saleDate}</td><td className="px-4 py-3">{sale.salesRefNo}</td><td className="px-4 py-3">{sale.customerName}</td><td className="px-4 py-3 text-right">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.balancePhp)}</td><td className="px-4 py-3"><Pill value={sale.paymentStatus} /></td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={7}>No open receivables.</td></tr>}</tbody></table></div></Section><Section title="Expense Detail"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{data?.dailyExpenses.length ? data.dailyExpenses.map((expense) => <tr key={`${expense.date}-${expense.category}-${expense.description}`} className="border-t border-slate-100"><td className="px-4 py-3">{expense.date}</td><td className="px-4 py-3">{expense.category}</td><td className="px-4 py-3">{expense.description}</td><td className="px-4 py-3 text-right font-bold">{money(expense.amount)}</td><td className="px-4 py-3">{expense.source}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No expenses for this period.</td></tr>}</tbody></table></div></Section></div>
  </section>;
}
