import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  getPricingSheetIds, moneyNumber, priceCells, pricingAuditEvent, pricingReason,
} from "@/lib/audited-pricing";

const SHEET = "Pricing_Base";
const text = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => Number(String(v ?? "0").replace(/[,₱$\s]/g, "")) || 0;
const sku = (a: unknown, b: unknown) => `${text(a).toLowerCase()}|||${text(b).toLowerCase()}`;

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET}!A:N` });
    const rows = (response.data.values || []) as string[][];
    const items = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) => text(row[0]) && text(row[1]) && text(row[2]))
      .map(({ row, rowNumber }) => {
        const costPriceUsd = num(row[5]);
        const fxRate = num(row[6]);
        const costPricePhp = num(row[7]) || (fxRate > 0 ? costPriceUsd * fxRate : 0);
        const sellingPricePhp = num(row[8]);
        return {
          rowNumber, itemId: text(row[0]), description: text(row[1]), specification: text(row[2]),
          category: text(row[3]), unit: text(row[4]) || "pc",
          costPriceUsd, fxRate, costPricePhp,
          sellingPricePhp, dealerPricePhp: num(row[9]), minimumPricePhp: num(row[10]),
          grossMargin: sellingPricePhp > 0 ? (sellingPricePhp - costPricePhp) / sellingPricePhp : 0,
          status: text(row[12]) || "Pending Pricing", notes: text(row[13]),
        };
      });
    return NextResponse.json(items);
  } catch (error) {
    console.error("PRICING LIST ERROR:", error);
    return NextResponse.json({ error: "Unable to load pricing." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await readSession(req.cookies.get("realights_session")?.value);
    if (!actor) return NextResponse.json({ error: "Administrator session required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const note = pricingReason(body?.actionNote);
    const description = text(body?.description), specification = text(body?.specification);
    const rowNumber = body?.rowNumber === 0 || body?.rowNumber === undefined
      ? 0 : Number(body.rowNumber);
    const requestedId = text(body?.itemId);
    if (!description || !specification || description.length > 200 || specification.length > 200 ||
        requestedId.length > 64 || !Number.isSafeInteger(rowNumber) || rowNumber < 0) {
      return NextResponse.json({ error: "Choose a valid item and product specification." }, { status: 400 });
    }
    const costUsd = moneyNumber(body?.costPriceUsd, "USD cost");
    const fxRate = Number(body?.fxRate);
    const sell = moneyNumber(body?.sellingPricePhp, "Selling price");
    const dealer = moneyNumber(body?.dealerPricePhp, "Dealer price");
    const minimum = moneyNumber(body?.minimumPricePhp, "Minimum price");
    if (!Number.isFinite(fxRate) || fxRate < 0 || fxRate > 1000 || (costUsd > 0 && fxRate <= 0)) {
      return NextResponse.json({ error: "A valid PHP-per-USD FX rate is required when cost is in USD." }, { status: 400 });
    }
    const costPhp = Math.round(costUsd * fxRate * 100) / 100;
    const margin = sell > 0 ? (sell - costPhp) / sell : 0;
    const status = text(body?.status) || "Pending Pricing";
    if (!["Active", "Inactive", "Pending Pricing"].includes(status) ||
        (status === "Active" && (sell <= 0 || (costUsd > 0 && fxRate <= 0)))) {
      return NextResponse.json({ error: "Active products need a selling price; otherwise use Pending Pricing." }, { status: 400 });
    }
    const recordNotes = text(body?.notes);
    if (recordNotes.length > 15000) {
      return NextResponse.json({ error: "Product notes exceed the allowed length." }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const [ids, data] = await Promise.all([
      getPricingSheetIds(sheets, SHEET_ID),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET}!A:N` }),
    ]);
    const rows = (data.data.values || []) as string[][];
    const current = rowNumber ? rows[rowNumber - 1] : null;
    if (rowNumber && (!current || !text(current[0]) || text(current[0]) !== requestedId)) {
      return NextResponse.json({ error: "Product identity changed. Refresh Pricing and retry." }, { status: 409 });
    }
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index];
      if (!text(row[0])) continue;
      if (index + 1 !== rowNumber && sku(row[1], row[2]) === sku(description, specification)) {
        return NextResponse.json({ error: "A product with this description and specification already exists." }, { status: 409 });
      }
      if (index + 1 !== rowNumber && requestedId && text(row[0]) === requestedId) {
        return NextResponse.json({ error: "This Item ID already belongs to another product." }, { status: 409 });
      }
    }
    const id = current ? text(current[0]) : requestedId || `ITEM_${randomUUID().replace(/-/g, "").slice(0,20)}`;
    const timestamp = new Date().toISOString();
    const auditNote = `${timestamp} [${actor.email}] ${note}`;
    const notes = recordNotes ? `${recordNotes}\n${auditNote}` : auditNote;
    if (notes.length > 40000) throw new Error("Pricing notes are too long to save.");
    const values: Array<string | number> = [
      id, description, specification, text(body?.category), text(body?.unit) || "pc",
      costUsd, fxRate, costPhp, sell, dealer, minimum, margin, status, notes,
    ];
    const before = current ? {
      itemId: current[0], description: current[1], specification: current[2],
      costUsd: num(current[5]), fxRate: num(current[6]), costPhp: num(current[7]),
      sell: num(current[8]), dealer: num(current[9]), minimum: num(current[10]), status: text(current[12]),
    } : {};
    const after = { itemId:id, description, specification, costUsd, fxRate, costPhp, sell, dealer, minimum, status };
    const mutation = rowNumber
      ? { updateCells: { start: { sheetId: ids.pricingId, rowIndex: rowNumber - 1, columnIndex: 0 },
          rows: [priceCells(values)], fields: "userEnteredValue" } }
      : { appendCells: { sheetId: ids.pricingId, rows: [priceCells(values)], fields: "userEnteredValue" } };
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        mutation,
        pricingAuditEvent(ids.auditId, rowNumber ? "UPDATE_PRICE" : "CREATE_PRICE",
          id, description + " / " + specification, actor.email, note, before, after, timestamp),
      ] },
    });
    return NextResponse.json({ ok:true, mode: rowNumber ? "updated" : "created", itemId: id });
  } catch (error) {
    console.error("PRICING SAVE ERROR:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to save pricing.",
    }, { status: 400 });
  }
}
