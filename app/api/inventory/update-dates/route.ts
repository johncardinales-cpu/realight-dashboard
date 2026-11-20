import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  DELIVERY_ACTION_HEADERS, DELIVERY_ACTIONS_SHEET,
  deliveryKey, verifyDeliveryHeaders, verifyDeliveryActionHeaders, validDeliveryNote,
} from "@/lib/delivery-actions";

const SOURCE = "App_Deliveries";
const AUDIT = "Audit_Log";
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function txt(value: unknown): string { return String(value ?? "").trim(); }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function rowCells(values: string[]) { return { values: values.map(value => ({ userEnteredValue: { stringValue: value } })) }; }
function setCell(sheetId: number, row: number, column: number, value: string) {
  return { updateCells: { start: { sheetId, rowIndex: row - 1, columnIndex: column }, rows: [rowCells([value])], fields: "userEnteredValue" } };
}

export async function POST(request: NextRequest) {
  try {
    const admin = await readSession(request.cookies.get("realights_session")?.value);
    if (!admin) return NextResponse.json({ error: "Authenticated admin required." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const description = txt(body?.description), specification = txt(body?.specification);
    const expected = txt(body?.latestIncoming), received = txt(body?.latestReceived);
    const note = txt(body?.note);
    if (!description || !specification || !validDeliveryNote(note) ||
        (!expected && !received) || (expected && !validDate(expected)) || (received && !validDate(received))) {
      return NextResponse.json({ error: "Product, valid date and action note (8–500 characters) are required." }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const sourceResult = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SOURCE}!A:M` });
    const rows = (sourceResult.data.values || []) as string[][];
    verifyDeliveryHeaders(rows[0] || []);
    const affected: Array<{ row: number; before: string; after: string; col: number; delivery: string[] }> = [];
    for (let index = 1; index < rows.length; index++) {
      const delivery = rows[index];
      if (txt(delivery[4]) !== description || txt(delivery[5]) !== specification) continue;
      const status = txt(delivery[9]).toLowerCase();
      const incoming = ["incoming", "in transit"].includes(status);
      const available = ["received", "available"].includes(status);
      const target = incoming ? expected : available ? received : "";
      const col = incoming ? 10 : 11; // K expected arrival, L received date
      if (!target || target === txt(delivery[col])) continue;
      affected.push({ row: index + 1, before: txt(delivery[col]), after: target, col, delivery });
    }
    if (!affected.length) return NextResponse.json({ ok: true, updated: 0, message: "No delivery dates needed changing." });
    if (affected.length > 100) return NextResponse.json({ error: "Too many delivery dates selected. Contact administrator." }, { status: 409 });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(title,sheetId))" });
    const ids = new Map<string, number>();
    for (const item of meta.data.sheets || []) {
      const title = item.properties?.title, id = item.properties?.sheetId;
      if (title && typeof id === "number") ids.set(title, id);
    }
    if (!ids.has(SOURCE) || !ids.has(AUDIT)) throw new Error("Required inventory or audit worksheet is missing.");
    if (!ids.has(DELIVERY_ACTIONS_SHEET)) {
      const created = await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: DELIVERY_ACTIONS_SHEET } } }] } });
      const id = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
      if (typeof id !== "number") throw new Error("Unable to create action history.");
      ids.set(DELIVERY_ACTIONS_SHEET, id);
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID,
        range: `${DELIVERY_ACTIONS_SHEET}!A1:I1`, valueInputOption: "RAW",
        requestBody: { values: [[...DELIVERY_ACTION_HEADERS]] } });
    }
    const headers = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID,
      ranges: [`${DELIVERY_ACTIONS_SHEET}!A1:I1`, `${AUDIT}!A1:J1`] });
    verifyDeliveryActionHeaders(headers.data.valueRanges?.[0]?.values?.[0] || []);
    if (AUDIT_HEADERS.some((value, i) => txt(headers.data.valueRanges?.[1]?.values?.[0]?.[i]) !== value)) {
      throw new Error("Audit_Log headers do not match; dates were not changed.");
    }
    const now = new Date().toISOString();
    const requests: any[] = [];
    for (const item of affected) {
      const beforeNotes = txt(item.delivery[12]);
      const eventId = `DEL_${randomUUID()}`;
      const reason = `${now} [${admin.email}] Updated date ${item.before || "empty"} -> ${item.after}: ${note}`;
      const appended = beforeNotes ? beforeNotes + "\n" + reason : reason;
      if (appended.length > 45000) throw new Error("Delivery notes exceed maximum length.");
      requests.push(setCell(ids.get(SOURCE)!, item.row, item.col, item.after));
      requests.push(setCell(ids.get(SOURCE)!, item.row, 12, appended));
      requests.push({ appendCells: { sheetId: ids.get(DELIVERY_ACTIONS_SHEET)!,
        rows: [rowCells([eventId, now, deliveryKey(item.delivery), String(item.row),
          "UPDATE_DATES", txt(item.delivery[9]), txt(item.delivery[9]), note, admin.email])],
        fields: "userEnteredValue" } });
      requests.push({ appendCells: { sheetId: ids.get(AUDIT)!,
        rows: [rowCells([`AUDIT_${randomUUID()}`, now, "Incoming Deliveries", "UPDATE_DATES",
          eventId, txt(item.delivery[3]) || txt(item.delivery[0]), admin.email,
          `Changed ${item.col === 10 ? "expected" : "received"} date: ${note}`,
          JSON.stringify({ date: item.before, column: item.col === 10 ? "Expected Arrival" : "Received Date" }),
          JSON.stringify({ date: item.after, column: item.col === 10 ? "Expected Arrival" : "Received Date", note }),
        ])], fields: "userEnteredValue" } });
    }
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
    return NextResponse.json({ ok: true, updated: affected.length });
  } catch (error) {
    console.error("INVENTORY UPDATE DATES ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update inventory dates." }, { status: 500 });
  }
}
