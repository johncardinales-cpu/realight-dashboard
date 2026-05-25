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
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function toNumber(value: string | number | undefined) { return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0; }
function safeText(value: unknown) { return String(value || "").trim(); }
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(date: Date) { return date.toISOString().slice(0, 10); }
function saleKey(salesRefNo: string, groupRef: string, saleId?: string) { return safeText(saleId) || safeText(groupRef) || safeText(salesRefNo); }
function normalizeRef(value: unknown) { return safeText(value).toLowerCase(); }
function getPaymentStatus(totalPaid: number, totalDue: number) { if (totalDue <= 0 || totalPaid <= 0) return "Pending"; if (totalPaid >= totalDue) return "Paid"; return "Partial"; }

function normalizeDate(value: unknown) {
  const text = safeText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) {
    const [first, second, yearPart] = text.split("/").map((part) => Number(part));
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const month = first;
    const day = second;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 90000) {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400 * 1000;
      return new Date(utcValue).toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function toDate(value: string) { const normalized = normalizeDate(value); const parsed = new Date(`${normalized}T00:00:00`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function inRange(value: unknown, startDate: string, endDate: string) { const date = normalizeDate(value); return date >= startDate && date <= endDate; }

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

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range }).catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

function buildPaymentLedgerTotals(paymentRows: string[][]) {
  const byKey = new Map<string, number>();
  paymentRows.slice(1).forEach((row) => {
    const salesRefNo = safeText(row[1]);
    const groupRef = safeText(row[2]);
    const saleId = safeText(row[11]);
    const amount = toNumber(row[5]);
    if (amount <= 0) return;
    [saleKey(salesRefNo, groupRef, saleId), saleId, groupRef, salesRefNo].filter(Boolean).forEach((key) => byKey.set(key, (byKey.get(key) || 0) + amount));
  });
  return { byKey };
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const paymentLedger = buildPaymentLedgerTotals(paymentRows);
  const map = new Map<string, any>();
  salesRows.slice(1).forEach((row) => {
    const saleDate = normalizeDate(row[0]);
    const salesRefNo = safeText(row[1]);
    const customerName = safeText(row[2]);
    const groupRef = safeText(row[14]);
    const saleId = safeText(row[22]);
    const customerId = safeText(row[33]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const productSubtotalPhp = toNumber(row[25] || row[7]);
    const taxAmountPhp = toNumber(row[27]);
    const grandTotalPhp = toNumber(row[28] || row[7]);
    const deliveryFeePhp = toNumber(row[29]);
    const installationFeePhp = toNumber(row[30]);
    const otherChargePhp = toNumber(row[31]);
    const discountPhp = toNumber(row[32]);
    const grossProfitPhp = toNumber(row[10]);
    const appliedPaidPhp = toNumber(row[16]);
    const tenderedPhp = toNumber(row[34] || row[16]);
    const changeDuePhp = toNumber(row[35]);
    const paymentMethod = safeText(row[15]) || "Unspecified";
    const saleStatus = safeText(row[20]) || "Draft";
    if (!key || !saleDate || !customerName || grandTotalPhp <= 0) return;
    const current = map.get(key) || {
      key, saleId, saleDate, salesRefNo, groupRef, customerId, customerName,
      productSubtotalPhp: 0, deliveryFeePhp: 0, installationFeePhp: 0, otherChargePhp: 0, discountPhp: 0, taxAmountPhp: 0,
      totalSalePhp: 0, grossProfitPhp: 0, initialPaidPhp: 0, initialTenderedPhp: 0, initialChangeDuePhp: 0, initialPaymentMethod: paymentMethod, saleStatus,
      linkedExpensesPhp: 0,
    };
    current.productSubtotalPhp += productSubtotalPhp;
    current.deliveryFeePhp += deliveryFeePhp;
    current.installationFeePhp += installationFeePhp;
    current.otherChargePhp += otherChargePhp;
    current.discountPhp += discountPhp;
    current.taxAmountPhp += taxAmountPhp;
    current.totalSalePhp += grandTotalPhp;
    current.grossProfitPhp += grossProfitPhp;
    current.initialPaidPhp += appliedPaidPhp;
    current.initialTenderedPhp += tenderedPhp;
    current.initialChangeDuePhp += changeDuePhp;
    current.saleStatus = saleStatus;
    if (!current.saleId && saleId) current.saleId = saleId;
    if (!current.customerId && customerId) current.customerId = customerId;
    map.set(key, current);
  });
  return Array.from(map.values()).map((sale) => {
    const followUpPaidPhp = paymentLedger.byKey.get(sale.saleId) || paymentLedger.byKey.get(sale.groupRef) || paymentLedger.byKey.get(sale.salesRefNo) || paymentLedger.byKey.get(sale.key) || 0;
    const totalPaidPhp = sale.initialPaidPhp + followUpPaidPhp;
    const totalTenderedPhp = sale.initialTenderedPhp + followUpPaidPhp;
    const changeDuePhp = sale.initialChangeDuePhp;
    const netCollectionPhp = totalTenderedPhp - changeDuePhp;
    const balancePhp = Math.max(sale.totalSalePhp - totalPaidPhp, 0);
    return { ...sale, followUpPaidPhp, totalPaidPhp, totalTenderedPhp, changeDuePhp, netCollectionPhp, balancePhp, paymentStatus: getPaymentStatus(totalPaidPhp, sale.totalSalePhp), netProfitPhp: sale.grossProfitPhp - sale.linkedExpensesPhp };
  });
}

function parseExpenseRows(expenseRows: string[][]) {
  if (!expenseRows.length) return [];
  const header = expenseRows[0].map(safeText);
  return expenseRows.slice(1).map((row) => {
    const map: Record<string, string> = {};
    header.forEach((h, i) => { map[h] = safeText(row[i]); });
    return {
      date: normalizeDate(map["Expense Date"] || map["Date"] || map["Upload Date"] || ""),
      category: map["Category"] || "General Expense",
      description: map["Description"] || map["Expense"] || "",
      amount: toNumber(map["Total Amount"] || map["Amount"] || map["Total"] || map["Expense Amount"]),
      paymentMethod: map["Payment Method"] || "",
      reference: map["Reference No."] || map["Reference"] || "",
      relatedSalesRefNo: map["Related Sales Ref No."] || "",
      payee: map["Payee"] || "",
      notes: map["Notes"] || "",
      source: "Expenses",
    };
  }).filter((row) => row.date || row.description || row.amount > 0);
}

function parseSupplierRows(supplierRows: string[][]) {
  return supplierRows.slice(1).map((row) => ({
    date: normalizeDate(row[0]), category: "Supplier Invoice Cost", description: safeText(row[1]), amount: toNumber(row[10]),
    paymentMethod: "", reference: safeText(row[3]) || safeText(row[2]), relatedSalesRefNo: "", payee: safeText(row[1]), notes: safeText(row[11]), source: "Supplier_Invoice_Costs",
  })).filter((row) => row.date || row.description || row.amount > 0);
}

function attachLinkedExpenses(sales: any[], expenses: any[]) {
  const expenseByRef = new Map<string, number>();
  expenses.forEach((expense) => {
    const ref = normalizeRef(expense.relatedSalesRefNo);
    if (!ref || expense.amount <= 0) return;
    expenseByRef.set(ref, (expenseByRef.get(ref) || 0) + expense.amount);
  });
  return sales.map((sale) => {
    const linked = [sale.salesRefNo, sale.groupRef, sale.saleId, sale.key].map(normalizeRef).filter(Boolean).reduce((sum, ref) => sum + (expenseByRef.get(ref) || 0), 0);
    return { ...sale, linkedExpensesPhp: linked, netProfitPhp: sale.grossProfitPhp - linked };
  });
}

function summarizeMethodBreakdown(entries: Array<{ method: string; amount: number }>) {
  const map = new Map<string, number>();
  entries.forEach((entry) => { const method = entry.method || "Unspecified"; map.set(method, (map.get(method) || 0) + entry.amount); });
  return Array.from(map.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

function summarizeByCategory(entries: Array<{ category: string; amount: number }>) {
  const map = new Map<string, number>();
  entries.forEach((entry) => { const category = entry.category || "Uncategorized"; map.set(category, (map.get(category) || 0) + entry.amount); });
  return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function summarizeDaily(periodSales: any[], periodExpenses: any[], initialCollections: any[], followUpCollections: any[]) {
  const days = new Map<string, any>();
  const ensure = (date: string) => { if (!days.has(date)) days.set(date, { date, sales: 0, productSubtotal: 0, deliveryFee: 0, installationFee: 0, otherCharge: 0, discount: 0, tax: 0, collections: 0, cashReceived: 0, changeGiven: 0, expenses: 0, linkedExpenses: 0, grossProfit: 0, netProfit: 0, receivables: 0 }); return days.get(date); };
  periodSales.forEach((sale) => { const item = ensure(sale.saleDate); item.sales += sale.totalSalePhp; item.productSubtotal += sale.productSubtotalPhp; item.deliveryFee += sale.deliveryFeePhp; item.installationFee += sale.installationFeePhp; item.otherCharge += sale.otherChargePhp; item.discount += sale.discountPhp; item.tax += sale.taxAmountPhp; item.grossProfit += sale.grossProfitPhp; item.linkedExpenses += sale.linkedExpensesPhp || 0; item.receivables += sale.balancePhp; });
  periodExpenses.forEach((expense) => { const item = ensure(expense.date); item.expenses += expense.amount; });
  [...initialCollections, ...followUpCollections].forEach((entry) => { const item = ensure(entry.date); item.collections += entry.amount; item.cashReceived += entry.tenderedAmount ?? entry.amount; item.changeGiven += entry.changeDue ?? 0; });
  return Array.from(days.values()).map((item) => ({ ...item, netProfit: item.grossProfit - item.expenses })).sort((a, b) => a.date.localeCompare(b.date));
}

function summarizeProductMovement(salesRows: string[][], startDate: string, endDate: string) {
  const map = new Map<string, any>();
  salesRows.slice(1).forEach((row) => {
    const saleDate = normalizeDate(row[0]);
    if (!inRange(saleDate, startDate, endDate)) return;
    const description = safeText(row[3]);
    const specification = safeText(row[4]);
    const key = `${description}|||${specification}`;
    const qty = toNumber(row[5]);
    const totalSalePhp = toNumber(row[28] || row[7]);
    const grossProfitPhp = toNumber(row[10]);
    const saleStatus = safeText(row[20]) || "Draft";
    if (!description && !specification) return;
    const current = map.get(key) || { description, specification, qty: 0, totalSalePhp: 0, grossProfitPhp: 0, confirmedQty: 0 };
    current.qty += qty; current.totalSalePhp += totalSalePhp; current.grossProfitPhp += grossProfitPhp; if (saleStatus.toLowerCase() === "confirmed") current.confirmedQty += qty; map.set(key, current);
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
      readRange(sheets, `${SALES_SHEET}!A:AJ`), readRange(sheets, `${PAYMENTS_SHEET}!A:L`), readRange(sheets, `${EXPENSES_SHEET}!A:Z`), readRange(sheets, `${SUPPLIER_COSTS_SHEET}!A:L`),
    ]);
    const allExpenses = [...parseExpenseRows(expenseRows), ...parseSupplierRows(supplierRows)];
    const saleSummaries = attachLinkedExpenses(buildSaleSummaries(salesRows, paymentRows), allExpenses);
    const periodSales = saleSummaries.filter((sale) => inRange(sale.saleDate, period.startDate, period.endDate));
    const periodExpenses = allExpenses.filter((expense) => inRange(expense.date, period.startDate, period.endDate));
    const linkedExpensesTotal = periodSales.reduce((sum, sale) => sum + (sale.linkedExpensesPhp || 0), 0);
    const unlinkedExpenses = periodExpenses.filter((expense) => !safeText(expense.relatedSalesRefNo));
    const periodExpenseTotal = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const initialCollections = periodSales.filter((sale) => sale.initialPaidPhp > 0 || sale.initialTenderedPhp > 0).map((sale) => ({ date: sale.saleDate, method: sale.initialPaymentMethod || "Unspecified", amount: sale.initialPaidPhp, tenderedAmount: sale.initialTenderedPhp || sale.initialPaidPhp, changeDue: sale.initialChangeDuePhp || 0 }));
    const followUpCollections = paymentRows.slice(1).filter((row) => inRange(row[0], period.startDate, period.endDate)).map((row) => ({ date: normalizeDate(row[0]), method: safeText(row[4]) || "Unspecified", amount: toNumber(row[5]), tenderedAmount: toNumber(row[5]), changeDue: 0 })).filter((row) => row.amount > 0);
    const productSubtotal = periodSales.reduce((sum, sale) => sum + sale.productSubtotalPhp, 0);
    const deliveryFee = periodSales.reduce((sum, sale) => sum + sale.deliveryFeePhp, 0);
    const installationFee = periodSales.reduce((sum, sale) => sum + sale.installationFeePhp, 0);
    const otherCharge = periodSales.reduce((sum, sale) => sum + sale.otherChargePhp, 0);
    const discount = periodSales.reduce((sum, sale) => sum + sale.discountPhp, 0);
    const tax = periodSales.reduce((sum, sale) => sum + sale.taxAmountPhp, 0);
    const totalSales = periodSales.reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const confirmedSales = periodSales.filter((sale) => sale.saleStatus.toLowerCase() === "confirmed").reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const grossProfit = periodSales.reduce((sum, sale) => sum + sale.grossProfitPhp, 0);
    const initialCollectionsTotal = initialCollections.reduce((sum, entry) => sum + entry.amount, 0);
    const followUpCollectionsTotal = followUpCollections.reduce((sum, entry) => sum + entry.amount, 0);
    const collections = initialCollectionsTotal + followUpCollectionsTotal;
    const cashReceived = [...initialCollections, ...followUpCollections].reduce((sum, entry) => sum + (entry.tenderedAmount ?? entry.amount), 0);
    const changeGiven = [...initialCollections, ...followUpCollections].reduce((sum, entry) => sum + (entry.changeDue || 0), 0);
    const endingReceivables = saleSummaries.reduce((sum, sale) => sum + sale.balancePhp, 0);
    const newReceivables = periodSales.reduce((sum, sale) => sum + sale.balancePhp, 0);
    const paymentStatusCounts = periodSales.reduce((acc: Record<string, number>, sale) => { acc[sale.paymentStatus] = (acc[sale.paymentStatus] || 0) + 1; return acc; }, {});

    return NextResponse.json({
      reportDate, mode: period.mode, startDate: period.startDate, endDate: period.endDate,
      summary: {
        productSubtotalPhp: productSubtotal, deliveryFeePhp: deliveryFee, installationFeePhp: installationFee, otherChargePhp: otherCharge, discountPhp: discount, taxAmountPhp: tax, grandTotalPhp: totalSales,
        totalSalesToday: totalSales, confirmedSalesToday: confirmedSales, grossProfitToday: grossProfit, expensesToday: periodExpenseTotal, linkedExpensesToday: linkedExpensesTotal, unlinkedExpensesToday: unlinkedExpenses.reduce((sum, e) => sum + e.amount, 0), netProfitToday: grossProfit - periodExpenseTotal,
        initialCollectionsToday: initialCollectionsTotal, followUpCollectionsToday: followUpCollectionsTotal, collectionsToday: collections, cashReceivedToday: cashReceived, changeGivenToday: changeGiven, netCashAfterChangeToday: cashReceived - changeGiven, newReceivablesToday: newReceivables, endingReceivables, dailySaleCount: periodSales.length, paymentStatusCounts,
      },
      accountingBreakdown: { productSubtotalPhp: productSubtotal, deliveryFeePhp: deliveryFee, installationFeePhp: installationFee, otherChargePhp: otherCharge, discountPhp: discount, taxAmountPhp: tax, grandTotalPhp: totalSales, grossProfitPhp: grossProfit, linkedExpensesPhp: linkedExpensesTotal, totalExpensesPhp: periodExpenseTotal, netProfitPhp: grossProfit - periodExpenseTotal },
      collectionsByMethod: summarizeMethodBreakdown([...initialCollections, ...followUpCollections]),
      cashByMethod: summarizeMethodBreakdown([...initialCollections, ...followUpCollections].map((entry) => ({ method: entry.method, amount: entry.tenderedAmount ?? entry.amount }))),
      expensesByCategory: summarizeByCategory(periodExpenses),
      dailyTrend: summarizeDaily(periodSales, periodExpenses, initialCollections, followUpCollections),
      productMovement: summarizeProductMovement(salesRows, period.startDate, period.endDate),
      dailySales: periodSales.map((sale) => ({ saleDate: sale.saleDate, salesRefNo: sale.salesRefNo, customerName: sale.customerName, customerId: sale.customerId, productSubtotalPhp: sale.productSubtotalPhp, deliveryFeePhp: sale.deliveryFeePhp, installationFeePhp: sale.installationFeePhp, otherChargePhp: sale.otherChargePhp, discountPhp: sale.discountPhp, taxAmountPhp: sale.taxAmountPhp, totalSalePhp: sale.totalSalePhp, grandTotalPhp: sale.totalSalePhp, totalPaidPhp: sale.totalPaidPhp, tenderedAmountPhp: sale.totalTenderedPhp, changeDuePhp: sale.changeDuePhp, netCollectionPhp: sale.netCollectionPhp, balancePhp: sale.balancePhp, grossProfitPhp: sale.grossProfitPhp, linkedExpensesPhp: sale.linkedExpensesPhp || 0, netProfitPhp: sale.netProfitPhp, paymentStatus: sale.paymentStatus, saleStatus: sale.saleStatus })),
      dailyExpenses: periodExpenses,
      linkedExpenses: periodExpenses.filter((expense) => safeText(expense.relatedSalesRefNo)),
      openReceivables: saleSummaries.filter((sale) => sale.balancePhp > 0).sort((a, b) => b.balancePhp - a.balancePhp).map((sale) => ({ saleDate: sale.saleDate, salesRefNo: sale.salesRefNo, customerName: sale.customerName, totalSalePhp: sale.totalSalePhp, totalPaidPhp: sale.totalPaidPhp, tenderedAmountPhp: sale.totalTenderedPhp, changeDuePhp: sale.changeDuePhp, balancePhp: sale.balancePhp, paymentStatus: sale.paymentStatus, saleStatus: sale.saleStatus })),
    });
  } catch (error: any) {
    console.error("REPORTS API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load reports" }, { status: 500 });
  }
}
