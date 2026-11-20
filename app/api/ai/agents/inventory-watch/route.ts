import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { STOCK_ADJUSTMENT_HEADERS, readStockAdjustmentRows } from "@/lib/stock-adjustments";

type Finding = { severity: "critical" | "warning"; code: string; adjustmentId?: string; message: string };

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const [rows, auditResponse] = await Promise.all([
      readStockAdjustmentRows(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Audit_Log!A:J" }),
    ]);
    if (!rows.length) {
      return NextResponse.json({
        status: "not-configured", checkedAt: new Date().toISOString(),
        checkedAdjustments: 0, findings: [],
        message: "No Stock_Adjustments worksheet exists yet. Monitoring will become active after the first approved adjustment.",
      });
    }
    const headers = rows[0].map((value) => String(value || "").trim());
    if (STOCK_ADJUSTMENT_HEADERS.some((header, i) => headers[i] !== header)) {
      return NextResponse.json({
        status: "critical", checkedAt: new Date().toISOString(), checkedAdjustments: 0,
        findings: [{ severity: "critical", code: "SCHEMA", message: "Stock_Adjustments headers differ from the expected ledger schema." }],
      });
    }
    const auditRows = (auditResponse.data.values || []) as string[][];
    const auditIds = new Set(auditRows.slice(1).filter(row => row[2] === "Inventory" && row[3] === "ADJUST_QTY").map(row => String(row[4] || "")));
    const seen = new Set<string>();
    const findings: Finding[] = [];
    for (const row of rows.slice(1)) {
      if (!row.some(cell => String(cell || "").trim())) continue;
      const id = String(row[0] || "").trim();
      if (!id || seen.has(id)) findings.push({ severity: "critical", code: "DUPLICATE_ID", adjustmentId: id, message: "Adjustment ID is missing or duplicated." });
      seen.add(id);
      const before = Number(row[4]), delta = Number(row[5]), after = Number(row[6]);
      if (![before, delta, after].every(Number.isSafeInteger) || before + delta !== after || after < 0 || delta === 0) {
        findings.push({ severity: "critical", code: "QUANTITY_MISMATCH", adjustmentId: id, message: "Adjustment quantities do not reconcile." });
      }
      if (String(row[7] || "").trim().length < 8 || !String(row[8] || "").trim()) {
        findings.push({ severity: "warning", code: "MISSING_REASON_OR_ACTOR", adjustmentId: id, message: "Adjustment reason or actor is missing." });
      }
      if (id && !auditIds.has(id)) {
        findings.push({ severity: "warning", code: "AUDIT_MISSING", adjustmentId: id, message: "Matching inventory audit log entry was not found." });
      }
    }
    const critical = findings.some(finding => finding.severity === "critical");
    return NextResponse.json({
      status: critical ? "critical" : findings.length ? "warning" : "healthy",
      checkedAt: new Date().toISOString(), checkedAdjustments: seen.size,
      findings: findings.slice(0, 50),
      message: "Read-only ledger integrity check. A healthy result does not prove physical stock quantities.",
    });
  } catch (error) {
    console.error("INVENTORY WATCH ERROR:", error);
    return NextResponse.json({ error: "Inventory watch failed to complete; monitoring result is unavailable." }, { status: 503 });
  }
}
