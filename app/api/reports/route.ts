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

function sameDate(value: string, targetDate: string) {
  return safeText(value).slice(0, 10) === targetDate;
}

function getPaymentStatus(totalPaid: number, totalSale: number) {
  if (totalSale <= 0) return "Pending";
  if (totalPaid <= 0) return "Pending";
  if (totalPaid >= totalSale) return "Paid";
  return "Partial";
}

function saleKey(salesRefNo: string, groupRef: string) {
  return groupRef || salesRefNo;
}

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
    .catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

function buildPaymentLedgerTotals(paymentRows: string[][]) {
  const byKey = new Map<string, number>();
  const byDate = new Map<string, number>();
  const byMethod = new Map<string, number>();
  let totalLedgerPayments = 0;

  paymentRows.slice(1).forEach((row) => {
    const paymentDate = safeText(row[0]);
    const salesRefNo = safeText(row[1]);
    const groupRef = safeText(row[2]);
    const paymentMethod = safeText(row[4]) || "Unspecified";
    const amount = toNumber(row[5]);
    const key = saleKey(salesRefNo, groupRef);

    if (!key || amount <= 0) return;

    byKey.set(key, (byKey.get(key) || 0) + amount);
    totalLedgerPayments += amount;

    if (paymentDate) byDate.set(paymentDate.slice(0, 10), (byDate.get(paymentDate.slice(0, 10)) || 0) + amount);
    byMethod.set(paymentMethod, (byMethod.get(paymentMethod) || 0) + amount);
  });

  return { byKey, byDate, byMethod, totalLedgerPayments };
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const paymentLedger = buildPaymentLedgerTotals(paymentRows);
  const map = new Map<string, any>();

  salesRows.slice(1).forEach((row) => {
    const saleDate = safeText(row[0]);
    const salesRefNo = safeText(row[1]);
    const customerName = safeText(row[2]);
    const groupRef = safeText(row[14]);
    const key = saleKey(salesRefNo, groupRef);
    const totalSalePhp = toNumber(row[7]);
    const grossProfitPhp = toNumber(row[10]);
    const initialPaidPhp = toNumber(row[16]);
    const paymentMethod = safeText(row[15]) || "Unspecified";
    const saleStatus = safeText(row[20]) || "Draft";

    if (!key || !saleDate || !customerName || totalSalePhp <= 0) return;

    const current = map.get(key) || {
      key,
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
    const followUpPaidPhp = paymentLedger.byKey.get(sale.key) || 0;
    const totalPaidPhp = sale.initialPaidPhp + followUpPaidPhp;
    const balancePhp = Math.max(sale.totalSalePhp - totalPaidPhp, 0);

    return {
      ...sale,
      followUpPaidPhp,
      totalPaidPhp,
      balancePhp,
      paymentStatus: getPaymentStatus(totalPaidPhp, sale.totalSalePhp),
    };
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

  return Array.from(map.entries())
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reportDate = url.searchParams.get("date") || today();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const [salesRows, paymentRows, expenseRows, supplierRows] = await Promise.all([
      readRange(sheets, `${SALES_SHEET}!A:V`),
      readRange(sheets, `${PAYMENTS_SHEET}!A:J`),
      readRange(sheets, `${EXPENSES_SHEET}!A:Z`),
      readRange(sheets, `${SUPPLIER_COSTS_SHEET}!A:L`),
    ]);

    const saleSummaries = buildSaleSummaries(salesRows, paymentRows);
    const dailySales = saleSummaries.filter((sale) => sameDate(sale.saleDate, reportDate));
    const allExpenses = [...parseExpenseRows(expenseRows), ...parseSupplierRows(supplierRows)];
    const dailyExpenses = allExpenses.filter((expense) => sameDate(expense.date, reportDate));

    const initialCollectionsToday = dailySales
      .filter((sale) => sale.initialPaidPhp > 0)
      .map((sale) => ({ method: sale.initialPaymentMethod || "Unspecified", amount: sale.initialPaidPhp }));

    const followUpCollectionsToday = paymentRows.slice(1)
      .filter((row) => sameDate(safeText(row[0]), reportDate))
      .map((row) => ({ method: safeText(row[4]) || "Unspecified", amount: toNumber(row[5]) }))
      .filter((row) => row.amount > 0);

    const totalSalesToday = dailySales.reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const confirmedSalesToday = dailySales.filter((sale) => sale.saleStatus.toLowerCase() === "confirmed").reduce((sum, sale) => sum + sale.totalSalePhp, 0);
    const grossProfitToday = dailySales.reduce((sum, sale) => sum + sale.grossProfitPhp, 0);
    const expensesToday = dailyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const initialCollectionsTotal = initialCollectionsToday.reduce((sum, entry) => sum + entry.amount, 0);
    const followUpCollectionsTotal = followUpCollectionsToday.reduce((sum, entry) => sum + entry.amount, 0);
    const collectionsToday = initialCollectionsTotal + followUpCollectionsTotal;
    const endingReceivables = saleSummaries.reduce((sum, sale) => sum + sale.balancePhp, 0);
    const newReceivablesToday = dailySales.reduce((sum, sale) => sum + sale.balancePhp, 0);

    const paymentStatusCounts = dailySales.reduce((acc: Record<string, number>, sale) => {
      acc[sale.paymentStatus] = (acc[sale.paymentStatus] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      reportDate,
      summary: {
        totalSalesToday,
        confirmedSalesToday,
        grossProfitToday,
        expensesToday,
        netProfitToday: grossProfitToday - expensesToday,
        initialCollectionsToday: initialCollectionsTotal,
        followUpCollectionsToday: followUpCollectionsTotal,
        collectionsToday,
        newReceivablesToday,
        endingReceivables,
        dailySaleCount: dailySales.length,
        paymentStatusCounts,
      },
      collectionsByMethod: summarizeMethodBreakdown([...initialCollectionsToday, ...followUpCollectionsToday]),
      dailySales: dailySales.map((sale) => ({
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
      dailyExpenses,
      openReceivables: saleSummaries
        .filter((sale) => sale.balancePhp > 0)
        .sort((a, b) => b.balancePhp - a.balancePhp)
        .map((sale) => ({
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
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load reports" },
      { status: 500 }
    );
  }
}
