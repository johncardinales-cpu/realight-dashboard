import { NextResponse } from "next/server";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DELIVERIES_SHEET = "App_Deliveries";
const SALES_SHEET = "Sales";
const EXPENSES_SHEET = "Expenses";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";
const READ_CACHE_MS = 15000;

type DashboardPayload = {
  incomingUnits: number;
  warehouseReceived: number;
  actualOnHand: number;
  sellableUnits: number;
  totalSales: number;
  totalExpenses: number;
  netGain: number;
};

let readCache: { expiresAt: number; data: DashboardPayload } | null = null;

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function isQuotaError(error: any) {
  const message = String(error?.message || error?.response?.data?.error?.message || error || "").toLowerCase();
  return message.includes("quota") || message.includes("read requests per minute") || message.includes("rate limit");
}

function isConfirmedSale(row: string[]) {
  return text(row[20]).toLowerCase() === "confirmed";
}

function parseExpenseRows(rows: string[][]) {
  if (!rows.length) return 0;
  const header = rows[0].map(text);
  return rows.slice(1).reduce((sum, row) => {
    const map: Record<string, string> = {};
    header.forEach((name, index) => { map[name] = text(row[index]); });
    return sum + toNumber(map["Total Amount"] || map["Amount"] || map["Total"] || map["Expense Amount"]);
  }, 0);
}

function buildDashboardPayload(deliveryRows: string[][], salesRows: string[][], expenseRows: string[][], supplierRows: string[][]): DashboardPayload {
  let incomingUnits = 0;
  let warehouseReceived = 0;
  let actualOnHand = 0;
  let sellableUnits = 0;

  deliveryRows.slice(1).forEach((row) => {
    if (!row.some((cell) => text(cell))) return;
    const qty = toNumber(row[6]);
    const status = text(row[9]).toLowerCase();
    if (status === "incoming") incomingUnits += qty;
    else if (status === "received") warehouseReceived += qty;
    else if (status === "available") {
      actualOnHand += qty;
      sellableUnits += qty;
    }
  });

  let totalSales = 0;
  let grossProfit = 0;
  let confirmedQtyOut = 0;

  salesRows.slice(1).forEach((row) => {
    if (!isConfirmedSale(row)) return;
    totalSales += toNumber(row[28] || row[7]);
    grossProfit += toNumber(row[10]);
    confirmedQtyOut += toNumber(row[5]);
  });

  const manualExpenses = parseExpenseRows(expenseRows);
  const supplierExpenses = supplierRows.slice(1).reduce((sum, row) => sum + toNumber(row[10]), 0);
  const totalExpenses = manualExpenses + supplierExpenses;

  actualOnHand = Math.max(actualOnHand - confirmedQtyOut, 0);
  sellableUnits = Math.max(sellableUnits - confirmedQtyOut, 0);

  return {
    incomingUnits,
    warehouseReceived,
    actualOnHand,
    sellableUnits,
    totalSales,
    totalExpenses,
    netGain: grossProfit - totalExpenses,
  };
}

async function readDashboardData() {
  const now = Date.now();
  if (readCache && readCache.expiresAt > now) return readCache.data;
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: [
      `${DELIVERIES_SHEET}!A:L`,
      `${SALES_SHEET}!A:AJ`,
      `${EXPENSES_SHEET}!A:Z`,
      `${SUPPLIER_COSTS_SHEET}!A:L`,
    ],
  });
  const deliveryRows = (response.data.valueRanges?.[0]?.values || []) as string[][];
  const salesRows = (response.data.valueRanges?.[1]?.values || []) as string[][];
  const expenseRows = (response.data.valueRanges?.[2]?.values || []) as string[][];
  const supplierRows = (response.data.valueRanges?.[3]?.values || []) as string[][];
  const data = buildDashboardPayload(deliveryRows, salesRows, expenseRows, supplierRows);
  readCache = { expiresAt: now + READ_CACHE_MS, data };
  return data;
}

export async function GET() {
  try {
    const data = await readDashboardData();
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "private, max-age=10");
    response.headers.set("X-Realights-Read-Cache", readCache && readCache.expiresAt > Date.now() ? "hit" : "miss");
    return response;
  } catch (error: any) {
    console.error("DASHBOARD API ERROR:", error);
    if (isQuotaError(error)) return NextResponse.json({ error: "Google Sheets is temporarily rate-limiting dashboard reads. Please wait 30 to 60 seconds, then refresh once." }, { status: 429 });
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load dashboard data" }, { status: 500 });
  }
}
