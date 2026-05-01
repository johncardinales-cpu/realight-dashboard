import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Pricing_Base";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
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

const STARTER_ROWS = [
  ["1","5.5KW Hybrid Inverter","BSM-5500BLV-48DA","Inverter","pc","247","56","","","","","", "Active","Manual pricing entry"],
  ["2","11KW Hybrid Inverter","BSM-11000LV-48","Inverter","pc","376","56","","","","","", "Active","Manual pricing entry"],
  ["3","20KW Hybrid Inverter","BSE20KH3","Inverter","pc","1401","56","","","","","", "Active","Manual pricing entry"],
  ["4","30KW Hybrid Inverter HV","BSE30KH3","Inverter","pc","1712","56","","","","","", "Active","Manual pricing entry"],
  ["5","150KW Hybrid Inverter HV","BHPS150-US","Inverter","pc","26970","56","","","","","", "Active","Manual pricing entry"],
  ["6","Monitoring Datalog","Enerlog","Accessory","pc","80","56","","","","","", "Active","Manual pricing entry"],
  ["7","High Voltage Control Box","BSMC-1000V-120A (for 30kw,20kw)","Accessory","pc","697","56","","","","","", "Active","Manual pricing entry"],
  ["8","High Voltage Control Box","BSMC-1000V-300A (for 314Ah)","Accessory","pc","924","56","","","","","", "Active","Manual pricing entry"],
  ["9","10KWh LV Lithium Battery","BSM48200W","Battery","pc","1109","56","","","","","", "Active","Manual pricing entry"],
  ["10","16KWh LV Lithium Battery","BSM48314","Battery","pc","1298","56","","","","","", "Active","Manual pricing entry"],
  ["11","5KWh HV Lithium Battery","BSM48106H","Battery","pc","575","56","","","","","", "Active","Manual pricing entry"],
  ["12","16KWh HV Lithium Battery","BSM48314H","Battery","pc","1399","56","","","","","", "Active","Manual pricing entry"],
  ["13","PV Cable","4mm2 Black and Red","Cable","pc","0.60","56","","","","","", "Active","Manual pricing entry"],
  ["14","MC4 Connector","1500VDC 30A","Accessory","pc","0","56","","","","","", "Active","Manual pricing entry"],
  ["15","DC Cable","25mm2 DC 1500V","Cable","pc","68","56","","","","","", "Active","Manual pricing entry"],
  ["16","11-Layers Battery Rack","Mental Rack for Battery","Rack","pc","379","56","","","","","", "Active","Manual pricing entry"],
  ["17","5-Layers Battery Rack","Mental Rack for Battery","Rack","pc","367","56","","","","","", "Active","Manual pricing entry"],
  ["18","PV Combiner Box","TC10NA-1T","Combiner Box","pc","94","56","","","","","", "Active","Manual pricing entry"],
  ["19","PV Combiner Box","TC20NA-2T2","Combiner Box","pc","118","56","","","","","", "Active","Manual pricing entry"],
  ["20","PV Combiner Box","TC160NB-16T","Combiner Box","pc","450","56","","","","","", "Active","Manual pricing entry"],
  ["21","Solar Panel 610W","BSM610M10-72HNH","Panel","pc","66.8","56","","","","","", "Active","Manual pricing entry"],
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

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

    const rows = response.data.values || [];
    const data = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim() !== ""));

    const items = data.map((row, index) => {
      const costUsd = toNumber(row[5]);
      const fxRate = toNumber(row[6]) || 56;
      const costPhp = toNumber(row[7]) || costUsd * fxRate;
      const sellingPhp = toNumber(row[8]);
      const dealerPhp = toNumber(row[9]);
      const minimumPhp = toNumber(row[10]);
      const grossMargin = sellingPhp ? ((sellingPhp - costPhp) / sellingPhp) : 0;

      return {
        rowNumber: index + 2,
        itemId: String(row[0] || ""),
        description: String(row[1] || ""),
        specification: String(row[2] || ""),
        category: String(row[3] || ""),
        unit: String(row[4] || ""),
        costPriceUsd: costUsd,
        fxRate,
        costPricePhp: costPhp,
        sellingPricePhp: sellingPhp,
        dealerPricePhp: dealerPhp,
        minimumPricePhp: minimumPhp,
        grossMargin,
        status: String(row[12] || "Active"),
        notes: String(row[13] || ""),
      };
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("PRICING BASE GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load pricing base" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rowNumber = Number(body?.rowNumber);
    const description = String(body?.description || "").trim();
    const specification = String(body?.specification || "").trim();
    const category = String(body?.category || "").trim();
    const unit = String(body?.unit || "pc").trim();
    const costPriceUsd = toNumber(body?.costPriceUsd);
    const fxRate = toNumber(body?.fxRate) || 56;
    const sellingPricePhp = toNumber(body?.sellingPricePhp);
    const dealerPricePhp = toNumber(body?.dealerPricePhp);
    const minimumPricePhp = toNumber(body?.minimumPricePhp);
    const status = String(body?.status || "Active").trim();
    const notes = String(body?.notes || "").trim();
    const costPricePhp = costPriceUsd * fxRate;
    const grossMargin = sellingPricePhp ? ((sellingPricePhp - costPricePhp) / sellingPricePhp) : 0;

    if (!description || !specification) {
      return NextResponse.json({ error: "Description and Specification are required" }, { status: 400 });
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
            body?.itemId || rowNumber - 1,
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
      return NextResponse.json({ ok: true, rowNumber });
    }

    const current = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });
    const nextId = (current.data.values || []).length;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          nextId,
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PRICING BASE POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save pricing base" }, { status: 500 });
  }
}
