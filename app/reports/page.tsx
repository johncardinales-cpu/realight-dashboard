"use client";

import { useEffect, useMemo, useState } from "react";

type ReportMode = "daily" | "weekly" | "monthly";

type MoneyBreakdown = {
  productSubtotalPhp: number;
  deliveryFeePhp: number;
  installationFeePhp: number;
  otherChargePhp: number;
  discountPhp: number;
  taxAmountPhp: number;
  grandTotalPhp: number;
  grossProfitPhp?: number;
  linkedExpensesPhp?: number;
  totalExpensesPhp?: number;
  netProfitPhp?: number;
};

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
    cashReceivedToday?: number;
    changeGivenToday?: number;
    netCashAfterChangeToday?: number;
    newReceivablesToday: number;
    endingReceivables: number;
    dailySaleCount: number;
    paymentStatusCounts: Record<string, number>;
    productSubtotalPhp?: number;
    deliveryFeePhp?: number;
    installationFeePhp?: number;
    otherChargePhp?: number;
    discountPhp?: number;
    taxAmountPhp?: number;
    grandTotalPhp?: number;
  };
  accountingBreakdown?: MoneyBreakdown;
  collectionsByMethod: Array<{ method: string; amount: number }>;
  cashByMethod?: Array<{ method: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  dailyTrend: Array<{ date: string; sales: number; collections: number; cashReceived?: number; changeGiven?: number; expenses: number; grossProfit: number; netProfit: number; receivables: number }>;
  productMovement: Array<{ description: string; specification: string; qty: number; confirmedQty: number; totalSalePhp: number; grossProfitPhp: number }>;
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
    netCollectionPhp?: number;
    balancePhp: number;
    grossProfitPhp: number;
    paymentStatus: string;
    saleStatus: string;
  }>;
  dailyExpenses: Array<{ date: string; category: string; description: string; amount: number; source: string }>;
  openReceivables: Array<{ saleDate: string; salesRefNo: string; customerName: string; totalSalePhp: number; totalPaidPhp: number; tenderedAmountPhp?: number; changeDuePhp?: number; balancePhp: number; paymentStatus: string; saleStatus: string }>;
};

type PaymentSummary = {
  key: string;
  saleId?: string;
  saleDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  totalSalePhp: number;
  totalPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
};

