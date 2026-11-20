import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import { currentStockForItem, readStockAdjustmentRows } from "@/lib/stock-adjustments";
import { saveNewDeliveries } from "@/lib/delivery-create-service";
import { verifyDeliveryHeaders } from "@/lib/delivery-actions";

export async function POST(req: NextRequest) {
  try {
    const session = await readSession(req.cookies.get("realights_session")?.value);
    if (!session) return NextResponse.json({ error: "Authenticated administrator required." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const description = String(body?.description || "").trim();
    const specification = String(body?.specification || "").trim();
    const reason = String(body?.reason || "").trim();
    const qty = body?.quantity;
    const expectedQty = body?.expectedQty;
    if (!description || !specification || !Number.isSafeInteger(qty) || qty <= 0 ||
        !Number.isSafeInteger(expectedQty) || expectedQty < qty ||
        reason.length < 8 || reason.length > 500) {
      return NextResponse.json({ error: "Select a product, valid damaged units, current quantity and a reason (8–500 characters)." }, { status: 400 });
    }
    const sheets = await getSheetsClient();
    const [deliveries, sales, adjustments] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "App_Deliveries!A:M" }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Sales!A:Y" }),
      readStockAdjustmentRows(sheets, SHEET_ID),
    ]);
    const deliveryRows = (deliveries.data.values || []) as string[][];
    verifyDeliveryHeaders(deliveryRows[0] || []);
    const stock = currentStockForItem(deliveryRows, (sales.data.values || []) as string[][],
      adjustments, description, specification);
    if (!stock.found) return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    if (stock.rawQty !== expectedQty || qty > stock.rawQty) {
      return NextResponse.json({ error: "Stock changed or damaged units exceed sellable stock. Refresh inventory." }, { status: 409 });
    }
    const today = new Date().toISOString().slice(0, 10);
    await saveNewDeliveries([{
      uploadDate: today,
      arrivalDate: today,
      supplier: "DAMAGE",
      batchReference: "Dashboard Adjustment",
      description, specification,
      qtyAdded: qty,
      status: "Damaged",
      notes: reason,
    }], "Stock damage: " + reason, session.email, false, "MARK_DAMAGED");
    return NextResponse.json({ ok: true, damagedUnits: qty });
  } catch (error) {
    console.error("MARK DAMAGED API ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record stock damage." }, { status: 500 });
  }
}
