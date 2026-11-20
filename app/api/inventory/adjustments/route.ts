import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  STOCK_ADJUSTMENTS_SHEET, STOCK_ADJUSTMENT_HEADERS,
  readStockAdjustmentRows, currentStockForItem,
} from "@/lib/stock-adjustments";

const AUDIT_SHEET = "Audit_Log";
const AUDIT_HEADERS = [
  "Audit ID", "Created At", "Module", "Action", "Record ID",
  "Record Ref", "Actor", "Summary", "Before JSON", "After JSON",
];

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isValidCode(candidate: string, configured: string) {
  const provided = Buffer.from(candidate, "utf8");
  const expected = Buffer.from(configured, "utf8");
  return !!configured && provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function validateAdmin(request: NextRequest, adminCode: string): Promise<string | null> {
  const verified = await readSession(request.cookies.get("realights_session")?.value);
  const accessCode = text(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE);
  if (!verified || !adminCode || adminCode.length > 512) return null;
  return isValidCode(adminCode, accessCode) ? verified.email : null;
}

function column(index: number): string {
  let n = index;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

async function ensureLedgerSheets(sheets: any) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title))",
  });
  const sheetsByName = new Map<string, number>();
  for (const entry of metadata.data.sheets || []) {
    const name = entry.properties?.title;
    const id = entry.properties?.sheetId;
    if (name && typeof id === "number") sheetsByName.set(name, id);
  }
  for (const [title, headers] of [
    [STOCK_ADJUSTMENTS_SHEET, STOCK_ADJUSTMENT_HEADERS],
    [AUDIT_SHEET, AUDIT_HEADERS],
  ] as const) {
    if (sheetsByName.has(title)) continue;
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const id = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (typeof id !== "number") throw new Error(`Unable to initialize ${title} ledger.`);
    sheetsByName.set(title, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${title}!A1:${column(headers.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
  }
  const headerResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: [`${STOCK_ADJUSTMENTS_SHEET}!A1:J1`, `${AUDIT_SHEET}!A1:J1`],
  });
  [STOCK_ADJUSTMENT_HEADERS, AUDIT_HEADERS].forEach((required, index) => {
    const actual = (headerResponse.data.valueRanges?.[index]?.values?.[0] || []).map(text);
    if (required.some((name, position) => actual[position] !== name)) {
      throw new Error("Adjustment or Audit_Log headers differ from the expected schema; no stock was changed.");
    }
  });
  return {
    adjustmentsId: sheetsByName.get(STOCK_ADJUSTMENTS_SHEET)!,
    auditId: sheetsByName.get(AUDIT_SHEET)!,
  };
}

function cells(values: Array<string | number>) {
  return {
    values: values.map((value) => ({
      userEnteredValue: typeof value === "number"
        ? { numberValue: value }
        : { stringValue: value },
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await validateAdmin(request, text(body?.adminCode));
    if (!actor) {
      return NextResponse.json({ error: "Admin session and access code are required." }, { status: 403 });
    }

    const description = text(body?.description);
    const specification = text(body?.specification);
    const reason = text(body?.reason);
    const targetQty = body?.targetQty;
    const expectedQty = body?.expectedQty;
    if (!description || !specification || description.length > 200 || specification.length > 200) {
      return NextResponse.json({ error: "Select an existing inventory item." }, { status: 400 });
    }
    if (!Number.isSafeInteger(targetQty) || targetQty < 0 || targetQty > 1000000 ||
        !Number.isSafeInteger(expectedQty) || expectedQty < 0) {
      return NextResponse.json({ error: "Quantity must be a whole number between 0 and 1,000,000." }, { status: 400 });
    }
    if (reason.length < 8 || reason.length > 250) {
      return NextResponse.json({ error: "Enter an adjustment reason (8 to 250 characters)." }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const [deliveryResult, salesResult, adjustmentRows] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "App_Deliveries!A:L" }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Sales!A:Y" }),
      readStockAdjustmentRows(sheets, SHEET_ID),
    ]);
    const stock = currentStockForItem(
      (deliveryResult.data.values || []) as string[][],
      (salesResult.data.values || []) as string[][],
      adjustmentRows, description, specification
    );
    if (!stock.found) {
      return NextResponse.json({ error: "Product not found in deliveries. Refresh inventory and try again." }, { status: 404 });
    }
    if (stock.displayQty !== expectedQty) {
      return NextResponse.json({
        error: "Inventory quantity has changed. Refresh before recording an adjustment.",
        currentQty: stock.displayQty,
      }, { status: 409 });
    }
    const delta = targetQty - stock.rawQty;
    if (!delta) return NextResponse.json({ error: "The corrected quantity equals the current quantity." }, { status: 400 });

    const { adjustmentsId, auditId } = await ensureLedgerSheets(sheets);
    const timestamp = new Date().toISOString();
    const id = `ADJ_${randomUUID()}`;
    const auditIdValue = `AUDIT_${randomUUID()}`;
    const previous = { qty: stock.rawQty };
    const revised = { qty: targetQty, delta, reason, adjustmentId: id };
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        { appendCells: {
          sheetId: adjustmentsId, rows: [cells([
            id, timestamp, description, specification, stock.rawQty, delta, targetQty, reason, actor, "",
          ])], fields: "userEnteredValue",
        } },
        { appendCells: {
          sheetId: auditId, rows: [cells([
            auditIdValue, timestamp, "Inventory", "ADJUST_QTY", id,
            `${description} / ${specification}`, actor,
            `Inventory adjusted by ${delta} unit(s): ${reason}`,
            JSON.stringify(previous), JSON.stringify(revised),
          ])], fields: "userEnteredValue",
        } },
      ] },
    });

    return NextResponse.json({ ok: true, adjustmentId: id, beforeQty: stock.rawQty, delta, afterQty: targetQty });
  } catch (error: any) {
    console.error("INVENTORY ADJUSTMENT ERROR:", error);
    return NextResponse.json({ error: error?.message || "Unable to record stock adjustment" }, { status: 500 });
  }
}
