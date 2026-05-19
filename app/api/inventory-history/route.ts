import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DELIVERIES_SHEET = "App_Deliveries";
const SALES_SHEET = "Sales";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function text(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
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
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range }).catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

function movementQtyForDelivery(status: string, qty: number) {
  const normalized = status.toLowerCase();
  if (normalized === "available" || normalized === "received") return qty;
  if (normalized === "damaged" || normalized === "defective" || normalized === "damage") return -qty;
  return 0;
}

export async function GET() {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const [deliveryRows, salesRows] = await Promise.all([
      readRange(sheets, `${DELIVERIES_SHEET}!A:L`),
      readRange(sheets, `${SALES_SHEET}!A:AH`),
    ]);

    const events: any[] = [];

    deliveryRows.slice(1).forEach((row, index) => {
      const uploadDate = normalizeDate(row[0]);
      const arrivalDate = normalizeDate(row[1]);
      const supplier = text(row[2]);
      const batchReference = text(row[3]);
      const description = text(row[4]);
      const specification = text(row[5]);
      const qty = toNumber(row[6]);
      const unitPriceUsd = toNumber(row[7]);
      const invoiceValid = text(row[8]);
      const status = text(row[9]) || "Incoming";
      const notes = text(row[10]);
      const createdAt = text(row[11]);
      if (!description && !specification) return;

      events.push({
        id: `DEL-${index + 2}`,
        date: uploadDate || arrivalDate || createdAt,
        type: "Supplier Import",
        source: "App_Deliveries",
        reference: batchReference,
        supplier,
        description,
        specification,
        qtyIn: status.toLowerCase() === "incoming" ? 0 : Math.max(movementQtyForDelivery(status, qty), 0),
        qtyOut: status.toLowerCase().includes("damage") ? qty : 0,
        status,
        movementQty: movementQtyForDelivery(status, qty),
        runningQty: 0,
        unitCostUsd: unitPriceUsd,
        invoiceValid,
        notes: notes || `Uploaded supplier delivery. Arrival date: ${arrivalDate || "not set"}.`,
        createdAt,
      });

      if (status.toLowerCase() === "incoming") {
        events.push({
          id: `INC-${index + 2}`,
          date: arrivalDate || uploadDate || createdAt,
          type: "Expected Arrival",
          source: "App_Deliveries",
          reference: batchReference,
          supplier,
          description,
          specification,
          qtyIn: qty,
          qtyOut: 0,
          status: "Pending Arrival",
          movementQty: 0,
          runningQty: 0,
          unitCostUsd: unitPriceUsd,
          invoiceValid,
          notes: "Pending stock. Not sellable until marked Available/Received.",
          createdAt,
        });
      }
    });

    salesRows.slice(1).forEach((row, index) => {
      const saleDate = normalizeDate(row[0]);
      const salesRefNo = text(row[1]);
      const customerName = text(row[2]);
      const description = text(row[3]);
      const specification = text(row[4]);
      const qty = toNumber(row[5]);
      const saleStatus = text(row[20]) || "Draft";
      const saleId = text(row[22]);
      if (!description && !specification) return;
      if (saleStatus.toLowerCase() !== "confirmed") return;

      events.push({
        id: `SALE-${index + 2}`,
        date: saleDate,
        type: "Confirmed Sale",
        source: "Sales",
        reference: salesRefNo || saleId,
        supplier: "",
        customerName,
        description,
        specification,
        qtyIn: 0,
        qtyOut: qty,
        status: saleStatus,
        movementQty: -qty,
        runningQty: 0,
        unitCostUsd: 0,
        invoiceValid: "",
        notes: `Inventory deducted from confirmed sale for ${customerName}.`,
        createdAt: text(row[24]),
      });
    });

    events.sort((a, b) => `${a.date || "9999-12-31"}-${a.id}`.localeCompare(`${b.date || "9999-12-31"}-${b.id}`));

    const running = new Map<string, number>();
    const withRunning = events.map((event) => {
      const key = `${event.description}|||${event.specification}`;
      const nextQty = (running.get(key) || 0) + event.movementQty;
      running.set(key, nextQty);
      return { ...event, runningQty: Math.max(nextQty, 0) };
    });

    return NextResponse.json(withRunning.reverse());
  } catch (error: any) {
    console.error("INVENTORY HISTORY API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load inventory history" }, { status: 500 });
  }
}
