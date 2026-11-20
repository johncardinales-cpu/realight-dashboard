import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import { readSession } from "@/lib/session";
import {
  DELIVERY_ACTION_HEADERS, DELIVERY_ACTIONS_SHEET, DELIVERY_HEADERS,
  deliveryKey, isDeliveryRow, normalizeDeliveryStatus, removedDeliveryKeys,
  readDeliveryActions, verifyDeliveryHeaders, validDeliveryNote, validDeliveryTransition,
  type DeliveryAction, type DeliveryStatus,
} from "@/lib/delivery-actions";

const SOURCE = "App_Deliveries";
const AUDIT = "Audit_Log";
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

type Selection = { rowNumber: number; deliveryKey: string; expectedStatus: DeliveryStatus; expectedRemoved: boolean };
type Candidate = {
  selection: Selection; row: string[]; action: DeliveryAction;
  beforeStatus: DeliveryStatus; afterStatus: DeliveryStatus; notes: string; fillDate: boolean;
};

function txt(value: unknown) { return String(value ?? "").trim(); }
function makeCell(value: string) { return { userEnteredValue: { stringValue: value } }; }
function rowCells(values: string[]) { return { values: values.map(makeCell) }; }
function cellUpdate(sheetId: number, rowNumber: number, columnIndex: number, value: string) {
  return { updateCells: {
    start: { sheetId, rowIndex: rowNumber - 1, columnIndex },
    rows: [rowCells([value])], fields: "userEnteredValue",
  }};
}
function validCode(code: string) {
  const configured = txt(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE);
  const a = Buffer.from(code, "utf8"), b = Buffer.from(configured, "utf8");
  return !!configured && !!code && code.length <= 512 && a.length === b.length && timingSafeEqual(a, b);
}
async function sheetIds(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  const ids = new Map<string, number>();
  for (const sheet of meta.data.sheets || []) {
    const title = sheet.properties?.title, id = sheet.properties?.sheetId;
    if (title && typeof id === "number") ids.set(title, id);
  }
  const deliveryId = ids.get(SOURCE);
  if (deliveryId === undefined || ids.get(AUDIT) === undefined) {
    throw new Error("Delivery or Audit_Log worksheet is missing. No action performed.");
  }
  if (!ids.has(DELIVERY_ACTIONS_SHEET)) {
    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: DELIVERY_ACTIONS_SHEET } } }] },
    });
    const id = result.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (typeof id !== "number") throw new Error("Unable to initialize delivery action history.");
    ids.set(DELIVERY_ACTIONS_SHEET, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${DELIVERY_ACTIONS_SHEET}!A1:I1`,
      valueInputOption: "RAW", requestBody: { values: [[...DELIVERY_ACTION_HEADERS]] },
    });
  }
  const headers = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID, ranges: [`${DELIVERY_ACTIONS_SHEET}!A1:I1`, `${AUDIT}!A1:J1`],
  });
  [DELIVERY_ACTION_HEADERS, AUDIT_HEADERS].forEach((required, index) => {
    const existing = (headers.data.valueRanges?.[index]?.values?.[0] || []).map(txt);
    if (required.some((value, i) => existing[i] !== value)) {
      throw new Error("Delivery action/audit columns do not match. No action performed.");
    }
  });
  return { deliveryId, actionId: ids.get(DELIVERY_ACTIONS_SHEET)!, auditId: ids.get(AUDIT)! };
}

export async function POST(req: NextRequest) {
  try {
    const session = await readSession(req.cookies.get("realights_session")?.value);
    if (!session) return NextResponse.json({ error: "Authorized admin session required." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requestedAction = txt(body?.action).toUpperCase();
    if (!["STATUS_CHANGE", "REMOVE_CANCELLED", "RESTORE_CANCELLED"].includes(requestedAction)) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    const action = requestedAction as DeliveryAction;
    const note = txt(body?.note);
    if (!validDeliveryNote(note)) {
      return NextResponse.json({ error: "Enter an action note between 8 and 500 characters." }, { status: 400 });
    }
    if (action !== "STATUS_CHANGE" && !validCode(txt(body?.adminCode))) {
      return NextResponse.json({ error: "Admin access code is required to remove or restore a canceled delivery." }, { status: 403 });
    }

    const entries = body?.rows;
    if (!Array.isArray(entries) || !entries.length || entries.length > 50 ||
        (action !== "STATUS_CHANGE" && entries.length !== 1)) {
      return NextResponse.json({ error: "Select 1 to 50 deliveries. Remove/Restore requires one delivery." }, { status: 400 });
    }
    const seen = new Set<number>();
    const selections: Selection[] = [];
    for (const entry of entries) {
      const rowNumber = entry?.rowNumber;
      const key = txt(entry?.deliveryKey);
      if (!Number.isSafeInteger(rowNumber) || rowNumber < 2 || seen.has(rowNumber) ||
          !/^[0-9a-f]{64}$/.test(key) || typeof entry?.expectedRemoved !== "boolean") {
        return NextResponse.json({ error: "Invalid or duplicated delivery selection. Refresh and retry." }, { status: 400 });
      }
      seen.add(rowNumber);
      let expectedStatus: DeliveryStatus;
      try { expectedStatus = normalizeDeliveryStatus(entry?.expectedStatus); }
      catch { return NextResponse.json({ error: "Invalid expected status." }, { status: 400 }); }
      selections.push({ rowNumber, deliveryKey: key, expectedStatus, expectedRemoved: entry.expectedRemoved });
    }
    let status: DeliveryStatus | undefined;
    if (action === "STATUS_CHANGE") {
      try { status = normalizeDeliveryStatus(body?.status); }
      catch { return NextResponse.json({ error: "Invalid destination status." }, { status: 400 }); }
    }

    const sheets = await getSheetsClient();
    const [deliveryResp, actionRows] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SOURCE}!A:M` }),
      readDeliveryActions(sheets, SHEET_ID),
    ]);
    const rows = (deliveryResp.data.values || []) as string[][];
    verifyDeliveryHeaders(rows[0] || []);
    const removed = removedDeliveryKeys(actionRows);
    const allKeys = new Map<string, number>();
    for (const row of rows.slice(1)) {
      if (!isDeliveryRow(row)) continue;
      const key = deliveryKey(row);
      allKeys.set(key, (allKeys.get(key) || 0) + 1);
    }
    const changes: Candidate[] = [];
    for (const selection of selections) {
      const row = rows[selection.rowNumber - 1] || [];
      if (!isDeliveryRow(row)) {
        return NextResponse.json({ error: "Delivery row no longer exists. Refresh first." }, { status: 409 });
      }
      const key = deliveryKey(row);
      if (key !== selection.deliveryKey || (allKeys.get(key) || 0) > 1) {
        return NextResponse.json({ error: "Delivery identity has changed or is ambiguous; refresh and review before acting." }, { status: 409 });
      }
      const beforeStatus = normalizeDeliveryStatus(row[9]);
      const isRemoved = removed.has(key);
      if (beforeStatus !== selection.expectedStatus || isRemoved !== selection.expectedRemoved) {
        return NextResponse.json({ error: "Delivery status or visibility changed. Refresh before updating." }, { status: 409 });
      }
      if (!validDeliveryTransition(action, beforeStatus, status || beforeStatus, isRemoved)) {
        return NextResponse.json({
          error: "Action is not allowed for this delivery status or visibility. Refresh before updating.",
        }, { status: 409 });
      }
      const afterStatus = status || beforeStatus;
      const stamp = new Date().toISOString();
      const eventLabel = action === "STATUS_CHANGE"
        ? `${beforeStatus} → ${afterStatus}`
        : action === "REMOVE_CANCELLED" ? "Removed canceled delivery" : "Restored canceled delivery";
      const appendedNote = `${stamp} [${session.email}] ${eventLabel}: ${note}`;
      const existing = txt(row[12]);
      const allNotes = existing ? `${existing}\n${appendedNote}` : appendedNote;
      if (allNotes.length > 45000) {
        return NextResponse.json({ error: "Existing delivery notes are too long; contact an administrator." }, { status: 409 });
      }
      const fillDate = action === "STATUS_CHANGE" &&
        (afterStatus === "Available" || afterStatus === "Damaged") && !txt(row[11]);
      changes.push({ selection, row, action, beforeStatus, afterStatus, notes: allNotes, fillDate });
    }
    const { deliveryId, actionId, auditId } = await sheetIds(sheets);
    const requests: any[] = [];
    for (const change of changes) {
      const { selection, action, row, beforeStatus, afterStatus } = change;
      const timestamp = new Date().toISOString();
      const eventId = `DEL_${randomUUID()}`;
      if (action === "STATUS_CHANGE") {
        requests.push(cellUpdate(deliveryId, selection.rowNumber, 9, afterStatus));
        if (change.fillDate) requests.push(cellUpdate(deliveryId, selection.rowNumber, 11, timestamp.slice(0, 10)));
      }
      requests.push(cellUpdate(deliveryId, selection.rowNumber, 12, change.notes));
      requests.push({ appendCells: { sheetId: actionId, rows: [rowCells([
        eventId, timestamp, selection.deliveryKey, String(selection.rowNumber),
        action, beforeStatus, afterStatus, note, session.email,
      ])], fields: "userEnteredValue" } });
      requests.push({ appendCells: { sheetId: auditId, rows: [rowCells([
        `AUDIT_${randomUUID()}`, timestamp, "Incoming Deliveries", action,
        eventId, txt(row[3]) || txt(row[0]), session.email,
        `${action} ${beforeStatus} -> ${afterStatus}: ${note}`,
        JSON.stringify({ status: beforeStatus, removed: removed.has(selection.deliveryKey), note: txt(row[12]) }),
        JSON.stringify({ status: afterStatus, removed: action === "REMOVE_CANCELLED", note }),
      ])], fields: "userEnteredValue" } });
    }
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
    return NextResponse.json({ ok: true, action, affectedRows: changes.length });
  } catch (error: unknown) {
    console.error("DELIVERY ACTION ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update delivery." }, { status: 500 });
  }
}
