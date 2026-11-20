import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { DELIVERY_ACTION_HEADERS, readDeliveryActions } from "@/lib/delivery-actions";

type Finding = { severity: "critical" | "warning"; code: string; eventId?: string; message: string };

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const [events, audit] = await Promise.all([
      readDeliveryActions(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Audit_Log!A:J" }),
    ]);
    const findings: Finding[] = [];
    if (!events.length) return NextResponse.json({
      status: "not-configured", checkedAt: new Date().toISOString(),
      checkedEvents: 0, findings: [],
      message: "Delivery actions have not been recorded in the new ledger yet.",
    });
    const headers = events[0].map(value => String(value || "").trim());
    if (DELIVERY_ACTION_HEADERS.some((name, i) => headers[i] !== name)) {
      return NextResponse.json({
        status: "critical", checkedAt: new Date().toISOString(),
        checkedEvents: 0,
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
      const deliveryKey = String(row[2] || "").trim();
      const note = String(row[7] || "").trim();
      const actor = String(row[8] || "").trim();
      const action = String(row[4] || "").trim();
      if (!id || seen.has(id) || !/^[0-9a-f]{64}$/.test(deliveryKey) ||
          !["STATUS_CHANGE", "REMOVE_CANCELLED", "RESTORE_CANCELLED"].includes(action)) {
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
      checkedAt: new Date().toISOString(), checkedEvents, findings: findings.slice(0, 50),
      message: "Read-only check of recorded delivery actions, mandatory notes and audit references.",
    });
  } catch (error) {
    console.error("DELIVERY WATCH ERROR:", error);
    return NextResponse.json({ error: "Delivery action integrity check unavailable." }, { status: 503 });
  }
}
