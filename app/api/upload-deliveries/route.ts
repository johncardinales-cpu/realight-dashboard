import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { saveNewDeliveries } from "@/lib/delivery-create-service";
import { getSheetsClient } from "@/lib/sheets";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DELIVERIES_SHEET = "App_Deliveries";
const PRICING_SHEET = "Pricing_Base";

type DeliveryRow = {
  uploadDate: string;
  arrivalDate: string;
  supplier: string;
  batchReference: string;
  description: string;
  specification: string;
  qtyAdded: string | number;
  unitPriceUsd?: string | number;
  fxRate?: string | number;
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

async function upsertPricingFromDeliveries(sheets: any, rows: DeliveryRow[], actor: string, actionNote: string) {
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
  const auditValues: any[][] = [];
  const timestamp = new Date().toISOString();

  unique.forEach((row, key) => {
    const description = required(row.description);
    const specification = required(row.specification);
    const supplier = required(row.supplier);
    const costUsd = toNumber(row.unitPriceUsd);
    const fxRate = toNumber(row.fxRate);
    const costPhp = Math.round(costUsd * fxRate * 100) / 100;
    const notes = `Imported from supplier delivery${supplier ? ` - ${supplier}` : ""}${row.batchReference ? ` / ${row.batchReference}` : ""}. Selling price pending.`;
    const found = existing.get(key);
    const oldData = found ? { costUsd: toNumber(found.row[5]), fxRate: toNumber(found.row[6]), costPhp: toNumber(found.row[7]) } : {};

    if (found) {
      const old = found.row;
      const sellingPricePhp = toNumber(old[8]);
      const dealerPricePhp = toNumber(old[9]);
      const minimumPricePhp = toNumber(old[10]);
      const originalCostPhp = toNumber(old[7]);
      const finalCostPhp = costUsd > 0 ? costPhp : originalCostPhp;
      const finalFx = fxRate > 0 ? fxRate : toNumber(old[6]);
      const grossMargin = sellingPricePhp ? ((sellingPricePhp - finalCostPhp) / sellingPricePhp) : 0;
      auditValues.push([
        `AUDIT_${crypto.randomUUID()}`, timestamp, "Pricing", "PRICING_FROM_DELIVERY",
        found.row[0] || itemId(description, specification), row.batchReference || description, actor,
        `Supplier cost updated: ${actionNote}`, JSON.stringify(oldData),
        JSON.stringify({ costUsd: costUsd || toNumber(old[5]), fxRate: finalFx, costPhp: finalCostPhp }),
      ]);
      updateRequests.push({ range: `${PRICING_SHEET}!A${found.rowNumber}:N${found.rowNumber}`, values: [[old[0] || itemId(description, specification), description, specification, old[3] || inferCategory(description), old[4] || "pc", costUsd || toNumber(old[5]), finalFx, finalCostPhp, sellingPricePhp, dealerPricePhp, minimumPricePhp, grossMargin, old[12] || "Active", `${old[13] || ""}${old[13] ? " | " : ""}${notes}`]] });
      return;
    }

    appendValues.push([itemId(description, specification), description, specification, inferCategory(description), "pc", costUsd, fxRate, costPhp, "", "", "", "", "Pending Pricing", notes]);
    auditValues.push([
      `AUDIT_${crypto.randomUUID()}`, timestamp, "Pricing", "PRICING_FROM_DELIVERY",
      itemId(description, specification), row.batchReference || description, actor,
      `Supplier cost created: ${actionNote}`, JSON.stringify(oldData),
      JSON.stringify({ costUsd, fxRate, costPhp }),
    ]);
  });

  if (updateRequests.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateRequests } });
  if (appendValues.length) await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A:N`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: appendValues } });

  if (auditValues.length) await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: "Audit_Log!A:J",
    valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
    requestBody: { values: auditValues },
  });
  return { created: appendValues.length, updated: updateRequests.length };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await readSession(req.cookies.get("realights_session")?.value);
    if (!admin) return NextResponse.json({ error: "Authenticated administrator required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? body.rows as DeliveryRow[] : [];
    const actionNote = String(body?.note ?? "").trim();
    if (!rows.length || rows.length > 200) {
      return NextResponse.json({ error: "Import between 1 and 200 rows per operation." }, { status: 400 });
    }
    if (actionNote.length < 8 || actionNote.length > 500) {
      return NextResponse.json({ error: "An import action note of 8 to 500 characters is required." }, { status: 400 });
    }
    // Every appended row follows the verified 13-column live App_Deliveries mapping.
    // Delivery, action notes, and audit entries commit together to avoid partial logging.
    const saved = await saveNewDeliveries(rows, actionNote, admin.email, true);
    try {
      const sheets = await getSheetsClient();
      const pricing = await upsertPricingFromDeliveries(sheets, rows.map((row,index) => ({ ...row, fxRate: saved.effectiveRates[index] })), admin.email, actionNote);
      return NextResponse.json({ ok: true, imported: saved.count, pricing });
    } catch (pricingError) {
      console.error("PRICING UPDATE AFTER DELIVERY IMPORT:", pricingError);
      // Imported rows are already committed. Never invite a blind retry that would duplicate them.
      return NextResponse.json({
        ok: true, imported: saved.count, pricingWarning:
          "Deliveries were saved, but the Pricing_Base sync needs an administrator review. Do not import the file again.",
      });
    }
  } catch (error: unknown) {
    console.error("UPLOAD DELIVERIES API ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload deliveries." }, { status: 400 });
  }
}