function money(value: number) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleForMode(mode: ReportMode) {
  return mode === "weekly" ? "Weekly" : mode === "monthly" ? "Monthly" : "Daily";
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function norm(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function inactive(value: unknown) {
  return ["voided", "cancelled", "canceled"].includes(norm(value));
}

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function approx(a: number, b: number) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.05;
}

function payStatus(paid: number, total: number) {
  if ((Number(total) || 0) <= 0 || (Number(paid) || 0) <= 0) return "Pending";
  return paid + 0.009 >= total ? "Paid" : "Partial";
}

function inPeriod(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function findPaymentForSale(payments: PaymentSummary[], sale: ReportData["dailySales"][number]) {
  return payments.find((p) => !inactive(p.saleStatus) && norm(p.salesRefNo) === norm(sale.salesRefNo) && norm(p.customerName) === norm(sale.customerName) && approx(p.totalSalePhp, sale.totalSalePhp))
    || payments.find((p) => !inactive(p.saleStatus) && norm(p.salesRefNo) === norm(sale.salesRefNo) && norm(p.customerName) === norm(sale.customerName));
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

function BreakdownRow({ label, value, helper, strong = false }: { label: string; value: number; helper?: string; strong?: boolean }) {
  return (
    <tr className="border-t border-slate-100">
      <td className={`px-4 py-3 ${strong ? "font-bold text-slate-950" : "text-slate-700"}`}>{label}</td>
      <td className={`px-4 py-3 text-right ${strong ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>{money(value)}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{helper || ""}</td>
    </tr>
  );
}

function SectionCard({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [reportDate, setReportDate] = useState(today());
  const [mode, setMode] = useState<ReportMode>("daily");
  const [data, setData] = useState<ReportData | null>(null);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReport(date: string, selectedMode: ReportMode) {
    setLoading(true);
    setMessage("");
    try {
      const [reportRes, paymentRes] = await Promise.all([
        fetch(`/api/reports?date=${date}&mode=${selectedMode}&t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/payments?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const reportJson = await reportRes.json();
      const paymentJson = await paymentRes.json();
      if (!reportRes.ok) throw new Error(reportJson?.error || "Failed to load report");
      if (!paymentRes.ok) throw new Error(paymentJson?.error || "Failed to load reconciled payments");
      setData(reportJson);
      setPayments(Array.isArray(paymentJson) ? paymentJson : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(reportDate, mode).catch(console.error);
  }, []);

  const reconciledSales = useMemo(() => {
    if (!data) return [];
    return data.dailySales.map((sale) => {
      const payment = findPaymentForSale(payments, sale);
      if (!payment) return sale;
      const totalPaidPhp = round(payment.totalPaidPhp);
      const balancePhp = round(payment.balancePhp);
      return {
        ...sale,
        totalPaidPhp,
        balancePhp,
        tenderedAmountPhp: totalPaidPhp,
        netCollectionPhp: totalPaidPhp,
        paymentStatus: payStatus(totalPaidPhp, payment.totalSalePhp || sale.totalSalePhp),
        saleStatus: payment.saleStatus || sale.saleStatus,
      };
    });
  }, [data, payments]);

  const reconciledOpenReceivables = useMemo(() => payments
    .filter((p) => !inactive(p.saleStatus) && Number(p.balancePhp || 0) > 0)
    .map((p) => ({
      saleDate: p.saleDate,
      salesRefNo: p.salesRefNo,
      customerName: p.customerName,
      totalSalePhp: p.totalSalePhp,
      totalPaidPhp: p.totalPaidPhp,
      tenderedAmountPhp: p.totalPaidPhp,
      changeDuePhp: 0,
      balancePhp: p.balancePhp,
      paymentStatus: p.paymentStatus || payStatus(p.totalPaidPhp, p.totalSalePhp),
      saleStatus: p.saleStatus,
    }))
    .sort((a, b) => b.balancePhp - a.balancePhp), [payments]);

  const periodOpenReceivables = useMemo(() => data ? reconciledOpenReceivables.filter((r) => inPeriod(r.saleDate, data.startDate, data.endDate)) : [], [data, reconciledOpenReceivables]);
  const reconciledTrend = useMemo(() => data ? data.dailyTrend.map((row) => ({ ...row, receivables: round(reconciledSales.filter((sale) => sale.saleDate === row.date).reduce((sum, sale) => sum + (sale.balancePhp || 0), 0)) })) : [], [data, reconciledSales]);
  const reconciledSummary = useMemo(() => data ? { ...data.summary, newReceivablesToday: round(periodOpenReceivables.reduce((sum, sale) => sum + (sale.balancePhp || 0), 0)), endingReceivables: round(reconciledOpenReceivables.reduce((sum, sale) => sum + (sale.balancePhp || 0), 0)) } : null, [data, periodOpenReceivables, reconciledOpenReceivables]);

  const summary = reconciledSummary;
  const breakdown = data?.accountingBreakdown;
  const periodTitle = data ? `${titleForMode(data.mode)} Report: ${data.startDate} to ${data.endDate}` : "Reports";
  const collectionMethodTotal = useMemo(() => data?.collectionsByMethod.reduce((sum, item) => sum + item.amount, 0) || 0, [data]);
  const customerCharges = round((breakdown?.deliveryFeePhp || 0) + (breakdown?.installationFeePhp || 0) + (breakdown?.otherChargePhp || 0));
  const productSales = breakdown?.productSubtotalPhp ?? summary?.productSubtotalPhp ?? 0;
  const deliveryFee = breakdown?.deliveryFeePhp ?? summary?.deliveryFeePhp ?? 0;
  const installationFee = breakdown?.installationFeePhp ?? summary?.installationFeePhp ?? 0;
  const otherCharge = breakdown?.otherChargePhp ?? summary?.otherChargePhp ?? 0;
  const discount = breakdown?.discountPhp ?? summary?.discountPhp ?? 0;
  const tax = breakdown?.taxAmountPhp ?? summary?.taxAmountPhp ?? 0;
  const grandTotal = summary?.totalSalesToday ?? breakdown?.grandTotalPhp ?? 0;

  const customerChargeAuditRows = [
    { line: "Delivery Fee", amount: deliveryFee, meaning: "Customer-billed delivery revenue. Included in Grand Total Sales. Not product movement and not company expense." },
    { line: "Installation Fee", amount: installationFee, meaning: "Customer-billed installation/service revenue. Included in Grand Total Sales when charged." },
    { line: "Other Customer Charge", amount: otherCharge, meaning: "Other customer-billed revenue. Included in Grand Total Sales when charged." },
    { line: "Total Customer Charges", amount: customerCharges, meaning: "Delivery + installation + other charges billed to customer." },
  ];

  function exportSummary() {
    if (!data || !summary) return;
    downloadCsv(`realights-${data.mode}-summary-${data.startDate}-to-${data.endDate}.csv`, [
      ["Report Mode", data.mode],
      ["Start Date", data.startDate],
      ["End Date", data.endDate],
      ["Product Sales", productSales],
      ["Customer Delivery Fee", deliveryFee],
      ["Customer Installation Fee", installationFee],
      ["Other Customer Charges", otherCharge],
      ["Discount", discount],
      ["Tax", tax],
      ["Grand Total Sales", summary.totalSalesToday],
      ["Confirmed Sales", summary.confirmedSalesToday],
      ["Collections / Applied Payment", summary.collectionsToday],
      ["Cash Received / Tendered", summary.cashReceivedToday || summary.collectionsToday],
      ["Change Given", summary.changeGivenToday || 0],
      ["Net Cash After Change", summary.netCashAfterChangeToday || summary.collectionsToday],
      ["Gross Profit", summary.grossProfitToday],
      ["Expenses", summary.expensesToday],
      ["Net Profit", summary.netProfitToday],
      ["New Receivables", summary.newReceivablesToday],
      ["Ending Receivables", summary.endingReceivables],
      ["Sale Count", summary.dailySaleCount],
    ]);
  }

  function exportSales() {
    if (!data) return;
    downloadCsv(`realights-${data.mode}-sales-${data.startDate}-to-${data.endDate}.csv`, [
      ["Date", "Sales Ref", "Customer", "Product Sales", "Delivery Fee", "Installation Fee", "Other Charge", "Discount", "Tax", "Grand Total", "Paid / Applied", "Cash Received", "Change Given", "Net Cash After Change", "Balance", "Gross Profit", "Payment Status", "Sale Status"],
      ...reconciledSales.map((sale) => [sale.saleDate, sale.salesRefNo, sale.customerName, sale.productSubtotalPhp || 0, sale.deliveryFeePhp || 0, sale.installationFeePhp || 0, sale.otherChargePhp || 0, sale.discountPhp || 0, sale.taxAmountPhp || 0, sale.totalSalePhp, sale.totalPaidPhp, sale.tenderedAmountPhp || sale.totalPaidPhp, sale.changeDuePhp || 0, sale.netCollectionPhp || sale.totalPaidPhp, sale.balancePhp, sale.grossProfitPhp, sale.paymentStatus, sale.saleStatus]),
    ]);
  }

  function exportCollections() {
    if (!data) return;
    downloadCsv(`realights-${data.mode}-collections-${data.startDate}-to-${data.endDate}.csv`, [["Method", "Applied Collection"], ...data.collectionsByMethod.map((item) => [item.method, item.amount])]);
  }

  function exportReceivables() {
    if (!data) return;
    downloadCsv(`realights-open-receivables-${data.startDate}-to-${data.endDate}.csv`, [
      ["Date", "Sales Ref", "Customer", "Total Sale", "Paid", "Cash Received", "Change Given", "Balance", "Payment Status", "Sale Status"],
      ...reconciledOpenReceivables.map((sale) => [sale.saleDate, sale.salesRefNo, sale.customerName, sale.totalSalePhp, sale.totalPaidPhp, sale.tenderedAmountPhp || sale.totalPaidPhp, sale.changeDuePhp || 0, sale.balancePhp, sale.paymentStatus, sale.saleStatus]),
    ]);
  }

  function exportExpenses() {
    if (!data) return;
    downloadCsv(`realights-${data.mode}-expenses-${data.startDate}-to-${data.endDate}.csv`, [["Date", "Category", "Description", "Amount", "Source"], ...data.dailyExpenses.map((expense) => [expense.date, expense.category, expense.description, expense.amount, expense.source])]);
  }

  function exportProductMovement() {
    if (!data) return;
    downloadCsv(`realights-${data.mode}-product-movement-${data.startDate}-to-${data.endDate}.csv`, [
      ["Description", "Specification", "Qty Sold", "Confirmed Qty", "Item Sale Excluding Customer Charges", "Gross Profit"],
      ...data.productMovement.map((item) => [item.description, item.specification, item.qty, item.confirmedQty, item.totalSalePhp, item.grossProfitPhp]),
    ]);
  }

  function exportCustomerCharges() {
    if (!data) return;
    downloadCsv(`realights-${data.mode}-customer-charges-${data.startDate}-to-${data.endDate}.csv`, [["Line", "Amount", "Audit Meaning"], ...customerChargeAuditRows.map((row) => [row.line, row.amount, row.meaning])]);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-1 text-sm text-slate-600">Sales use Sale Date. Cash received, customer charges, change given, and collections are separated for audit.</p>
            {data ? <p className="mt-2 text-sm font-semibold text-slate-800">{periodTitle}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Open Receivables are reconciled from Payments so installment balances stay open.</p>
          </div>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); loadReport(reportDate, mode).catch(console.error); }}>
            <select className="rounded-xl border border-slate-300 px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value as ReportMode)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            <button className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white" disabled={loading} type="submit">{loading ? "Loading..." : "Load Report"}</button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportSummary} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Summary CSV</button>
          <button onClick={exportSales} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Sales CSV</button>
          <button onClick={exportCustomerCharges} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Customer Charges CSV</button>
          <button onClick={exportCollections} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Collections CSV</button>
          <button onClick={exportReceivables} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Receivables CSV</button>
          <button onClick={exportExpenses} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Expenses CSV</button>
          <button onClick={exportProductMovement} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Export Product Movement CSV</button>
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      </div>

      {summary ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={`${titleForMode(mode)} Sales`} value={money(summary.totalSalesToday)} helper={`${summary.dailySaleCount} sale transaction(s)`} />
          <StatCard label="Customer Charges" value={money(customerCharges)} helper="Delivery + installation + other" />
          <StatCard label={`${titleForMode(mode)} Collections`} value={money(summary.collectionsToday)} helper="Applied to sales only" />
          <StatCard label="Cash Received" value={money(summary.cashReceivedToday || summary.collectionsToday)} helper="Total tendered before change" />
          <StatCard label="Change Given" value={money(summary.changeGivenToday || 0)} helper="Returned to customers" />
          <StatCard label="Net Cash After Change" value={money(summary.netCashAfterChangeToday || summary.collectionsToday)} helper="Cash received minus change" />
          <StatCard label="Gross Profit" value={money(summary.grossProfitToday)} helper="Based on sale date" />
          <StatCard label="Net Profit" value={money(summary.netProfitToday)} helper="Gross profit minus expenses" />
          <StatCard label="Confirmed Sales" value={money(summary.confirmedSalesToday)} helper="Inventory-affecting sales" />
          <StatCard label="Expenses" value={money(summary.expensesToday)} helper="Manual + supplier costs" />
          <StatCard label="New Receivables" value={money(summary.newReceivablesToday)} helper="Reconciled open balances from period sales" />
          <StatCard label="Ending Receivables" value={money(summary.endingReceivables)} helper="All open balances from Payments" />
        </div>
      ) : null}

      <SectionCard title="Sales Breakdown / Customer Charges" helper="Customer-paid delivery, installation, and other charges are revenue charges included in Grand Total Sales. They are not manual expenses.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Line</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Audit Meaning</th></tr></thead>
            <tbody>
              <BreakdownRow label="Product Sales" value={productSales} helper="Products/items only before customer charges" />
              <BreakdownRow label="Customer Charges" value={customerCharges} helper="Delivery + installation + other charges billed to customer" strong />
              <BreakdownRow label="- Delivery Fee" value={deliveryFee} helper="Customer-paid delivery revenue; included in Grand Total Sales" />
              <BreakdownRow label="- Installation Fee" value={installationFee} helper="Customer-paid installation/service revenue" />
              <BreakdownRow label="- Other Charge" value={otherCharge} helper="Other customer-billed charge" />
              <BreakdownRow label="Discount" value={discount} helper="Deduction given to customer" />
              <BreakdownRow label="Tax" value={tax} helper="Tax or VAT charged to customer" />
              <BreakdownRow label="Grand Total Sales" value={grandTotal} helper="Product sales + customer charges - discount + tax" strong />
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Customer Charge Audit" helper="This prevents delivery fees from being mistaken as inventory product sales or company-paid expenses.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Charge Type</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Audit Treatment</th></tr></thead>
            <tbody>{customerChargeAuditRows.map((row) => <BreakdownRow key={row.line} label={row.line} value={row.amount} helper={row.meaning} strong={row.line === "Total Customer Charges"} />)}</tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Daily Trend">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Collections</th><th className="px-4 py-3 text-right">Cash Received</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Expenses</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3 text-right">Net Profit</th><th className="px-4 py-3 text-right">Receivables</th></tr></thead>
            <tbody>
              {reconciledTrend.length ? reconciledTrend.map((row) => <tr key={row.date} className="border-t border-slate-100"><td className="px-4 py-3">{row.date}</td><td className="px-4 py-3 text-right">{money(row.sales)}</td><td className="px-4 py-3 text-right">{money(row.collections)}</td><td className="px-4 py-3 text-right">{money(row.cashReceived ?? row.collections)}</td><td className="px-4 py-3 text-right">{money(row.changeGiven || 0)}</td><td className="px-4 py-3 text-right">{money(row.expenses)}</td><td className="px-4 py-3 text-right">{money(row.grossProfit)}</td><td className="px-4 py-3 text-right font-bold">{money(row.netProfit)}</td><td className="px-4 py-3 text-right">{money(row.receivables)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No activity for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Collections Breakdown" helper="Applied sale collection. Cash received and change are shown in Sales Detail.">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Share</th></tr></thead>
              <tbody>{data?.collectionsByMethod.length ? data.collectionsByMethod.map((item) => <tr key={item.method} className="border-t border-slate-100"><td className="px-4 py-3">{item.method}</td><td className="px-4 py-3 text-right font-semibold">{money(item.amount)}</td><td className="px-4 py-3 text-right">{collectionMethodTotal ? `${((item.amount / collectionMethodTotal) * 100).toFixed(1)}%` : "0.0%"}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={3}>No collections for this period.</td></tr>}</tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Expense Breakdown">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
              <tbody>{data?.expensesByCategory.length ? data.expensesByCategory.map((item) => <tr key={item.category} className="border-t border-slate-100"><td className="px-4 py-3">{item.category}</td><td className="px-4 py-3 text-right font-semibold">{money(item.amount)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={2}>No expenses for this period.</td></tr>}</tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Product Movement Audit" helper="Inventory movement uses product lines only. Delivery/installation/other customer charges are audited separately in Customer Charge Audit above.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Specification</th><th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Confirmed Qty</th><th className="px-4 py-3 text-right">Item Sale</th><th className="px-4 py-3 text-right">Gross Profit</th></tr></thead>
            <tbody>{data?.productMovement.length ? data.productMovement.map((item) => <tr key={`${item.description}-${item.specification}`} className="border-t border-slate-100"><td className="px-4 py-3">{item.description}</td><td className="px-4 py-3">{item.specification}</td><td className="px-4 py-3 text-right">{item.qty}</td><td className="px-4 py-3 text-right font-bold">{item.confirmedQty}</td><td className="px-4 py-3 text-right">{money(item.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(item.grossProfitPhp)}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No product movement for this period.</td></tr>}</tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Sales Detail">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sales Ref</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Product Sales</th><th className="px-4 py-3 text-right">Delivery</th><th className="px-4 py-3 text-right">Install</th><th className="px-4 py-3 text-right">Other</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Grand Total</th><th className="px-4 py-3 text-right">Paid / Applied</th><th className="px-4 py-3 text-right">Cash Received</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Sale</th></tr></thead>
            <tbody>{reconciledSales.length ? reconciledSales.map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}-${sale.totalSalePhp}`} className="border-t border-slate-100"><td className="px-4 py-3">{sale.saleDate}</td><td className="px-4 py-3">{sale.salesRefNo}</td><td className="px-4 py-3">{sale.customerName}</td><td className="px-4 py-3 text-right">{money(sale.productSubtotalPhp || 0)}</td><td className="px-4 py-3 text-right font-semibold text-blue-700">{money(sale.deliveryFeePhp || 0)}</td><td className="px-4 py-3 text-right">{money(sale.installationFeePhp || 0)}</td><td className="px-4 py-3 text-right">{money(sale.otherChargePhp || 0)}</td><td className="px-4 py-3 text-right">{money(sale.discountPhp || 0)}</td><td className="px-4 py-3 text-right">{money(sale.taxAmountPhp || 0)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.tenderedAmountPhp || sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right text-rose-600">{money(sale.changeDuePhp || 0)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.balancePhp)}</td><td className="px-4 py-3 text-right">{money(sale.grossProfitPhp)}</td><td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td><td className="px-4 py-3"><StatusPill value={sale.saleStatus} /></td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={17}>No sales for this period.</td></tr>}</tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Open Receivables">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sales Ref</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Cash Received</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>{periodOpenReceivables.length ? periodOpenReceivables.map((sale) => <tr key={`${sale.salesRefNo}-${sale.customerName}`} className="border-t border-slate-100"><td className="px-4 py-3">{sale.saleDate}</td><td className="px-4 py-3">{sale.salesRefNo}</td><td className="px-4 py-3">{sale.customerName}</td><td className="px-4 py-3 text-right">{money(sale.totalSalePhp)}</td><td className="px-4 py-3 text-right">{money(sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right">{money(sale.tenderedAmountPhp || sale.totalPaidPhp)}</td><td className="px-4 py-3 text-right text-rose-600">{money(sale.changeDuePhp || 0)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.balancePhp)}</td><td className="px-4 py-3"><StatusPill value={sale.paymentStatus} /></td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No open receivables.</td></tr>}</tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Expense Detail">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Source</th></tr></thead>
              <tbody>{data?.dailyExpenses.length ? data.dailyExpenses.map((expense) => <tr key={`${expense.date}-${expense.category}-${expense.description}`} className="border-t border-slate-100"><td className="px-4 py-3">{expense.date}</td><td className="px-4 py-3">{expense.category}</td><td className="px-4 py-3">{expense.description}</td><td className="px-4 py-3 text-right font-bold">{money(expense.amount)}</td><td className="px-4 py-3">{expense.source}</td></tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No expenses for this period.</td></tr>}</tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
