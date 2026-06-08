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

function roundTo(value: number, increment: number) {
  if (!increment || increment <= 0) return Math.round(value * 100) / 100;
  return Math.ceil(value / increment) * increment;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const marginPercent = toNumber(body?.marginPercent);
    const dealerMarginPercent = toNumber(body?.dealerMarginPercent || marginPercent);
    const minimumMarginPercent = toNumber(body?.minimumMarginPercent || Math.max(marginPercent - 5, 0));
    const roundingIncrement = toNumber(body?.roundingIncrement || 1);
    const category = text(body?.category);

    if (marginPercent <= 0 || marginPercent >= 95) {
      return NextResponse.json({ error: "Margin percent must be greater than 0 and less than 95." }, { status: 400 });
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
      const fxRate = toNumber(row[6]) || 56;
      const costPricePhp = toNumber(row[7]) || costPriceUsd * fxRate;
      if (costPricePhp <= 0) return;

      const sellingPricePhp = roundTo(costPricePhp / (1 - marginPercent / 100), roundingIncrement);
      const dealerPricePhp = roundTo(costPricePhp / (1 - dealerMarginPercent / 100), roundingIncrement);
      const minimumPricePhp = roundTo(costPricePhp / (1 - minimumMarginPercent / 100), roundingIncrement);
      const grossMargin = (sellingPricePhp - costPricePhp) / sellingPricePhp;
      const notes = `${text(row[13])}${text(row[13]) ? " | " : ""}Bulk margin pricing applied: ${marginPercent}% retail margin.`;

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

    return NextResponse.json({ ok: true, updated: updates.length, marginPercent, dealerMarginPercent, minimumMarginPercent, roundingIncrement, category: category || "All" });
  } catch (error: any) {
    console.error("BULK MARGIN PRICING ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to apply bulk margin pricing" }, { status: 500 });
  }
}
