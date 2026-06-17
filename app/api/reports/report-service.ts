import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES = "Sales!A:AJ";
const PAYMENTS = "Payments!A:O";
const EXPENSES = "Expenses!A:Z";
const SUPPLIERS = "Supplier_Invoice_Costs!A:L";
const AUDIT_LOG = "Audit_Log!A:J";
const CACHE_MS = 15000;

let cache: { key: string; time: number; data: any } | null = null;

const txt = (v: unknown) => String(v || "").trim();
const num = (v: unknown) => Number(String(v || "").replace(/[^0-9.-]/g, "")) || 0;
const round = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const inactive = (v: unknown) => ["voided", "cancelled", "canceled"].includes(txt(v).toLowerCase());
const confirmed = (v: unknown) => txt(v).toLowerCase() === "confirmed";
const uniq = (arr: string[]) => Array.from(new Set(arr.map(txt).filter(Boolean)));
const saleKey = (ref: string, group: string, id?: string) => txt(id) || txt(group) || txt(ref);
const payStatus = (paid: number, total: number) => total <= 0 || paid <= 0 ? "Pending" : paid + 0.009 >= total ? "Paid" : "Partial";

function pad(n: number) { return String(n).padStart(2, "0"); }
function localDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function today() { return localDate(new Date()); }

function normDate(v: unknown) {
  const s = txt(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [m, d, y0] = s.split("/").map(Number);
    const y = y0 < 100 ? 2000 + y0 : y0;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s.slice(0, 10) : localDate(parsed);
}

function toDate(v: string) {
  const [y, m, d] = normDate(v).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
}

function period(mode: string, value: string) {
  const m = ["daily", "weekly", "monthly"].includes(mode) ? mode : "daily";
  const start = toDate(value || today());
  const end = new Date(start);
  if (m === "weekly") {
    const off = start.getDay() === 0 ? -6 : 1 - start.getDay();
    start.setDate(start.getDate() + off);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  }
  if (m === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1, 0);
  }
  return { mode: m, startDate: localDate(start), endDate: localDate(end) };
}

function inRange(v: unknown, start: string, end: string) {
  const d = normDate(v);
  return d >= start && d <= end;
}

function safeJson(raw: unknown) {
  try { return JSON.parse(txt(raw) || "{}"); } catch { return {}; }
}

async function batchRead() {
  const sheets = await getSheetsClient();
  const ranges = [SALES, PAYMENTS, EXPENSES, SUPPLIERS, AUDIT_LOG];
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges });
  return ranges.map((_, index) => (res.data.valueRanges?.[index]?.values || []) as string[][]);
}

function paymentMap(paymentRows: string[][]) {
  const m = new Map<string, number>();
  paymentRows.slice(1).forEach((r) => {
    if (inactive(r[12]) || num(r[5]) <= 0) return;
    const amount = num(r[5]);
    uniq([saleKey(r[1], r[2], r[11]), txt(r[11]), txt(r[2]), txt(r[1])]).forEach((k) => m.set(k, round((m.get(k) || 0) + amount)));
  });
  return m;
}

function followPaid(map: Map<string, number>, sale: any) {
  for (const k of uniq([sale.saleId, sale.groupRef, sale.salesRefNo, sale.key])) if (map.has(k)) return map.get(k) || 0;
  return 0;
}

