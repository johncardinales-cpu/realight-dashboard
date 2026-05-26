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

function txt(v: unknown) { return String(v || "").trim(); }
function num(v: unknown) { return Number(String(v || "").replace(/[^0-9.-]/g, "")) || 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function key(ref: string, group: string, id?: string) { return txt(id) || txt(group) || txt(ref); }
function finalSale(status: unknown) { return txt(status).toLowerCase() === "confirmed"; }
function payStatus(paid: number, total: number) { if (total <= 0 || paid <= 0) return "Pending"; return paid >= total ? "Paid" : "Partial"; }

function normDate(v: unknown) {
  const s = txt(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [m, d, y0] = s.split("/").map(Number);
    const y = y0 < 100 ? 2000 + y0 : y0;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function toDate(v: string) { const d = new Date(`${normDate(v)}T00:00:00`); return Number.isNaN(d.getTime()) ? null : d; }
function inRange(v: unknown, a: string, b: string) { const d = normDate(v); return d >= a && d <= b; }

function period(mode: string, value: string) {
  const base = toDate(value) || (toDate(today()) as Date);
  const m = ["daily", "weekly", "monthly"].includes(mode) ? mode : "daily";
  const start = new Date(base); const end = new Date(base);
  if (m === "weekly") { const day = start.getDay(); const off = day === 0 ? -6 : 1 - day; start.setDate(start.getDate() + off); end.setTime(start.getTime()); end.setDate(start.getDate() + 6); }
  if (m === "monthly") { start.setDate(1); end.setMonth(start.getMonth() + 1, 0); }
  return { mode: m, startDate: fmt(start), endDate: fmt(end) };
}

async function read(sheets: any, range: string) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range }).catch(() => ({ data: { values: [] } }));
  return (res.data.values || []) as string[][];
}

function paymentLedger(rows: string[][]) {
  const map = new Map<string, number>();
  rows.slice(1).forEach((r) => {
    const amount = num(r[5]); if (amount <= 0) return;
    [key(r[1], r[2], r[11]), txt(r[11]), txt(r[2]), txt(r[1])].filter(Boolean).forEach((k) => map.set(k, (map.get(k) || 0) + amount));
  });
  return map;
}

function salesSummary(salesRows: string[][], paymentRows: string[][]) {
  const ledger = paymentLedger(paymentRows);
  const map = new Map<string, any>();
  salesRows.slice(1).forEach((r) => {
    const saleStatus = txt(r[20]) || "Draft";
    if (!finalSale(saleStatus)) return;
    const saleDate = normDate(r[0]);
    const salesRefNo = txt(r[1]);
    const customerName = txt(r[2]);
    const groupRef = txt(r[14]);
    const saleId = txt(r[22]);
    const k = key(salesRefNo, groupRef, saleId);
    const total = num(r[28] || r[7]);
    if (!k || !saleDate || !customerName || total <= 0) return;
    const current = map.get(k) || { key: k, saleId, saleDate, salesRefNo, groupRef, customerId: txt(r[33]), customerName, productSubtotalPhp: 0, deliveryFeePhp: 0, installationFeePhp: 0, otherChargePhp: 0, discountPhp: 0, taxAmountPhp: 0, totalSalePhp: 0, grossProfitPhp: 0, initialPaidPhp: 0, initialTenderedPhp: 0, initialChangeDuePhp: 0, initialPaymentMethod: txt(r[15]) || "Unspecified", linkedExpensesPhp: 0, saleStatus };
    current.productSubtotalPhp += num(r[25] || r[7]);
    current.deliveryFeePhp += num(r[29]);
    current.installationFeePhp += num(r[30]);
    current.otherChargePhp += num(r[31]);
    current.discountPhp += num(r[32]);
    current.taxAmountPhp += num(r[27]);
    current.totalSalePhp += total;
    current.grossProfitPhp += num(r[10]);
    current.initialPaidPhp += num(r[16]);
    current.initialTenderedPhp += num(r[34] || r[16]);
    current.initialChangeDuePhp += num(r[35]);
    map.set(k, current);
  });
  return Array.from(map.values()).map((s) => {
    const followUpPaidPhp = ledger.get(s.saleId) || ledger.get(s.groupRef) || ledger.get(s.salesRefNo) || ledger.get(s.key) || 0;
    const totalPaidPhp = s.initialPaidPhp + followUpPaidPhp;
    const totalTenderedPhp = s.initialTenderedPhp + followUpPaidPhp;
    const changeDuePhp = s.initialChangeDuePhp;
    const balancePhp = Math.max(s.totalSalePhp - totalPaidPhp, 0);
    return { ...s, followUpPaidPhp, totalPaidPhp, totalTenderedPhp, changeDuePhp, netCollectionPhp: totalTenderedPhp - changeDuePhp, balancePhp, paymentStatus: payStatus(totalPaidPhp, s.totalSalePhp), netProfitPhp: s.grossProfitPhp - s.linkedExpensesPhp };
  });
}

