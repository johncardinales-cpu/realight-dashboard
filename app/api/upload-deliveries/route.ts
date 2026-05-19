import { NextResponse } from "next/server";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DELIVERIES_SHEET = "App_Deliveries";
const PRICING_SHEET = "Pricing_Base";
const DEFAULT_FX_RATE = 56;

type DeliveryRow = {
  uploadDate: string;
  arrivalDate: string;
  supplier: string;
  batchReference: string;
  description: string;
  specification: string;
  qtyAdded: string | number;
  unitPriceUsd?: string | number;
  invoiceValid?: string;
  status: string;
  notes?: string;
};

function required(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function makeKey(description: string, specification: string) {
  return `${description.trim().toLowerCase()}|||${specification.trim().toLowerCase()}`;
}

function itemId(description: string, specification: string) {
  const source = `${description}-${specification}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ITEM-${source.slice(0, 32)}`;
}

function normalizeImportedStatus(value: unknown) {
  const status = required(value).toLowerCase();
  if (status === "damaged" || status === "defective" || status === "damage") return "Damaged";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (status === "received") return "Received";
  return "Incoming";
}

function inferCategory(description: string) {
  const text = description.toLowerCase();
  if (text.includes("panel")) return "Solar Panel";
  if (text.includes("inverter")) return "Inverter";
  if (text.includes("battery")) return "Battery";
  if (text.includes("combiner")) return "Combiner Box";
  if (text.includes("cable") || text.includes("connector") || text.includes("lug") || text.includes("conduit")) return "Electrical Accessories";
  if (text.includes("clamp") || text.includes("rail") || text.includes("bracket") || text.includes("hook")) return "Mounting Accessories";
  if (text.includes("breaker") || text.includes("surge") || text.includes("fuse") || text.includes("isolator")) return "Protection Device";
  if (text.includes("meter") || text.includes("dongle") || text.includes("tester")) return "Monitoring / Tool";
  return "Imported Product";
}

async function ensurePricingSheet(sheets: any) {
  const headers = ["Item ID", "Description", "Specification", "Category", "Unit", "Cost Price USD", "FX Rate", "Cost Price PHP", "Selling Price PHP", "Dealer Price PHP", "Minimum Price PHP", "Gross Margin", "Status", "Notes"];
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A1:N1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } }).catch(async () => {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: PRICING_SHEET } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A1:N1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
  });
}

async function upsertPricingFromDeliveries(sheets: any, rows: DeliveryRow[]) {
  await ensurePricingSheet(sheets);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A:N` }).catch(() => ({ data: { values: [] } }));
  const pricingRows = (response.data.values || []) as string[][];
  const existing = new Map<string, { rowNumber: number; row: string[] }>();

  pricingRows.slice(1).forEach((row, index) => {
    const description = required(row[1]);
    const specification = required(row[2]);
    if (!description || !specification) return;
    existing.set(makeKey(description, specification), { rowNumber: index + 2, row });
  });

  const unique = new Map<string, DeliveryRow>();
  rows.forEach((row) => {
    const description = required(row.description);
    const specification = required(row.specification);
    if (!description || !specification) return;
    unique.set(makeKey(description, specification), row);
  });

  const appendValues: any[][] = [];
  const updateRequests: any[] = [];

  unique.forEach((row, key) => {
    const description = required(row.description);
    const specification = required(row.specification);
    const supplier = required(row.supplier);
    const costUsd = toNumber(row.unitPriceUsd);
    const costPhp = costUsd * DEFAULT_FX_RATE;
    const notes = `Imported from supplier delivery${supplier ? ` - ${supplier}` : ""}${row.batchReference ? ` / ${row.batchReference}` : ""}. Selling price pending.`;
    const found = existing.get(key);

    if (found) {
      const old = found.row;
      const sellingPricePhp = toNumber(old[8]);
      const dealerPricePhp = toNumber(old[9]);
      const minimumPricePhp = toNumber(old[10]);
      const grossMargin = sellingPricePhp ? ((sellingPricePhp - costPhp) / sellingPricePhp) : 0;
      updateRequests.push({ range: `${PRICING_SHEET}!A${found.rowNumber}:N${found.rowNumber}`, values: [[old[0] || itemId(description, specification), description, specification, old[3] || inferCategory(description), old[4] || "pc", costUsd || toNumber(old[5]), toNumber(old[6]) || DEFAULT_FX_RATE, costUsd ? costPhp : toNumber(old[7]), sellingPricePhp, dealerPricePhp, minimumPricePhp, grossMargin, old[12] || "Active", `${old[13] || ""}${old[13] ? " | " : ""}${notes}`]] });
      return;
    }

    appendValues.push([itemId(description, specification), description, specification, inferCategory(description), "pc", costUsd, DEFAULT_FX_RATE, costPhp, "", "", "", "", "Active", notes]);
  });

  if (updateRequests.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateRequests } });
  if (appendValues.length) await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A:N`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: appendValues } });

  return { created: appendValues.length, updated: updateRequests.length };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows as DeliveryRow[] : [];
    if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const values = rows.map((row) => {
      const uploadDate = required(row.uploadDate);
      const arrivalDate = required(row.arrivalDate);
      const supplier = required(row.supplier);
      const batchReference = required(row.batchReference);
      const description = required(row.description);
      const specification = required(row.specification);
      const qtyAdded = required(row.qtyAdded);
      const status = normalizeImportedStatus(row.status);
      if (!uploadDate || !supplier || !description || !specification || !qtyAdded || !status) throw new Error("One or more rows are missing required fields");
      return [uploadDate, arrivalDate, supplier, batchReference, description, specification, qtyAdded, row.unitPriceUsd ?? "", row.invoiceValid ?? "", status, row.notes ?? "", new Date().toISOString()];
    });

    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${DELIVERIES_SHEET}!A:L`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values } });
    const pricing = await upsertPricingFromDeliveries(sheets, rows);

    return NextResponse.json({ ok: true, imported: values.length, pricing, deliveryStatus: "Imported rows default to Incoming unless explicitly marked Received, Damaged, or Cancelled." });
  } catch (error: any) {
    console.error("UPLOAD DELIVERIES API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to upload deliveries" }, { status: 500 });
  }
}
