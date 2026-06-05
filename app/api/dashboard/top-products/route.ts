import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function text(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function isConfirmedSale(row: string[]) {
  return text(row[20]).toLowerCase() === "confirmed";
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` }).catch(() => ({ data: { values: [] } }));
    const rows = (response.data.values || []) as string[][];

    const totals = new Map<string, number>();
    rows.slice(1).forEach((row) => {
      if (!isConfirmedSale(row)) return;
      const product = text(row[3] || row[4] || "Unknown Product");
      const qty = toNumber(row[5]) || 1;
      totals.set(product, (totals.get(product) || 0) + qty);
    });

    const products = Array.from(totals.entries())
      .map(([name, sold]) => ({ name, sold }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("TOP PRODUCTS API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load top products" }, { status: 500 });
  }
}
