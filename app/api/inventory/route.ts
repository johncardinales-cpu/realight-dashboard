import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const INVENTORY_SHEET = "App_Deliveries";
const SALES_SHEET = "Sales";

type SheetCell = string | number | boolean | null | undefined;
type SheetRow = SheetCell[];

type InventoryItem = {
  Description: string;
  Specification: string;
  "Incoming Qty": number;
  "Received Qty": number;
  "Sold Qty": number;
  "Damaged Qty": number;
  "Actual On Hand": number;
  "Minimum Buffer": number;
  "Sellable Qty": number;
  "Latest Received": string;
  "Latest Incoming": string;
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load inventory data";
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth });
}

function createEmptyItem(description: string, specification: string): InventoryItem {
  return {
    Description: description,
    Specification: specification,
    "Incoming Qty": 0,
    "Received Qty": 0,
    "Sold Qty": 0,
    "Damaged Qty": 0,
    "Actual On Hand": 0,
    "Minimum Buffer": 0,
    "Sellable Qty": 0,
    "Latest Received": "",
    "Latest Incoming": "",
  };
}

function getOrCreateItem(
  grouped: Map<string, InventoryItem>,
  description: string,
  specification: string
) {
  const key = `${description}|||${specification}`;
  if (!grouped.has(key)) grouped.set(key, createEmptyItem(description, specification));
  return grouped.get(key);
}

function applyDeliveryRows(grouped: Map<string, InventoryItem>, rows: SheetRow[]) {
  const data = rows.slice(1).filter((row: SheetRow) =>
    row.some((cell: SheetCell) => String(cell || "").trim() !== "")
  );

  for (const row of data) {
    const uploadDate = String(row[0] || "").trim();
    const arrivalDate = String(row[1] || "").trim();
    const description = String(row[4] || "").trim();
    const specification = String(row[5] || "").trim();
    const quantity = toNumber(row[6]);
    const status = String(row[9] || "").trim().toLowerCase();

    if (!description && !specification) continue;

    const item = getOrCreateItem(grouped, description, specification);
    if (!item) continue;

    if (status === "incoming") {
      item["Incoming Qty"] += quantity;
      if (arrivalDate) item["Latest Incoming"] = arrivalDate;
    } else if (status === "received") {
      item["Received Qty"] += quantity;
      if (arrivalDate) item["Latest Received"] = arrivalDate;
    } else if (status === "available") {
      item["Actual On Hand"] += quantity;
      item["Sellable Qty"] += quantity;
      if (arrivalDate) item["Latest Received"] = arrivalDate;
    } else if (status === "damaged" || status === "defective" || status === "damage") {
      item["Damaged Qty"] += quantity;
      item["Actual On Hand"] -= quantity;
      item["Sellable Qty"] -= quantity;
    } else if (status === "in transit") {
      if (arrivalDate) item["Latest Incoming"] = arrivalDate;
    }

    if (!item["Latest Incoming"] && uploadDate) item["Latest Incoming"] = uploadDate;
  }
}

function applyConfirmedSalesRows(grouped: Map<string, InventoryItem>, rows: SheetRow[]) {
  const data = rows.slice(1).filter((row: SheetRow) =>
    row.some((cell: SheetCell) => String(cell || "").trim() !== "")
  );

  for (const row of data) {
    const description = String(row[3] || "").trim();
    const specification = String(row[4] || "").trim();
    const quantity = toNumber(row[5]);
    const saleStatus = String(row[20] || "Draft").trim().toLowerCase();

    if (!description && !specification) continue;
    if (quantity <= 0) continue;
    if (saleStatus !== "confirmed") continue;

    const item = getOrCreateItem(grouped, description, specification);
    if (!item) continue;

    item["Sold Qty"] += quantity;
    item["Actual On Hand"] -= quantity;
    item["Sellable Qty"] -= quantity;
  }
}

export async function GET() {
  try {
    const sheets = getSheetsClient();

    const [deliveryResponse, salesResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${INVENTORY_SHEET}!A:L`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SALES_SHEET}!A:V`,
      }),
    ]);

    const deliveryRows = (deliveryResponse.data.values || []) as SheetRow[];
    const salesRows = (salesResponse.data.values || []) as SheetRow[];
    const grouped = new Map<string, InventoryItem>();

    applyDeliveryRows(grouped, deliveryRows);
    applyConfirmedSalesRows(grouped, salesRows);

    const normalized = Array.from(grouped.values()).map((item) => ({
      ...item,
      "Actual On Hand": Math.max(item["Actual On Hand"], 0),
      "Sellable Qty": Math.max(item["Sellable Qty"], 0),
    }));

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    console.error("INVENTORY API ERROR:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
