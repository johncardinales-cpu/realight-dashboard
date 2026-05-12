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
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
    });

    const rows = (response.data.values || []) as string[][];
    const data = rows.slice(1).filter(isValidPricingRow);

    const items = data.map((row, index) => {
      const costPriceUsd = toNumber(row[5]);
      const fxRate = toNumber(row[6]) || 56;
      const costPricePhp = toNumber(row[7]) || costPriceUsd * fxRate;
      const sellingPricePhp = toNumber(row[8]);
      const dealerPricePhp = toNumber(row[9]);
      const minimumPricePhp = toNumber(row[10]);
      const grossMargin = sellingPricePhp ? ((sellingPricePhp - costPricePhp) / sellingPricePhp) : 0;

      return {
        rowNumber: index + 2,
        itemId: String(row[0] || ""),
        description: String(row[1] || ""),
        specification: String(row[2] || ""),
        category: String(row[3] || ""),
        unit: String(row[4] || "pc"),
        costPriceUsd,
        fxRate,
        costPricePhp,
        sellingPricePhp,
        dealerPricePhp,
        minimumPricePhp,
        grossMargin,
        status: String(row[12] || "Active"),
        notes: String(row[13] || ""),
      };
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("PRICING BASE GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load pricing base" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rowNumber = Number(body?.rowNumber);
    const itemId = String(body?.itemId || "").trim();
    const description = String(body?.description || "").trim();
    const specification = String(body?.specification || "").trim();
    const category = String(body?.category || "").trim();
    const unit = String(body?.unit || "pc").trim();
    const costPriceUsd = toNumber(body?.costPriceUsd);
    const fxRate = toNumber(body?.fxRate) || 56;
    const costPricePhp = costPriceUsd * fxRate;
    const sellingPricePhp = toNumber(body?.sellingPricePhp);
    const dealerPricePhp = toNumber(body?.dealerPricePhp);
    const minimumPricePhp = toNumber(body?.minimumPricePhp);
    const grossMargin = sellingPricePhp ? ((sellingPricePhp - costPricePhp) / sellingPricePhp) : 0;
    const status = String(body?.status || "Active").trim();
    const notes = String(body?.notes || "").trim();

    if (!description || !specification) {
      return NextResponse.json({ error: "Description and Specification are required" }, { status: 400 });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    if (rowNumber) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:N${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[
          itemId || String(rowNumber - 1), description, specification, category, unit,
          costPriceUsd, fxRate, costPricePhp, sellingPricePhp, dealerPricePhp,
          minimumPricePhp, grossMargin, status, notes,
        ]]},
      });
      return NextResponse.json({ ok: true, mode: "updated" });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });
    const nextId = String((response.data.values || []).length);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[
        itemId || nextId, description, specification, category, unit,
        costPriceUsd, fxRate, costPricePhp, sellingPricePhp, dealerPricePhp,
        minimumPricePhp, grossMargin, status, notes,
      ]]},
    });

    return NextResponse.json({ ok: true, mode: "created" });
  } catch (error: any) {
    console.error("PRICING BASE POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to save pricing base" },
      { status: 500 }
    );
  }
}