function parseSales(rows: string[][], paymentRows: string[][]) {
  const follow = paymentMap(paymentRows);
  const grouped = new Map<string, any>();
  rows.slice(1).forEach((r) => {
    const saleStatus = txt(r[20]) || "Draft";
    const paymentStatus = txt(r[11]) || "Pending";
    if (!confirmed(saleStatus) || inactive(saleStatus) || inactive(paymentStatus)) return;
    const salesRefNo = txt(r[1]);
    const groupRef = txt(r[14]);
    const saleId = txt(r[22]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const total = num(r[28] || r[7]);
    if (!key || total <= 0) return;
    const cur = grouped.get(key) || { key, saleId, saleDate: normDate(r[0]), salesRefNo, groupRef, customerName: txt(r[2]), customerId: txt(r[33]), productSubtotalPhp: 0, deliveryFeePhp: 0, installationFeePhp: 0, otherChargePhp: 0, discountPhp: 0, taxAmountPhp: 0, totalSalePhp: 0, grossProfitPhp: 0, salesPaid: 0, salesBalance: 0, tendered: 0, changeDuePhp: 0, initialPaymentMethod: txt(r[15]) || "Unspecified", linkedExpensesPhp: 0, saleStatus };
    const linePaid = num(r[16]);
    cur.productSubtotalPhp += num(r[25] || r[7]);
    cur.deliveryFeePhp += num(r[29]);
    cur.installationFeePhp += num(r[30]);
    cur.otherChargePhp += num(r[31]);
    cur.discountPhp += num(r[32]);
    cur.taxAmountPhp += num(r[27]);
    cur.totalSalePhp += total;
    cur.grossProfitPhp += num(r[10]);
    cur.salesPaid += linePaid;
    cur.salesBalance += num(r[17]);
    cur.tendered += num(r[34]) > 0 ? num(r[34]) : linePaid;
    cur.changeDuePhp += num(r[35]);
    grouped.set(key, cur);
  });
  return Array.from(grouped.values()).map((s) => {
    const followUpPaidPhp = followPaid(follow, s);
    const paidByBalance = round(Math.max(s.totalSalePhp - Math.max(s.salesBalance, 0), 0));
    const totalPaidPhp = round(Math.min(Math.max(paidByBalance, s.salesPaid, s.salesPaid + followUpPaidPhp), s.totalSalePhp));
    const balancePhp = round(Math.max(s.totalSalePhp - totalPaidPhp, 0));
    const initialPaidPhp = round(Math.max(totalPaidPhp - followUpPaidPhp, 0));
    const initialTenderedPhp = s.changeDuePhp > 0 ? round(Math.max(s.tendered - followUpPaidPhp, initialPaidPhp)) : initialPaidPhp;
    const totalTenderedPhp = round(initialTenderedPhp + followUpPaidPhp);
    return { ...s, initialPaidPhp, initialTenderedPhp, followUpPaidPhp, totalPaidPhp, tenderedAmountPhp: totalTenderedPhp, totalTenderedPhp, balancePhp, paymentStatus: payStatus(totalPaidPhp, s.totalSalePhp), netCollectionPhp: round(totalTenderedPhp - s.changeDuePhp), netProfitPhp: s.grossProfitPhp };
  });
}

function parseExpenses(rows: string[][]) {
  const headers = rows[0]?.map(txt) || [];
  return rows.slice(1).map((r) => {
    const m: Record<string, string> = {};
    headers.forEach((h, i) => { m[h] = txt(r[i]); });
    return { date: normDate(m["Expense Date"] || m.Date || m["Upload Date"]), category: m.Category || "General Expense", description: m.Description || m.Expense || "", amount: num(m["Total Amount"] || m.Amount || m.Total || m["Expense Amount"]), source: "Expenses", relatedSalesRefNo: m["Related Sales Ref No."] || "" };
  }).filter((e) => e.date || e.description || e.amount > 0);
}

function parseSuppliers(rows: string[][]) {
  return rows.slice(1).map((r) => ({ date: normDate(r[0]), category: "Supplier Invoice Cost", description: txt(r[1]), amount: num(r[10]), source: "Supplier_Invoice_Costs", relatedSalesRefNo: "" })).filter((e) => e.date || e.description || e.amount > 0);
}

function paymentSignature(date: string, amount: number) {
  return `${date}|${round(amount).toFixed(2)}`;
}

function parseAuditPaymentCollections(auditRows: string[][], paymentRows: string[][]) {
  const ledgerCounts = new Map<string, number>();
  paymentRows.slice(1).forEach((r) => {
    if (inactive(r[12]) || num(r[5]) <= 0) return;
    const key = paymentSignature(normDate(r[0]), num(r[5]));
    ledgerCounts.set(key, (ledgerCounts.get(key) || 0) + 1);
  });

  const entries: any[] = [];
  auditRows.slice(1).forEach((r) => {
    const action = txt(r[3]).toLowerCase();
    if (action !== "create_payment" && !(action.includes("create") && action.includes("payment"))) return;
    const date = normDate(r[1]);
    const before = safeJson(r[8]);
    const after = safeJson(r[9]);
    const summary = txt(r[7]);
    const amountFromDiff = round(num(after.totalPaidPhp) - num(before.totalPaidPhp));
    const amountFromText = num(summary.match(/recorded payment\s+([0-9,.]+)/i)?.[1]);
    const amount = round(amountFromDiff > 0 ? amountFromDiff : amountFromText);
    if (!date || amount <= 0) return;
    const signature = paymentSignature(date, amount);
    const matchedLedgerCount = ledgerCounts.get(signature) || 0;
    if (matchedLedgerCount > 0) {
      ledgerCounts.set(signature, matchedLedgerCount - 1);
      return;
    }
    entries.push({ date, method: txt(after.paymentMethod) || "Payment", amount, tenderedAmount: amount, changeDue: 0, source: "Audit_Log", recordRef: txt(r[5]) });
  });
  return entries;
}

function attachExpenses(sales: any[], expenses: any[]) {
  const m = new Map<string, number>();
  expenses.forEach((e) => { const ref = txt(e.relatedSalesRefNo).toLowerCase(); if (ref) m.set(ref, (m.get(ref) || 0) + e.amount); });
  return sales.map((s) => {
    const linked = uniq([s.salesRefNo, s.groupRef, s.saleId, s.key]).map((x) => x.toLowerCase()).reduce((a, k) => a + (m.get(k) || 0), 0);
    return { ...s, linkedExpensesPhp: linked, netProfitPhp: s.grossProfitPhp - linked };
  });
}

function byMethod(entries: any[]) {
  const m = new Map<string, number>();
  entries.forEach((e) => m.set(e.method || "Unspecified", (m.get(e.method || "Unspecified") || 0) + e.amount));
  return Array.from(m.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

function byCategory(entries: any[]) {
  const m = new Map<string, number>();
  entries.forEach((e) => m.set(e.category || "Uncategorized", (m.get(e.category || "Uncategorized") || 0) + e.amount));
  return Array.from(m.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function dailyTrend(sales: any[], expenses: any[], collections: any[]) {
  const days = new Map<string, any>();
  const get = (date: string) => {
    if (!days.has(date)) days.set(date, { date, sales: 0, collections: 0, cashReceived: 0, changeGiven: 0, expenses: 0, grossProfit: 0, netProfit: 0, receivables: 0 });
    return days.get(date);
  };
  sales.forEach((s) => { const d = get(s.saleDate); d.sales += s.totalSalePhp; d.grossProfit += s.grossProfitPhp; d.receivables += s.balancePhp; });
  expenses.forEach((e) => { get(e.date).expenses += e.amount; });
  collections.forEach((c) => { const d = get(c.date); d.collections += c.amount; d.cashReceived += c.tenderedAmount ?? c.amount; d.changeGiven += c.changeDue || 0; });
  return Array.from(days.values()).map((d) => ({ ...d, netProfit: d.grossProfit - d.expenses })).sort((a, b) => a.date.localeCompare(b.date));
}

function productMovement(rows: string[][], start: string, end: string) {
  const m = new Map<string, any>();
  rows.slice(1).forEach((r) => {
    if (!confirmed(r[20]) || inactive(r[20]) || inactive(r[11]) || !inRange(r[0], start, end)) return;
    const description = txt(r[3]);
    const specification = txt(r[4]);
    const key = `${description}|||${specification}`;
    const cur = m.get(key) || { description, specification, qty: 0, confirmedQty: 0, totalSalePhp: 0, grossProfitPhp: 0 };
    cur.qty += num(r[5]); cur.confirmedQty += num(r[5]); cur.totalSalePhp += num(r[28] || r[7]); cur.grossProfitPhp += num(r[10]);
    m.set(key, cur);
  });
  return Array.from(m.values()).sort((a, b) => b.totalSalePhp - a.totalSalePhp);
}

export async function getReportPayload(url: URL) {
  const p = period(url.searchParams.get("mode") || "daily", url.searchParams.get("date") || today());
  const cacheKey = `${p.mode}:${p.startDate}:${p.endDate}`;
  if (cache?.key === cacheKey && Date.now() - cache.time < CACHE_MS) return cache.data;

  const [salesRows, paymentRows, expenseRows, supplierRows, auditRows] = await batchRead();
  const expenses = [...parseExpenses(expenseRows), ...parseSuppliers(supplierRows)];
  const allSales = attachExpenses(parseSales(salesRows, paymentRows), expenses);
  const sales = allSales.filter((s) => inRange(s.saleDate, p.startDate, p.endDate));
  const periodExpenses = expenses.filter((e) => inRange(e.date, p.startDate, p.endDate));
  const initial = sales.filter((s) => s.initialPaidPhp > 0 || s.initialTenderedPhp > 0).map((s) => ({ date: s.saleDate, method: s.initialPaymentMethod, amount: s.initialPaidPhp, tenderedAmount: s.initialTenderedPhp, changeDue: s.changeDuePhp || 0 }));
  const follow = paymentRows.slice(1).filter((r) => !inactive(r[12]) && num(r[5]) > 0 && inRange(r[0], p.startDate, p.endDate)).map((r) => ({ date: normDate(r[0]), method: txt(r[4]) || "Unspecified", amount: num(r[5]), tenderedAmount: num(r[5]), changeDue: 0 }));
  const recoveredFollow = parseAuditPaymentCollections(auditRows, paymentRows).filter((r) => inRange(r.date, p.startDate, p.endDate));
  const collections = [...initial, ...follow, ...recoveredFollow];
  const sum = (arr: any[], field: string) => round(arr.reduce((a, x) => a + (Number(x[field]) || 0), 0));
  const expensesTotal = sum(periodExpenses, "amount");
  const grossProfit = sum(sales, "grossProfitPhp");
  const cashReceived = round(collections.reduce((a, x) => a + (x.tenderedAmount ?? x.amount), 0));
  const changeGiven = sum(collections, "changeDue");
  const summary = {
    productSubtotalPhp: sum(sales, "productSubtotalPhp"), deliveryFeePhp: sum(sales, "deliveryFeePhp"), installationFeePhp: sum(sales, "installationFeePhp"), otherChargePhp: sum(sales, "otherChargePhp"), discountPhp: sum(sales, "discountPhp"), taxAmountPhp: sum(sales, "taxAmountPhp"), grandTotalPhp: sum(sales, "totalSalePhp"), totalSalesToday: sum(sales, "totalSalePhp"), confirmedSalesToday: sum(sales, "totalSalePhp"), grossProfitToday: grossProfit, expensesToday: expensesTotal, linkedExpensesToday: sum(sales, "linkedExpensesPhp"), unlinkedExpensesToday: periodExpenses.filter((e) => !txt(e.relatedSalesRefNo)).reduce((a, e) => a + e.amount, 0), netProfitToday: grossProfit - expensesTotal, initialCollectionsToday: sum(initial, "amount"), followUpCollectionsToday: round(sum(follow, "amount") + sum(recoveredFollow, "amount")), collectionsToday: sum(collections, "amount"), cashReceivedToday: cashReceived, changeGivenToday: changeGiven, netCashAfterChangeToday: cashReceived - changeGiven, newReceivablesToday: sum(sales, "balancePhp"), endingReceivables: sum(allSales, "balancePhp"), dailySaleCount: sales.length, paymentStatusCounts: sales.reduce((a: Record<string, number>, s) => { a[s.paymentStatus] = (a[s.paymentStatus] || 0) + 1; return a; }, {})
  };
  const payload = {
    reportDate: url.searchParams.get("date") || today(), mode: p.mode, startDate: p.startDate, endDate: p.endDate, summary,
    accountingBreakdown: { productSubtotalPhp: summary.productSubtotalPhp, deliveryFeePhp: summary.deliveryFeePhp, installationFeePhp: summary.installationFeePhp, otherChargePhp: summary.otherChargePhp, discountPhp: summary.discountPhp, taxAmountPhp: summary.taxAmountPhp, grandTotalPhp: summary.grandTotalPhp, grossProfitPhp: grossProfit, linkedExpensesPhp: summary.linkedExpensesToday, totalExpensesPhp: expensesTotal, netProfitPhp: grossProfit - expensesTotal },
    collectionsByMethod: byMethod(collections), cashByMethod: byMethod(collections.map((x) => ({ method: x.method, amount: x.tenderedAmount ?? x.amount }))), expensesByCategory: byCategory(periodExpenses), dailyTrend: dailyTrend(sales, periodExpenses, collections), productMovement: productMovement(salesRows, p.startDate, p.endDate), dailySales: sales, dailyExpenses: periodExpenses, linkedExpenses: periodExpenses.filter((e) => txt(e.relatedSalesRefNo)), openReceivables: allSales.filter((s) => s.balancePhp > 0).map((s) => ({ saleDate: s.saleDate, salesRefNo: s.salesRefNo, customerName: s.customerName, totalSalePhp: s.totalSalePhp, totalPaidPhp: s.totalPaidPhp, tenderedAmountPhp: s.totalTenderedPhp, changeDuePhp: s.changeDuePhp, balancePhp: s.balancePhp, paymentStatus: s.paymentStatus, saleStatus: s.saleStatus }))
  };
  cache = { key: cacheKey, time: Date.now(), data: payload };
  return payload;
}
