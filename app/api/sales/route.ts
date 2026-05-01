import { NextResponse } from "next/server";
import { google, sheets_v4 } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PRICING_SHEET = "Pricing_Base";

type SheetCell = string | number | boolean | null | undefined;
type SheetRow = SheetCell[];

type SalesRequestBody = {
  saleDate?: unknown;
  salesRefNo?: unknown;
  customerName?: unknown;
  description?: unknown;
  specification?: unknown;
  qty?: unknown;
  unitPricePhp?: unknown;
  paymentStatus?: unknown;
  salesperson?: unknown;
  notes?: unknown;
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SALES_HEADERS = [
  "Sale Date",
  "Sales Ref No.",
  "Customer Name",
  "Description",
  "Specification",
  "Qty",
  "Manual Unit Price (PHP)",
  "Total Sale (PHP)",
  "Cost Price (PHP)",
  "Total Cost (PHP)",
  "Gross Profit (PHP)",
  "Payment Status",
  "Salesperson",
  "Notes",
];

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth });
}

async function ensureSheetExists(sheets: sheets_v4.Sheets, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((sheet) => sheet.properties?.title === title);
  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
}

async function getPricingMap(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${PRICING_SHEET}!A:N`,
  });
  const rows = (response.data.values || []) as SheetRow[];
  const map = new Map<string, number>();
  rows.slice(1).forEach((row: SheetRow) => {
    const key = `${String(row[1] || "").trim()}|||${String(row[2] || "").trim()}`;
    const costPhp = toNumber(row[7]);
    if (key !== "|||") map.set(key, costPhp);
  });
  return map;
}

export async function GET() {
  try {
    const sheets = getSheetsClient();
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SALES_SHEET}!A:N`,
    });

    const rows = (response.data.values || []) as SheetRow[];
    const data = rows
      .slice(1)
      .filter((row: SheetRow) => row.some((cell: SheetCell) => String(cell || "").trim() !== ""));

    const items = data.map((row: SheetRow, index: number) => ({
      rowNumber: index + 2,
      saleDate: String(row[0] || ""),
      salesRefNo: String(row[1] || ""),
      customerName: String(row[2] || ""),
      description: String(row[3] || ""),
      specification: String(row[4] || ""),
      qty: toNumber(row[5]),
      unitPricePhp: toNumber(row[6]),
      totalSalePhp: toNumber(row[7]),
      costPricePhp: toNumber(row[8]),
      totalCostPhp: toNumber(row[9]),
      grossProfitPhp: toNumber(row[10]),
      paymentStatus: String(row[11] || "Pending"),
      salesperson: String(row[12] || ""),
      notes: String(row[13] || ""),
    }));

    return NextResponse.json(items);
  } catch (error: unknown) {
    console.error("SALES GET ERROR:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load sales") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SalesRequestBody;
    const saleDate = String(body?.saleDate || "").trim();
    const salesRefNo = String(body?.salesRefNo || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const description = String(body?.description || "").trim();
    const specification = String(body?.specification || "").trim();
    const qty = toNumber(body?.qty);
    const unitPricePhp = toNumber(body?.unitPricePhp);
    const paymentStatus = String(body?.paymentStatus || "Pending").trim();
    const salesperson = String(body?.salesperson || "").trim();
    const notes = String(body?.notes || "").trim();

    if (!saleDate || !customerName || !description || !specification || !qty) {
      return NextResponse.json({ error: "Sale Date, Customer, Description, Specification, and Qty are required" }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);

    const pricingMap = await getPricingMap(sheets);
    const key = `${description}|||${specification}`;
    const costPricePhp = pricingMap.get(key) || 0;
    const totalSalePhp = qty * unitPricePhp;
    const totalCostPhp = qty * costPricePhp;
    const grossProfitPhp = totalSalePhp - totalCostPhp;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SALES_SHEET}!A:N`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          saleDate,
          salesRefNo,
          customerName,
          description,
          specification,
          qty,
          unitPricePhp,
          totalSalePhp,
          costPricePhp,
          totalCostPhp,
          grossProfitPhp,
          paymentStatus,
          salesperson,
          notes,
        ]],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("SALES POST ERROR:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save sale") }, { status: 500 });
  }
}