function parseExpenses(rows: string[][]) {
  if (!rows.length) return [];
  const h = rows[0].map(txt);
  return rows.slice(1).map((r) => {
    const m: Record<string, string> = {}; h.forEach((x, i) => { m[x] = txt(r[i]); });
    return { date: normDate(m["Expense Date"] || m["Date"] || m["Upload Date"]), category: m["Category"] || "General Expense", description: m["Description"] || m["Expense"] || "", amount: num(m["Total Amount"] || m["Amount"] || m["Total"] || m["Expense Amount"]), paymentMethod: m["Payment Method"] || "", reference: m["Reference No."] || m["Reference"] || "", relatedSalesRefNo: m["Related Sales Ref No."] || "", payee: m["Payee"] || "", notes: m["Notes"] || "", source: "Expenses" };
  }).filter((x) => x.date || x.description || x.amount > 0);
}

function parseSuppliers(rows: string[][]) {
  return rows.slice(1).map((r) => ({ date: normDate(r[0]), category: "Supplier Invoice Cost", description: txt(r[1]), amount: num(r[10]), paymentMethod: "", reference: txt(r[3]) || txt(r[2]), relatedSalesRefNo: "", payee: txt(r[1]), notes: txt(r[11]), source: "Supplier_Invoice_Costs" })).filter((x) => x.date || x.description || x.amount > 0);
}

function attachExpenses(sales: any[], expenses: any[]) {
  const byRef = new Map<string, number>();
  expenses.forEach((e) => { const r = txt(e.relatedSalesRefNo).toLowerCase(); if (r && e.amount > 0) byRef.set(r, (byRef.get(r) || 0) + e.amount); });
  return sales.map((s) => { const linked = [s.salesRefNo, s.groupRef, s.saleId, s.key].map((x) => txt(x).toLowerCase()).filter(Boolean).reduce((sum, r) => sum + (byRef.get(r) || 0), 0); return { ...s, linkedExpensesPhp: linked, netProfitPhp: s.grossProfitPhp - linked }; });
}

