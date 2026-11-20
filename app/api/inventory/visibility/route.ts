import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import { currentStockForItem, readStockAdjustmentRows } from "@/lib/stock-adjustments";
import {
  INVENTORY_VISIBILITY_SHEET, INVENTORY_VISIBILITY_HEADERS,
  inventoryKey, archivedInventoryKeys, readInventoryVisibilityRows,
} from "@/lib/inventory-visibility";

const AUDIT_SHEET = "Audit_Log";
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function text(value: unknown) { return String(value ?? "").trim(); }

async function verifiedAdmin(request: NextRequest, code: string) {
  const session = await readSession(request.cookies.get("realights_session")?.value);
  const secret = text(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE);
  if (!session || !code || code.length > 512 || !secret) return null;
  const a = Buffer.from(code, "utf8"), b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b) ? session.email : null;
}

function makeRow(values: Array<string | number>) {
  return {
    values: values.map(value => ({
      userEnteredValue: typeof value === "number"
        ? { numberValue: value } : { stringValue: value },
    })),
  };
}

async function ensureVisibilityLedger(sheets: any) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title))",
  });
  const names = new Map<string, number>();
  for (const item of meta.data.sheets || []) {
    const title = item.properties?.title;
    const id = item.properties?.sheetId;
    if (title && typeof id === "number") names.set(title, id);
  }
  for (const [name, headers] of [
    [INVENTORY_VISIBILITY_SHEET, INVENTORY_VISIBILITY_HEADERS],
    [AUDIT_SHEET, AUDIT_HEADERS],
  ] as const) {
    if (names.has(name)) continue;
    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    const id = result.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (typeof id !== "number") throw new Error("Unable to create inventory activity log.");
    names.set(name, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${name}!A1:${name === AUDIT_SHEET ? "J" : "G"}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
  }
  const headers = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: [`${INVENTORY_VISIBILITY_SHEET}!A1:G1`, `${AUDIT_SHEET}!A1:J1`],
  });
  [INVENTORY_VISIBILITY_HEADERS, AUDIT_HEADERS].forEach((required, index) => {
    const row = (headers.data.valueRanges?.[index]?.values?.[0] || []).map(text);
    if (required.some((value, idx) => row[idx] !== value)) {
      throw new Error("Inventory visibility or audit headers do not match; no item was archived.");
    }
  });
  return { ledgerId: names.get(INVENTORY_VISIBILITY_SHEET)!, auditId: names.get(AUDIT_SHEET)! };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await verifiedAdmin(request, text(body?.adminCode));
    if (!actor) return NextResponse.json({ error: "Verified admin session and access code required." }, { status: 403 });

    const description = text(body?.description);
    const specification = text(body?.specification);
    const reason = text(body?.reason);
    const action = text(body?.action).toUpperCase();
    const expectedQty = body?.expectedQty;
    const expectedArchived = body?.expectedArchived;
    if (!description || !specification || description.length > 200 || specification.length > 200) {
      return NextResponse.json({ error: "Select a valid inventory item." }, { status: 400 });
    }
    if (reason.length < 8 || reason.length > 250 ||
        !["ARCHIVE", "RESTORE"].includes(action) ||
        !Number.isSafeInteger(expectedQty) || expectedQty < 0 ||
        typeof expectedArchived !== "boolean") {
      return NextResponse.json({ error: "Valid action, reason (8–250 characters), and current stock are required." }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const [deliveries, sales, adjustments, visibility] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "App_Deliveries!A:M" }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Sales!A:Y" }),
      readStockAdjustmentRows(sheets, SHEET_ID),
      readInventoryVisibilityRows(sheets, SHEET_ID),
    ]);
    const deliveryRows = (deliveries.data.values || []) as string[][];
    const stock = currentStockForItem(deliveryRows, (sales.data.values || []) as string[][],
      adjustments, description, specification);
    if (!stock.found) return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    const archived = archivedInventoryKeys(visibility).has(inventoryKey(description, specification));
    if (archived !== expectedArchived || stock.displayQty !== expectedQty) {
      return NextResponse.json({ error: "Inventory changed. Refresh the page and try again." }, { status: 409 });
    }
    if ((action === "ARCHIVE") === archived) {
      return NextResponse.json({ error: "Product is already in this state." }, { status: 409 });
    }
    if (action === "ARCHIVE") {
      const pending = deliveryRows.slice(1).some(row =>
        inventoryKey(row[4], row[5]) === inventoryKey(description, specification) &&
        ["incoming", "in transit", "received"].includes(text(row[9]).toLowerCase()) &&
        Number(row[6]) > 0
      );
      if (stock.rawQty !== 0 || pending) {
        return NextResponse.json({
          error: "Archive is allowed only when on-hand stock is zero and no incoming or receiving delivery is pending.",
        }, { status: 409 });
      }
    }

    const { ledgerId, auditId } = await ensureVisibilityLedger(sheets);
    const timestamp = new Date().toISOString();
    const id = `VIS_${randomUUID()}`;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        { appendCells: { sheetId: ledgerId, rows: [makeRow([
          id, timestamp, description, specification, action, reason, actor,
        ])], fields: "userEnteredValue" } },
        { appendCells: { sheetId: auditId, rows: [makeRow([
          `AUDIT_${randomUUID()}`, timestamp, "Inventory", action, id,
          `${description} / ${specification}`, actor,
          `${action === "ARCHIVE" ? "Archived" : "Restored"} inventory list item: ${reason}`,
          JSON.stringify({ archived }), JSON.stringify({ archived: action === "ARCHIVE" }),
        ])], fields: "userEnteredValue" } },
      ] },
    });
    return NextResponse.json({ ok: true, action, eventId: id, isArchived: action === "ARCHIVE" });
  } catch (error) {
    console.error("INVENTORY VISIBILITY ERROR:", error);
    return NextResponse.json({ error: "Unable to archive or restore inventory item; no deletion was performed." }, { status: 500 });
  }
}
