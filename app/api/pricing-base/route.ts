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
  "Item ID",
  "Description",
  "Specification",
  "Category",
  "Unit",
  "Cost Price (USD)",
  "FX Rate",
  "Cost Price (PHP)",
  "Selling Price (PHP)",
  "Dealer Price (PHP)",
  "Minimum Price (PHP)",
  "Gross Margin %",
  "Status",
  "Notes",
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

const STARTER_ROWS = [
  ["1","5.5KW Hybrid Inverter","BSM-5500BLV-48DA","Inverter","pc","247","56","13832","","","","","Active","Editable"],
  ["2","11KW Hybrid Inverter","BSM-11000LV-48","Inverter","pc","376","56","21056","","","","","Active","Editable"],
  ["3","20KW Hybrid Inverter","BSE20KH3","Inverter","pc","1401","56","78456","","","","","Active","Editable"],
  ["4","30KW Hybrid Inverter HV","BSE30KH3","Inverter","pc","1712","56","95872","","","","","Active","Editable"],
  ["5","150KW Hybrid Inverter HV","BHPS150-US","Inverter","pc","26970","56","1510320","","","","","Active","Editable"],
];

async function ensureSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === SHEET_NAME);
  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:N${STARTER_ROWS.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADERS, ...STARTER_ROWS] },
  });
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
    });

    const rows = (response.data.values || []) as string[][];
    const data = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim() !== ""));

    const items = data.map((row, index) => {
      const costPriceUsd = toNumber(row[5]);
      const fxRate = toNumber(row[6]) || 56;
      const costPricePhp = toNumber(row[7]) || (costPriceUsd * fxRate);
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
      return NextResponse.json(
        { error: "Description and Specification are required" },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

    if (rowNumber) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:N${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            itemId || String(rowNumber - 1),
            description,
            specification,
            category,
            unit,
            costPriceUsd,
            fxRate,
            costPricePhp,
            sellingPricePhp,
            dealerPricePhp,
            minimumPricePhp,
            grossMargin,
            status,
            notes,
          ]],
        },
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
      requestBody: {
        values: [[
          itemId || nextId,
          description,
          specification,
          category,
          unit,
          costPriceUsd,
          fxRate,
          costPricePhp,
          sellingPricePhp,
          dealerPricePhp,
          minimumPricePhp,
          grossMargin,
          status,
          notes,
        ]],
      },
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
