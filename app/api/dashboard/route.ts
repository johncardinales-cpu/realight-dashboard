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

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range }).catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
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

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const [deliveryRows, salesRows, expenseRows, supplierRows] = await Promise.all([
      readRange(sheets, `${DELIVERIES_SHEET}!A:L`),
      readRange(sheets, `${SALES_SHEET}!A:AJ`),
      readRange(sheets, `${EXPENSES_SHEET}!A:Z`),
      readRange(sheets, `${SUPPLIER_COSTS_SHEET}!A:L`),
    ]);

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

    return NextResponse.json({
      incomingUnits,
      warehouseReceived,
      actualOnHand,
      sellableUnits,
      totalSales,
      totalExpenses,
      netGain: grossProfit - totalExpenses,
    });
  } catch (error: any) {
    console.error("DASHBOARD API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load dashboard data" }, { status: 500 });
  }
}
