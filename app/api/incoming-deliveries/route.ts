import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import {
  deliveryKey, isDeliveryRow, normalizeDeliveryStatus,
  removedDeliveryKeys, readDeliveryActions, verifyDeliveryHeaders,
} from "@/lib/delivery-actions";

/** Read-only list. Removed canceled deliveries remain in App_Deliveries and Delivery_Actions. */
export async function GET(request: NextRequest) {
  try {
    const sheets = await getSheetsClient();
    const [response, actions] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "App_Deliveries!A:M" }),
      readDeliveryActions(sheets, SHEET_ID),
    ]);
    const rows = (response.data.values || []) as string[][];
    verifyDeliveryHeaders(rows[0] || []);
    const removed = removedDeliveryKeys(actions);
    const keys = new Map<string, number>();
    const list: Array<Record<string,string>> = [];
    rows.slice(1).forEach((row, index) => {
      if (!isDeliveryRow(row)) return;
      const key = deliveryKey(row);
      keys.set(key, (keys.get(key) || 0) + 1);
      list.push({
        "Delivery ID": String(row[0] || "").trim(),
        "Upload Date": String(row[1] || "").trim(),
        "Arrival Date": String(row[10] || "").trim(),
        "Received Date": String(row[11] || "").trim(),
        "Supplier": String(row[2] || "").trim(),
        "Batch / Reference": String(row[3] || "").trim(),
        "Description": String(row[4] || "").trim(),
        "Specification": String(row[5] || "").trim(),
        "Qty Added": String(row[6] || "").trim(),
        "Unit": String(row[7] || "").trim(),
        "Status": normalizeDeliveryStatus(row[9]),
        "Notes": String(row[12] || "").trim(),
        "_rowNumber": String(index + 2),
        "_deliveryKey": key,
        "_removed": removed.has(key) ? "true" : "false",
      });
    });
    const includeRemoved = request.nextUrl.searchParams.get("includeRemoved") === "1";
    const items = list.map(row => ({
      ...row,
      "_ambiguous": keys.get(row["_deliveryKey"])! > 1 ? "true" : "false",
    })).filter(row => includeRemoved || row["_removed"] !== "true");
    return NextResponse.json(items);
  } catch (error: unknown) {
    console.error("INCOMING DELIVERIES READ ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read incoming deliveries." }, { status: 500 });
  }
}
