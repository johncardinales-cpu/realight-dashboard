import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import {
  DELIVERY_ACTION_HEADERS, readDeliveryActions, verifyDeliveryHeaders,
  normalizeDeliveryStatus,
} from "@/lib/delivery-actions";
import { readStockAdjustmentRows, summarizeOnHand } from "@/lib/stock-adjustments";
import { deliveryStockImpact } from "@/lib/delivery-stock";

type Finding = { severity: "critical" | "warning"; code: string; eventId?: string; message: string };

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const [events, audit, deliveries, sales, adjustments] = await Promise.all([
      readDeliveryActions(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Audit_Log!A:J" }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "App_Deliveries!A:M" }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Sales!A:Y" }),
      readStockAdjustmentRows(sheets, SHEET_ID),
    ]);
    const findings: Finding[] = [];
    const deliveryRows = (deliveries.data.values || []) as string[][];
    const salesRows = (sales.data.values || []) as string[][];
    verifyDeliveryHeaders(deliveryRows[0] || []);
    const totals = {
      incomingUnits: 0, availableFromDeliveries: 0, supplierDamagedUnits: 0,
      recordedDamageAdjustments: 0, cancelledUnits: 0,
      confirmedSoldUnits: 0, calculatedOnHandUnits: 0,
    };
    for (const row of deliveryRows.slice(1)) {
      if (!row.some(cell => String(cell || "").trim())) continue;
      const status = normalizeDeliveryStatus(row[9]);
      const movement = deliveryStockImpact(row);
      totals.incomingUnits += movement.incoming;
      totals.availableFromDeliveries += movement.available;
      totals.supplierDamagedUnits += movement.damaged;
      if (status === "Cancelled") totals.cancelledUnits += Number(row[6]) || 0;
      if (movement.available < 0) totals.recordedDamageAdjustments -= movement.available;
    }
    for (const row of salesRows.slice(1)) {
      if (String(row[20] || "").trim().toLowerCase() === "confirmed") {
        totals.confirmedSoldUnits += Number(row[5]) || 0;
      }
    }
    totals.calculatedOnHandUnits = summarizeOnHand(deliveryRows, salesRows, adjustments);

    if (!events.length) return NextResponse.json({
      status: "not-configured", checkedAt: new Date().toISOString(),
      checkedEvents: 0, totals, findings: [],
      message: "Delivery actions have not been recorded in the new ledger yet. Stock totals were calculated read-only.",
    });
    const headers = (events[0] || []).map(value => String(value || "").trim());
    if (DELIVERY_ACTION_HEADERS.some((name, i) => headers[i] !== name)) {
      return NextResponse.json({
        status: "critical", checkedAt: new Date().toISOString(), checkedEvents: 0, totals,
        findings: [{ severity: "critical", code: "SCHEMA", message: "Delivery action ledger headers do not match." }],
      });
    }
    const auditIds = new Set(
      ((audit.data.values || []) as string[][]).slice(1)
        .filter(row => row[2] === "Incoming Deliveries")
        .map(row => String(row[4] || "").trim())
    );
    const seen = new Set<string>();
    let checkedEvents = 0;
    for (const row of events.slice(1)) {
      if (!row.some(value => String(value || "").trim())) continue;
      checkedEvents++;
      const id = String(row[0] || "").trim();
      const key = String(row[2] || "").trim();
      const note = String(row[7] || "").trim();
      const actor = String(row[8] || "").trim();
      const action = String(row[4] || "").trim();
      if (!id || seen.has(id) || !/^[0-9a-f]{64}$/.test(key) ||
          !["STATUS_CHANGE", "REMOVE_CANCELLED", "RESTORE_CANCELLED", "CREATE_DELIVERY",
            "IMPORT_DELIVERY", "MARK_DAMAGED", "UPDATE_DATES"].includes(action)) {
        findings.push({ severity: "critical", code: "INVALID_EVENT", eventId: id, message: "Invalid or duplicate delivery action record." });
      }
      seen.add(id);
      if (!actor || note.length < 8 || note.length > 500) {
        findings.push({ severity: "critical", code: "MISSING_NOTE", eventId: id, message: "Required note or actor is missing from a delivery action." });
      }
      if (id && !auditIds.has(id)) {
        findings.push({ severity: "warning", code: "AUDIT_MISSING", eventId: id, message: "Matching Audit_Log entry was not found." });
      }
    }
    return NextResponse.json({
      status: findings.some(f => f.severity === "critical") ? "critical" : findings.length ? "warning" : "healthy",
      checkedAt: new Date().toISOString(), checkedEvents, totals, findings: findings.slice(0, 50),
      message: "Read-only delivery action and stock reconciliation. Calculated stock is not a physical warehouse count.",
    });
  } catch (error) {
    console.error("DELIVERY WATCH ERROR:", error);
    return NextResponse.json({ error: "Delivery action integrity check unavailable." }, { status: 503 });
  }
}