function byMethod(entries: Array<{ method: string; amount: number }>) {
  const m = new Map<string, number>(); entries.forEach((e) => m.set(e.method || "Unspecified", (m.get(e.method || "Unspecified") || 0) + e.amount));
  return Array.from(m.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}
function byCategory(entries: Array<{ category: string; amount: number }>) {
  const m = new Map<string, number>(); entries.forEach((e) => m.set(e.category || "Uncategorized", (m.get(e.category || "Uncategorized") || 0) + e.amount));
  return Array.from(m.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function dailyTrend(sales: any[], expenses: any[], initial: any[], follow: any[]) {
  const days = new Map<string, any>();
  const get = (date: string) => { if (!days.has(date)) days.set(date, { date, sales: 0, productSubtotal: 0, deliveryFee: 0, installationFee: 0, otherCharge: 0, discount: 0, tax: 0, collections: 0, cashReceived: 0, changeGiven: 0, expenses: 0, linkedExpenses: 0, grossProfit: 0, netProfit: 0, receivables: 0 }); return days.get(date); };
  sales.forEach((s) => { const d = get(s.saleDate); d.sales += s.totalSalePhp; d.productSubtotal += s.productSubtotalPhp; d.deliveryFee += s.deliveryFeePhp; d.installationFee += s.installationFeePhp; d.otherCharge += s.otherChargePhp; d.discount += s.discountPhp; d.tax += s.taxAmountPhp; d.grossProfit += s.grossProfitPhp; d.linkedExpenses += s.linkedExpensesPhp || 0; d.receivables += s.balancePhp; });
  expenses.forEach((e) => { get(e.date).expenses += e.amount; });
  [...initial, ...follow].forEach((e) => { const d = get(e.date); d.collections += e.amount; d.cashReceived += e.tenderedAmount ?? e.amount; d.changeGiven += e.changeDue || 0; });
  return Array.from(days.values()).map((d) => ({ ...d, netProfit: d.grossProfit - d.expenses })).sort((a, b) => a.date.localeCompare(b.date));
}

function productMovement(rows: string[][], start: string, end: string) {
  const m = new Map<string, any>();
  rows.slice(1).forEach((r) => {
    if (!finalSale(r[20]) || !inRange(r[0], start, end)) return;
    const description = txt(r[3]); const specification = txt(r[4]); if (!description && !specification) return;
    const k = `${description}|||${specification}`; const current = m.get(k) || { description, specification, qty: 0, confirmedQty: 0, totalSalePhp: 0, grossProfitPhp: 0 };
    current.qty += num(r[5]); current.confirmedQty += num(r[5]); current.totalSalePhp += num(r[28] || r[7]); current.grossProfitPhp += num(r[10]); m.set(k, current);
  });
  return Array.from(m.values()).sort((a, b) => b.totalSalePhp - a.totalSalePhp);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const p = period(url.searchParams.get("mode") || "daily", url.searchParams.get("date") || today());
    const client = await auth.getClient(); const sheets = google.sheets({ version: "v4", auth: client as any });
    const [salesRows, paymentRows, expenseRows, supplierRows] = await Promise.all([read(sheets, `${SALES_SHEET}!A:AJ`), read(sheets, `${PAYMENTS_SHEET}!A:L`), read(sheets, `${EXPENSES_SHEET}!A:Z`), read(sheets, `${SUPPLIER_COSTS_SHEET}!A:L`)]);
    const allExpenses = [...parseExpenses(expenseRows), ...parseSuppliers(supplierRows)];
    const saleSummaries = attachExpenses(salesSummary(salesRows, paymentRows), allExpenses);
    const periodSales = saleSummaries.filter((s) => inRange(s.saleDate, p.startDate, p.endDate));
    const periodExpenses = allExpenses.filter((e) => inRange(e.date, p.startDate, p.endDate));
    const initial = periodSales.filter((s) => s.initialPaidPhp > 0 || s.initialTenderedPhp > 0).map((s) => ({ date: s.saleDate, method: s.initialPaymentMethod || "Unspecified", amount: s.initialPaidPhp, tenderedAmount: s.initialTenderedPhp || s.initialPaidPhp, changeDue: s.initialChangeDuePhp || 0 }));
    const follow = paymentRows.slice(1).filter((r) => inRange(r[0], p.startDate, p.endDate)).map((r) => ({ date: normDate(r[0]), method: txt(r[4]) || "Unspecified", amount: num(r[5]), tenderedAmount: num(r[5]), changeDue: 0 })).filter((r) => r.amount > 0);
    const sum = (arr: any[], f: string) => arr.reduce((a, x) => a + (Number(x[f]) || 0), 0);
    const collections = sum(initial, "amount") + sum(follow, "amount");
    const cashReceived = [...initial, ...follow].reduce((a, x) => a + (x.tenderedAmount ?? x.amount), 0);
    const changeGiven = [...initial, ...follow].reduce((a, x) => a + (x.changeDue || 0), 0);
    const expensesTotal = sum(periodExpenses, "amount"); const grossProfit = sum(periodSales, "grossProfitPhp");
    return NextResponse.json({ reportDate: url.searchParams.get("date") || today(), mode: p.mode, startDate: p.startDate, endDate: p.endDate, summary: { productSubtotalPhp: sum(periodSales, "productSubtotalPhp"), deliveryFeePhp: sum(periodSales, "deliveryFeePhp"), installationFeePhp: sum(periodSales, "installationFeePhp"), otherChargePhp: sum(periodSales, "otherChargePhp"), discountPhp: sum(periodSales, "discountPhp"), taxAmountPhp: sum(periodSales, "taxAmountPhp"), grandTotalPhp: sum(periodSales, "totalSalePhp"), totalSalesToday: sum(periodSales, "totalSalePhp"), confirmedSalesToday: sum(periodSales, "totalSalePhp"), grossProfitToday: grossProfit, expensesToday: expensesTotal, linkedExpensesToday: sum(periodSales, "linkedExpensesPhp"), unlinkedExpensesToday: periodExpenses.filter((e) => !txt(e.relatedSalesRefNo)).reduce((a, e) => a + e.amount, 0), netProfitToday: grossProfit - expensesTotal, initialCollectionsToday: sum(initial, "amount"), followUpCollectionsToday: sum(follow, "amount"), collectionsToday: collections, cashReceivedToday: cashReceived, changeGivenToday: changeGiven, netCashAfterChangeToday: cashReceived - changeGiven, newReceivablesToday: sum(periodSales, "balancePhp"), endingReceivables: sum(saleSummaries, "balancePhp"), dailySaleCount: periodSales.length, paymentStatusCounts: periodSales.reduce((a: Record<string, number>, s) => { a[s.paymentStatus] = (a[s.paymentStatus] || 0) + 1; return a; }, {}) }, accountingBreakdown: { productSubtotalPhp: sum(periodSales, "productSubtotalPhp"), deliveryFeePhp: sum(periodSales, "deliveryFeePhp"), installationFeePhp: sum(periodSales, "installationFeePhp"), otherChargePhp: sum(periodSales, "otherChargePhp"), discountPhp: sum(periodSales, "discountPhp"), taxAmountPhp: sum(periodSales, "taxAmountPhp"), grandTotalPhp: sum(periodSales, "totalSalePhp"), grossProfitPhp: grossProfit, linkedExpensesPhp: sum(periodSales, "linkedExpensesPhp"), totalExpensesPhp: expensesTotal, netProfitPhp: grossProfit - expensesTotal }, collectionsByMethod: byMethod([...initial, ...follow]), cashByMethod: byMethod([...initial, ...follow].map((x) => ({ method: x.method, amount: x.tenderedAmount ?? x.amount }))), expensesByCategory: byCategory(periodExpenses), dailyTrend: dailyTrend(periodSales, periodExpenses, initial, follow), productMovement: productMovement(salesRows, p.startDate, p.endDate), dailySales: periodSales.map((s) => ({ saleDate: s.saleDate, salesRefNo: s.salesRefNo, customerName: s.customerName, customerId: s.customerId, productSubtotalPhp: s.productSubtotalPhp, deliveryFeePhp: s.deliveryFeePhp, installationFeePhp: s.installationFeePhp, otherChargePhp: s.otherChargePhp, discountPhp: s.discountPhp, taxAmountPhp: s.taxAmountPhp, totalSalePhp: s.totalSalePhp, grandTotalPhp: s.totalSalePhp, totalPaidPhp: s.totalPaidPhp, tenderedAmountPhp: s.totalTenderedPhp, changeDuePhp: s.changeDuePhp, netCollectionPhp: s.netCollectionPhp, balancePhp: s.balancePhp, grossProfitPhp: s.grossProfitPhp, linkedExpensesPhp: s.linkedExpensesPhp || 0, netProfitPhp: s.netProfitPhp, paymentStatus: s.paymentStatus, saleStatus: s.saleStatus })), dailyExpenses: periodExpenses, linkedExpenses: periodExpenses.filter((e) => txt(e.relatedSalesRefNo)), openReceivables: saleSummaries.filter((s) => s.balancePhp > 0).map((s) => ({ saleDate: s.saleDate, salesRefNo: s.salesRefNo, customerName: s.customerName, totalSalePhp: s.totalSalePhp, totalPaidPhp: s.totalPaidPhp, tenderedAmountPhp: s.totalTenderedPhp, changeDuePhp: s.changeDuePhp, balancePhp: s.balancePhp, paymentStatus: s.paymentStatus, saleStatus: s.saleStatus })) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load reports" }, { status: 500 });
  }
}
