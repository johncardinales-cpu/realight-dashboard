import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  getPricingSheetIds, moneyNumber, pricingCellUpdate, pricingAuditEvent, pricingReason,
} from "@/lib/audited-pricing";

const text = (value: unknown) => String(value ?? "").trim();

function roundTo(value: number, increment: number) {
  return increment > 0 ? Math.ceil(value / increment) * increment : Math.round(value * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const actor = await readSession(req.cookies.get("realights_session")?.value);
    if (!actor) return NextResponse.json({ error: "Administrator session required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const note = pricingReason(body?.actionNote);
    const retail = Number(body?.marginPercent);
    const dealer = Number(body?.dealerMarginPercent);
    const minimum = Number(body?.minimumMarginPercent);
    const rounding = Number(body?.roundingIncrement);
    const category = text(body?.category);
    if (![retail, dealer, minimum].every(value => Number.isFinite(value) && value > 0 && value < 95) ||
        !Number.isFinite(rounding) || rounding < 0 || rounding > 100000) {
      return NextResponse.json({ error: "Margins must be greater than 0 and below 95%; enter a valid rounding increment." }, { status: 400 });
    }
    const sheets = await getSheetsClient();
    const [ids, response] = await Promise.all([
      getPricingSheetIds(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Pricing_Base!A:N" }),
    ]);
    const rows = (response.data.values || []) as string[][];
    const timestamp = new Date().toISOString();
    const requests: any[] = [];
    let updated = 0, skipped = 0;
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      if (!text(row[0]) || !text(row[1]) || !text(row[2]) ||
          (category && text(row[3]) !== category)) continue;
      const costUsd = moneyNumber(row[5] || 0, "Stored USD cost");
      const fxRate = Number(row[6]) || 0;
      const storedPhp = moneyNumber(row[7] || 0, "Stored PHP cost");
      const costPhp = storedPhp > 0 ? storedPhp : (fxRate > 0 ? costUsd * fxRate : 0);
      if (!Number.isFinite(costPhp) || costPhp <= 0) { skipped++; continue; }
      const prices = [
        roundTo(costPhp / (1 - retail / 100), rounding),
        roundTo(costPhp / (1 - dealer / 100), rounding),
        roundTo(costPhp / (1 - minimum / 100), rounding),
      ];
      if (prices.some(value => !Number.isFinite(value) || value < costPhp || value > 1_000_000_000)) {
        throw new Error("Calculated price is outside the permitted range. No prices were changed.");
      }
      const margin = (prices[0] - costPhp) / prices[0];
      const previous = [Number(row[8]) || 0, Number(row[9]) || 0, Number(row[10]) || 0];
      if (prices.every((value, i) => Math.abs(value - previous[i]) < 0.005)) continue;
      const notes = [text(row[13]), `${timestamp} [${actor.email}] Bulk margin: ${retail}% retail. ${note}`]
        .filter(Boolean).join(" | ");
      if (notes.length > 40000) throw new Error("Pricing notes are too long; no prices were changed.");
      for (const [column,value] of [
        [8, prices[0]], [9, prices[1]], [10, prices[2]], [11, margin], [13, notes],
      ] as Array<[number,string|number]>) {
        requests.push(pricingCellUpdate(ids.pricingId, index + 1, column, value));
      }
      requests.push(pricingAuditEvent(ids.auditId, "BULK_MARGIN", text(row[0]),
        text(row[1]) + " / " + text(row[2]), actor.email, note,
        { selling: previous[0], dealer: previous[1], minimum: previous[2], margin: Number(row[11]) || 0 },
        { selling: prices[0], dealer: prices[1], minimum: prices[2], margin }, timestamp));
      updated++;
    }
    if (requests.length) await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID, requestBody: { requests },
    });
    return NextResponse.json({
      ok: true, updated, skipped,
      marginPercent: retail, dealerMarginPercent: dealer, minimumMarginPercent: minimum,
      roundingIncrement: rounding, category: category || "All",
    });
  } catch (error) {
    console.error("BULK MARGIN AUDIT ERROR:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to apply bulk margins safely.",
    }, { status: 400 });
  }
}
