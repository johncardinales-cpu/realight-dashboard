import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PAYMENTS_SHEET = "Payments";
const EXPENSES_SHEET = "Expenses";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDate(value: string) {
  const parsed = new Date(`${safeText(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(mode: string, dateValue: string) {
  const base = toDate(dateValue) || (toDate(today()) as Date);
  const normalizedMode = ["daily", "weekly", "monthly"].includes(mode) ? mode : "daily";
  const start = new Date(base);
  const end = new Date(base);

  if (normalizedMode === "weekly") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  } else if (normalizedMode === "monthly") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return { mode: normalizedMode, startDate: formatDate(start), endDate: formatDate(end) };
}

function inRange(value: string, startDate: string, endDate: string) {
  const date = safeText(value).slice(0, 10);
  return date >= startDate && date <= endDate;
}

function getPaymentStatus(totalPaid: number, totalSale: number) {
  if (totalSale <= 0) return "Pending";
  if (totalPaid <= 0) return "Pending";
  if (totalPaid >= totalSale) return "Paid";
  return "Partial";
}

function saleKey(salesRefNo: string, groupRef: string, saleId?: string) {
  return safeText(saleId) || safeText(groupRef) || safeText(salesRefNo);
}

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
    .catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

function buildPaymentLedgerTotals(paymentRows: string[][]) {
  const byKey = new Map<string, number>();

  paymentRows.slice(1).forEach((row) => {
    const salesRefNo = safeText(row[1]);
    const groupRef = safeText(row[2]);
    const amount = toNumber(row[5]);
    const saleId = safeText(row[11]);
    const key = saleKey(salesRefNo, groupRef, saleId);

    if (!key || amount <= 0) return;
    byKey.set(key, (byKey.get(key) || 0) + amount);
    if (saleId) byKey.set(saleId, (byKey.get(saleId) || 0) + amount);
    if (groupRef) byKey.set(groupRef, (byKey.get(groupRef) || 0) + amount);
    if (salesRefNo) byKey.set(salesRefNo, (byKey.get(salesRefNo) || 0) + amount);
  });

  return { byKey };
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const paymentLedger = buildPaymentLedgerTotals(paymentRows);
  const map = new Map<string, any>();

  salesRows.slice(1).forEach((row) => {
    const saleDate = safeText(row[0]);
    const salesRefNo = safeText(row[1]);
    const customerName = safeText(row[2]);
    const groupRef = safeText(row[14]);
    const saleId = safeText(row[22]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const totalSalePhp = toNumber(row[7]);
    const grossProfitPhp = toNumber(row[10]);
    const initialPaidPhp = toNumber(row[16]);
    const paymentMethod = safeText(row[15]) || "Unspecified";
    const saleStatus = safeText(row[20]) || "Draft";

    if (!key || !saleDate || !customerName || totalSalePhp <= 0) return;

    const current = map.get(key) || {
      key,
      saleId,
      saleDate,
      salesRefNo,
      groupRef,
      customerName,
      totalSalePhp: 0,
      grossProfitPhp: 0,
      initialPaidPhp: 0,
      initialPaymentMethod: paymentMethod,
      saleStatus,
    };

    current.totalSalePhp += totalSalePhp;
    current.grossProfitPhp += grossProfitPhp;
    current.initialPaidPhp += initialPaidPhp;
    current.saleStatus = saleStatus;
    map.set(key, current);
  });

  return Array.from(map.values()).map((sale) => {
    const followUpPaidPhp = paymentLedger.byKey.get(sale.saleId) || paymentLedger.byKey.get(sale.groupRef) || paymentLedger.byKey.get(sale.salesRefNo) || 0;
    const totalPaidPhp = sale.initialPaidPhp + followUpPaidPhp;
    const balancePhp = Math.max(sale.totalSalePhp - totalPaidPhp, 0);

    return { ...sale, followUpPaidPhp, totalPaidPhp, balancePhp, paymentStatus: getPaymentStatus(totalPaidPhp, sale.totalSalePhp) };
  });
}

function parseExpenseRows(expenseRows: string[][]) {
  if (!expenseRows.length) return [];
  const header = expenseRows[0].map(safeText);

  return expenseRows.slice(1).map((row) => {
    const map: Record<string, string> = {};
    header.forEach((h, i) => { map[h] = safeText(row[i]); });

    return {
      date: map["Expense Date"] || map["Date"] || map["Upload Date"] || "",
      category: map["Category"] || "General Expense",
      description: map["Description"] || map["Expense"] || "",
      amount: toNumber(map["Amount"] || map["Total"] || map["Expense Amount"]),
      source: "Expenses",
    };
  }).filter((row) => row.date || row.description || row.amount > 0);
}

function parseSupplierRows(supplierRows: string[][]) {
  return supplierRows.slice(1).map((row) => ({
    date: safeText(row[0]),
    category: "Supplier Invoice Cost",
    description: safeText(row[1]),
    amount: toNumber(row[10]),
    source: "Supplier_Invoice_Costs",
  })).filter((row) => row.date || row.description || row.amount > 0);
}

function summarizeMethodBreakdown(entries: Array<{ method: string; amount: number }>) {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const method = entry.method || "Unspecified";
    map.set(method, (map.get(method) || 0) + entry.amount);
  });
  return Array.from(map.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

function summarizeByCategory(entries: Array<{ category: string; amount: number }>) {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const category = entry.category || "Uncategorized";
    map.set(category, (map.get(category) || 0) + entry.amount);
  });
  return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function summarizeDaily(periodSales: any[], periodExpenses: any[], initialCollections: any[], followUpCollections: any[]) {
  const days = new Map<string, any>();
  const ensure = (date: string) => {
    if (!days.has(date)) days.set(date, { date, sales: 0, collections: 0, expenses: 0, grossProfit: 0, netProfit: 0, receivables: 0 });
    return days.get(date);
  };

  periodSales.forEach((sale) => {
    const item = ensure(sale.saleDate.slice(0, 10));
    item.sales += sale.totalSalePhp;
    item.grossProfit += sale.grossProfitPhp;
    item.receivables += sale.balancePhp;
  });

  periodExpenses.forEach((expense) => {
    const item = ensure(expense.date.slice(0, 10));
    item.expenses += expense.amount;
  });

  [...initialCollections, ...followUpCollections].forEach((entry) => {
    const item = ensure(entry.date);
    item.collections += entry.amount;
  });

  return Array.from(days.values()).map((item) => ({ ...item, netProfit: item.grossProfit - item.expenses })).sort((a, b) => a.date.localeCompare(b.date));
}

function summarizeProductMovement(salesRows: string[][], startDate: string, endDate: string) {
  const map = new Map<string, any>();

  salesRows.slice(1).forEach((row) => {
    const saleDate = safeText(row[0]);
    if (!inRange(saleDate, startDate, endDate)) return;

    const description = safeText(row[3]);
    const specification = safeText(row[4]);
    const key = `${description}|||${specification}`;
    const qty = toNumber(row[5]);
    const totalSalePhp = toNumber(row[7]);
    const grossProfitPhp = toNumber(row[10]);
    const saleStatus = safeText(row[20]) || "Draft";

    if (!description && !specification) return;

    const current = map.get(key) || { description, specification, qty: 0, totalSalePhp: 0, grossProfitPhp: 0, confirmedQty: 0 };
    current.qty += qty;
    current.totalSalePhp += totalSalePhp;
    current.grossProfitPhp += grossProfitPhp;
    if (saleStatus.toLowerCase() === "confirmed") current.confirmedQty += qty;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => b.totalSalePhp - a.totalSalePhp);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reportDate = url.searchParams.get("date") || today();
    const mode = url.searchParams.get("mode") || "daily";
    const period = getPeriodRange(mode, reportDate);
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const [salesRows, paymentRows, expenseRows, supplierRows] = await Promise.all([
      readRange(sheets, `${SALES_SHEET}!A:Y`),
      readRange(sheets, `${PAYMENTS_SHEET}!A:L`),
      readRange(sheets, `${EXPENSES_SHEET}!A:Z`),
      readRange(sheets, `${SUPPLIER_COSTS_SHEET}!A:L`),
    ]);

    const saleSummaries = buildSaleSummaries(salesRows, paymentRows);
    const periodSales = saleSummaries.filter((sale) => inRange(sale.saleDate, period.startDate, period.endDate));
    const allExpenses = [...parseExpenseRows(expenseRows), ...parseSupplierRows(supplierRows)];
    const periodExpenses = allExpenses.filter((expense) => inRange(expense.date, period.startDate, period.endDate));

    const initialCollections = periodSales.filter((sale) => sale.initialPaidPhp > 0).map((sale) => ({ date: sale.saleDate.slice(0, 10), method: sale.initialPaymentMethod || "Unspecified", amount: sale.initialPaidPhp }));
    const followUpCollections = paymentRows.slice(1).filter((row) => inRange(safeText(row[0]), period.startDate, period.endDate)).map((row) => ({ date: safeText(row[0]).slice(0, 10), method: safeText(row[4]) || "Unspecified", amount: toNumber(row[5]) })).filter((row) => row.amount > 0);

    const totalSales = periodSales.reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const confirmedSales = periodSales.filter((sale) => sale.saleStatus.toLowerCase() === "confirmed").reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const grossProfit = periodSales.reduce((sum, sale) => sum + sale.grossProfitPhp, 0);
    const expenses = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const initialCollectionsTotal = initialCollections.reduce((sum, entry) => sum + entry.amount, 0);
    const followUpCollectionsTotal = followUpCollections.reduce((sum, entry) => sum + entry.amount, 0);
    const collections = initialCollectionsTotal + followUpCollectionsTotal;
    const endingReceivables = saleSummaries.reduce((sum, sale) => sum + sale.balancePhp, 0);
    const newReceivables = periodSales.reduce((sum, sale) => sum + sale.balancePhp, 0);

    const paymentStatusCounts = periodSales.reduce((acc: Record<string, number>, sale) => {
      acc[sale.paymentStatus] = (acc[sale.paymentStatus] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      reportDate,
      mode: period.mode,
      startDate: period.startDate,
      endDate: period.endDate,
      summary: {
        totalSalesToday: totalSales,
        confirmedSalesToday: confirmedSales,
        grossProfitToday: grossProfit,
        expensesToday: expenses,
        netProfitToday: grossProfit - expenses,
        initialCollectionsToday: initialCollectionsTotal,
        followUpCollectionsToday: followUpCollectionsTotal,
        collectionsToday: collections,
        newReceivablesToday: newReceivables,
        endingReceivables,
        dailySaleCount: periodSales.length,
        paymentStatusCounts,
      },
      collectionsByMethod: summarizeMethodBreakdown([...initialCollections, ...followUpCollections]),
      expensesByCategory: summarizeByCategory(periodExpenses),
      dailyTrend: summarizeDaily(periodSales, periodExpenses, initialCollections, followUpCollections),
      productMovement: summarizeProductMovement(salesRows, period.startDate, period.endDate),
      dailySales: periodSales.map((sale) => ({
        saleDate: sale.saleDate,
        salesRefNo: sale.salesRefNo,
        customerName: sale.customerName,
        totalSalePhp: sale.totalSalePhp,
        totalPaidPhp: sale.totalPaidPhp,
        balancePhp: sale.balancePhp,
        grossProfitPhp: sale.grossProfitPhp,
        paymentStatus: sale.paymentStatus,
        saleStatus: sale.saleStatus,
      })),
      dailyExpenses: periodExpenses,
      openReceivables: saleSummaries.filter((sale) => sale.balancePhp > 0).sort((a, b) => b.balancePhp - a.balancePhp).map((sale) => ({
        saleDate: sale.saleDate,
        salesRefNo: sale.salesRefNo,
        customerName: sale.customerName,
        totalSalePhp: sale.totalSalePhp,
        totalPaidPhp: sale.totalPaidPhp,
        balancePhp: sale.balancePhp,
        paymentStatus: sale.paymentStatus,
        saleStatus: sale.saleStatus,
      })),
    });
  } catch (error: any) {
    console.error("REPORTS API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load reports" }, { status: 500 });
  }
}
