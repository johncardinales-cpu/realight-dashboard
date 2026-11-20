import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  getPricingSheetIds, moneyNumber, pricingCellUpdate, pricingAuditEvent, pricingReason,
} from "@/lib/audited-pricing";

const text = (value: unknown) => String(value ?? "").trim();

export async function POST(req: NextRequest) {
  try {
    const actor = await readSession(req.cookies.get("realights_session")?.value);
    if (!actor) return NextResponse.json({ error: "Administrator session required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const note = pricingReason(body?.actionNote);
    const fxRate = Number(body?.fxRate), category = text(body?.category);
    if (!Number.isFinite(fxRate) || fxRate <= 0 || fxRate > 1000) {
      return NextResponse.json({ error: "FX must be a positive PHP-per-USD rate." }, { status: 400 });
    }
    const sheets = await getSheetsClient();
    const [ids, result] = await Promise.all([
      getPricingSheetIds(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Pricing_Base!A:N" }),
    ]);
    const rows = (result.data.values || []) as string[][];
    const timestamp = new Date().toISOString();
    const requests: any[] = [];
    let updated = 0;
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      if (!text(row[0]) || !text(row[1]) || !text(row[2]) ||
          (category && text(row[3]) !== category)) continue;
      const costUsd = moneyNumber(row[5] || 0, "Stored USD cost");
      if (costUsd <= 0) continue;
      const beforeRate = Number(row[6]) || 0, beforePhp = Number(row[7]) || 0;
      const pricePhp = Math.round(costUsd * fxRate * 100) / 100;
      if (beforeRate === fxRate && Math.abs(beforePhp - pricePhp) < 0.005) continue;
      const sell = Number(row[8]) || 0;
      const margin = sell > 0 ? (sell - pricePhp) / sell : 0;
      const notes = [text(row[13]), `${timestamp} [${actor.email}] Bulk FX: ${fxRate}. ${note}`].filter(Boolean).join(" | ");
      if (notes.length > 40000) throw new Error("Pricing notes are too long; no FX changes were made.");
      for (const [column, value] of [
        [6, fxRate], [7, pricePhp], [11, margin], [13, notes],
      ] as Array<[number, string | number]>) {
        requests.push(pricingCellUpdate(ids.pricingId, index + 1, column, value));
      }
      requests.push(pricingAuditEvent(ids.auditId, "BULK_FX", text(row[0]),
        text(row[1]) + " / " + text(row[2]), actor.email, note,
        { fxRate: beforeRate, costPhp: beforePhp, margin: Number(row[11]) || 0 },
        { fxRate, costPhp: pricePhp, margin }, timestamp));
      updated++;
    }
    if (requests.length) await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID, requestBody: { requests },
    });
    return NextResponse.json({ ok: true, updated, fxRate, category: category || "All" });
  } catch (error) {
    console.error("BULK FX AUDIT ERROR:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to update FX safely.",
    }, { status: 400 });
  }
}
