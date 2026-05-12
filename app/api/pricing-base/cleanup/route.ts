import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Pricing_Base";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const HEADERS = [
  "Item ID","Description","Specification","Category","Unit","Cost Price (USD)","FX Rate",
  "Cost Price (PHP)","Selling Price (PHP)","Dealer Price (PHP)","Minimum Price (PHP)",
  "Gross Margin %","Status","Notes",
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function isValidPricingRow(row: string[]) {
  const itemId = String(row[0] || "").trim();
  const description = String(row[1] || "").trim();
  const specification = String(row[2] || "").trim();
  const category = String(row[3] || "").trim();
  const costPriceUsd = toNumber(row[5]);
  const fxRate = toNumber(row[6]);

  if (!itemId || itemId.toLowerCase() === "item id") return false;
  if (!description || !specification) return false;
  if (description === "Description") return false;
  if (specification === "Specification") return false;
  if (category === "Dealer Price (PHP)" || category === "Category") return false;
  if (description.includes("Selling prices are in PHP")) return false;
  if (specification === "Default Sale Price (PHP)") return false;
  if (costPriceUsd === 0 && fxRate === 0) return false;
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
      range: `${SHEET_NAME}!A:N`,
    });

    const rows = (response.data.values || []) as string[][];
    const cleaned = rows.slice(1).filter(isValidPricingRow);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:N${cleaned.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS, ...cleaned] },
    });

    return NextResponse.json({
      ok: true,
      removedRows: Math.max(0, rows.length - 1 - cleaned.length),
      keptRows: cleaned.length,
    });
  } catch (error: any) {
    console.error("PRICING CLEANUP ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to clean pricing sheet" },
      { status: 500 }
    );
  }
}
