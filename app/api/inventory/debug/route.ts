import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const INVENTORY_SHEET = "App_Deliveries";
const SALES_SHEET = "Sales";

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

function keyOf(description: string, specification: string) {
  return `${description.trim()}|||${specification.trim()}`;
}

export async function GET() {
  try {
    const sheets = google.sheets({ version: "v4", auth });

    const [inventoryResponse, salesResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${INVENTORY_SHEET}!A:L`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SALES_SHEET}!A:V`,
      }),
    ]);

    const inventoryRows = (inventoryResponse.data.values || []) as unknown[][];
    const salesRows = (salesResponse.data.values || []) as unknown[][];

    const inventoryByItem = new Map<string, { description: string; specification: string; availableQty: number; receivedQty: number; incomingQty: number; damagedQty: number }>();
    for (const row of inventoryRows.slice(1)) {
      const description = String(row[4] || "").trim();
      const specification = String(row[5] || "").trim();
      const quantity = toNumber(row[6]);
      const status = String(row[9] || "").trim().toLowerCase();
      if (!description && !specification) continue;

      const key = keyOf(description, specification);
      if (!inventoryByItem.has(key)) {
        inventoryByItem.set(key, { description, specification, availableQty: 0, receivedQty: 0, incomingQty: 0, damagedQty: 0 });
      }
      const item = inventoryByItem.get(key);
      if (!item) continue;

      if (status === "available") item.availableQty += quantity;
      if (status === "received") item.receivedQty += quantity;
      if (status === "incoming") item.incomingQty += quantity;
      if (status === "damaged" || status === "defective" || status === "damage") item.damagedQty += quantity;
    }

    const confirmedSales = salesRows.slice(1)
      .map((row, index) => ({
        rowNumber: index + 2,
        saleDate: String(row[0] || ""),
        salesRefNo: String(row[1] || ""),
        customerName: String(row[2] || ""),
        description: String(row[3] || "").trim(),
        specification: String(row[4] || "").trim(),
        qty: toNumber(row[5]),
        saleStatus: String(row[20] || "Draft").trim(),
        confirmedAt: String(row[21] || ""),
      }))
      .filter((row) => row.description || row.specification)
      .filter((row) => row.qty > 0)
      .filter((row) => row.saleStatus.toLowerCase() === "confirmed");

    const soldByItem = new Map<string, number>();
    for (const sale of confirmedSales) {
      const key = keyOf(sale.description, sale.specification);
      soldByItem.set(key, (soldByItem.get(key) || 0) + sale.qty);
    }

    const items = Array.from(new Set([...inventoryByItem.keys(), ...soldByItem.keys()]))
      .sort()
      .map((key) => {
        const inventory = inventoryByItem.get(key);
        const soldQty = soldByItem.get(key) || 0;
        const availableQty = inventory?.availableQty || 0;
        const damagedQty = inventory?.damagedQty || 0;
        return {
          description: inventory?.description || key.split("|||")[0],
          specification: inventory?.specification || key.split("|||")[1],
          availableQty,
          receivedQty: inventory?.receivedQty || 0,
          incomingQty: inventory?.incomingQty || 0,
          damagedQty,
          confirmedSoldQty: soldQty,
          expectedActualOnHand: Math.max(availableQty - damagedQty - soldQty, 0),
          expectedSellableQty: Math.max(availableQty - damagedQty - soldQty, 0),
        };
      });

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      confirmedSalesCount: confirmedSales.length,
      confirmedSales,
      items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory debug data";
    console.error("INVENTORY DEBUG ERROR:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
