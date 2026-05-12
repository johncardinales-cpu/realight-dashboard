import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Sales";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const HEADERS = [
  "Sale Date","Sales Ref No.","Customer Name","Description","Specification","Qty",
  "Manual Unit Price (PHP)","Total Sale (PHP)","Cost Price (PHP)","Total Cost (PHP)",
  "Gross Profit (PHP)","Payment Status","Salesperson","Notes","Group Ref",
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function isValidSalesRow(row: string[]) {
  const saleDate = String(row[0] || "").trim();
  const customerName = String(row[2] || "").trim();
  const description = String(row[3] || "").trim();
  const specification = String(row[4] || "").trim();
  const qty = toNumber(row[5]);

  if (!saleDate || saleDate.toLowerCase() === "date") return false;
  if (!customerName || customerName.toLowerCase() === "customer") return false;
  if (!description || description.toLowerCase() === "description") return false;
  if (!specification || specification.toLowerCase() === "specification") return false;
  if (description.includes("One sold item per row")) return false;
  if (qty <= 0) return false;
  return true;
}

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:O`,
    });

    const rows = (response.data.values || []) as string[][];
    const cleaned = rows.slice(1).filter(isValidSalesRow);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:O`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:O${cleaned.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS, ...cleaned] },
    });

    return NextResponse.json({
      ok: true,
      removedRows: Math.max(0, rows.length - 1 - cleaned.length),
      keptRows: cleaned.length,
    });
  } catch (error: any) {
    console.error("SALES CLEANUP ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to clean sales sheet" },
      { status: 500 }
    );
  }
}
