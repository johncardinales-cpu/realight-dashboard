import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Supplier_Invoice_Costs";
const DELIVERIES_SHEET = "App_Deliveries";
const PRICING_SHEET = "Pricing_Base";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const HEADERS = [
  "Upload Date",
  "Supplier",
  "Batch / Reference",
  "Invoice No.",
  "Invoice Valid",
  "Product Subtotal",
  "Freight Cost",
  "Delivery Cost",
  "Customs Cost",
  "Other Cost",
  "Total Invoice Cost",
  "Notes",
];

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function itemKey(description: unknown, specification: unknown) {
  return `${text(description).toLowerCase()}|||${text(specification).toLowerCase()}`;
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

async function ensureSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find(
    (s: any) => s.properties?.title === SHEET_NAME
  );
  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: SHEET_NAME,
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:L1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [HEADERS],
    },
  });
}

function mapSupplierRows(rows: any[][]) {
  const data = rows.slice(1).filter((row) =>
    row.some((cell) => String(cell || "").trim() !== "")
  );

  return data.map((row, index) => {
    const obj: Record<string, string> = {};
    HEADERS.forEach((col, i) => {
      obj[col] = String(row[i] || "").trim();
    });
    obj["_rowNumber"] = String(index + 2);
    return obj;
  });
}

function buildPricingMap(rows: any[][]) {
  const map = new Map<string, number>();
  rows.slice(1).forEach((row) => {
    const key = itemKey(row[1], row[2]);
    const costPhp = toNumber(row[7]);
    if (key !== "|||" && costPhp > 0) map.set(key, costPhp);
  });
  return map;
}

function fallbackSupplierCostRows(deliveryRows: any[][], pricingRows: any[][]) {
  const pricing = buildPricingMap(pricingRows);
  const grouped = new Map<string, any>();

  deliveryRows.slice(1).forEach((row) => {
    const uploadDate = normalizeDate(row[1]);
    const supplier = text(row[2]);
    const batchReference = text(row[3]);
    const description = text(row[4]);
    const specification = text(row[5]);
    const qty = toNumber(row[6]);
    if (!supplier || !description || !specification || qty <= 0) return;

    const unitCostPhp = pricing.get(itemKey(description, specification));
    if (!unitCostPhp) return;

    const groupKey = `${uploadDate}|${supplier}|${batchReference || "NO-REF"}`;
    const current = grouped.get(groupKey) || {
      uploadDate,
      supplier,
      batchReference,
      productSubtotal: 0,
      itemCount: 0,
      notes: "Estimated from App_Deliveries quantity x Pricing_Base cost price because Supplier_Invoice_Costs has no invoice rows yet.",
    };
    current.productSubtotal = roundMoney(current.productSubtotal + qty * unitCostPhp);
    current.itemCount += 1;
    grouped.set(groupKey, current);
  });

  return Array.from(grouped.values())
    .sort((a, b) => `${b.uploadDate}-${b.supplier}`.localeCompare(`${a.uploadDate}-${a.supplier}`))
    .map((item, index) => ({
      "Upload Date": item.uploadDate,
      "Supplier": item.supplier,
      "Batch / Reference": item.batchReference,
      "Invoice No.": "Estimated",
      "Invoice Valid": "Estimated",
      "Product Subtotal": String(roundMoney(item.productSubtotal)),
      "Freight Cost": "0",
      "Delivery Cost": "0",
      "Customs Cost": "0",
      "Other Cost": "0",
      "Total Invoice Cost": String(roundMoney(item.productSubtotal)),
      "Notes": `${item.notes} Items grouped: ${item.itemCount}.`,
      "_rowNumber": `EST-${index + 1}`,
    }));
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
    });

    const rows = response.data.values || [];
    const directItems = mapSupplierRows(rows);
    if (directItems.length) return NextResponse.json(directItems);

    const [deliveryResponse, pricingResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${DELIVERIES_SHEET}!A:L` }).catch(() => ({ data: { values: [] } })),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A:N` }).catch(() => ({ data: { values: [] } })),
    ]);

    return NextResponse.json(fallbackSupplierCostRows(deliveryResponse.data.values || [], pricingResponse.data.values || []));
  } catch (error: any) {
    console.error("SUPPLIER COSTS GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load supplier invoice costs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const uploadDate = String(body?.uploadDate || "").trim();
    const supplier = String(body?.supplier || "").trim();
    const batchReference = String(body?.batchReference || "").trim();
    const invoiceNo = String(body?.invoiceNo || "").trim();
    const invoiceValid = String(body?.invoiceValid || "").trim();
    const productSubtotal = Number(body?.productSubtotal || 0);
    const freightCost = Number(body?.freightCost || 0);
    const deliveryCost = Number(body?.deliveryCost || 0);
    const customsCost = Number(body?.customsCost || 0);
    const otherCost = Number(body?.otherCost || 0);
    const notes = String(body?.notes || "").trim();

    if (!uploadDate || !supplier || !batchReference) {
      return NextResponse.json(
        { error: "Upload Date, Supplier, and Batch / Reference are required" },
        { status: 400 }
      );
    }

    const totalInvoiceCost =
      productSubtotal + freightCost + deliveryCost + customsCost + otherCost;

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          uploadDate,
          supplier,
          batchReference,
          invoiceNo,
          invoiceValid,
          productSubtotal,
          freightCost,
          deliveryCost,
          customsCost,
          otherCost,
          totalInvoiceCost,
          notes,
        ]],
      },
    });

    return NextResponse.json({ ok: true, totalInvoiceCost });
  } catch (error: any) {
    console.error("SUPPLIER COSTS POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to save supplier invoice cost" },
      { status: 500 }
    );
  }
}