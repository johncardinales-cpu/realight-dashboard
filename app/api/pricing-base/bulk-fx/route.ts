import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Pricing_Base";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function isValidPricingRow(row: string[]) {
  const itemId = text(row[0]);
  const description = text(row[1]);
  const specification = text(row[2]);
  if (!itemId || itemId.toLowerCase() === "item id") return false;
  if (!description || !specification) return false;
  if (description === "Description" || specification === "Specification") return false;
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fxRate = toNumber(body?.fxRate);
    const category = text(body?.category);

    if (fxRate <= 0) {
      return NextResponse.json({ error: "FX rate must be greater than zero." }, { status: 400 });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:N` });
    const rows = (response.data.values || []) as string[][];

    const updates: any[] = [];
    rows.slice(1).forEach((row, index) => {
      if (!isValidPricingRow(row)) return;
      const rowNumber = index + 2;
      const rowCategory = text(row[3]);
      if (category && rowCategory !== category) return;

      const costPriceUsd = toNumber(row[5]);
      if (costPriceUsd <= 0) return;
      const costPricePhp = costPriceUsd * fxRate;
      const sellingPricePhp = toNumber(row[8]);
      const dealerPricePhp = toNumber(row[9]);
      const minimumPricePhp = toNumber(row[10]);
      const grossMargin = sellingPricePhp ? (sellingPricePhp - costPricePhp) / sellingPricePhp : 0;
      const notes = `${text(row[13])}${text(row[13]) ? " | " : ""}FX updated to ${fxRate}.`;

      updates.push({
        range: `${SHEET_NAME}!A${rowNumber}:N${rowNumber}`,
        values: [[
          text(row[0]), text(row[1]), text(row[2]), rowCategory, text(row[4]) || "pc",
          costPriceUsd, fxRate, costPricePhp, sellingPricePhp, dealerPricePhp,
          minimumPricePhp, grossMargin, text(row[12]) || "Active", notes,
        ]],
      });
    });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
    }

    return NextResponse.json({ ok: true, updated: updates.length, fxRate, category: category || "All" });
  } catch (error: any) {
    console.error("BULK FX UPDATE ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to update FX rate" }, { status: 500 });
  }
}
