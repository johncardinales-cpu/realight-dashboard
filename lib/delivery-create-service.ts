import { randomUUID } from "node:crypto";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";
import {
  DELIVERY_ACTIONS_SHEET, DELIVERY_ACTION_HEADERS, verifyDeliveryHeaders,
} from "@/lib/delivery-actions";
import { buildNewDelivery, type DeliveryInput } from "@/lib/delivery-create";

const SOURCE = "App_Deliveries";
const AUDIT = "Audit_Log";
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function text(v: unknown) { return String(v ?? "").trim(); }
function rowCells(values: unknown[]) {
  return { values: values.map(value => ({ userEnteredValue: typeof value === "number" ?
    { numberValue: value } : { stringValue: text(value) } })) };
}

export async function saveNewDeliveries(inputs: DeliveryInput[], actionNote: string, actor: string, imported: boolean, specialAction?: "MARK_DAMAGED") {
  if (!inputs.length || inputs.length > 200) {
    throw new Error("Create between 1 and 200 delivery rows per operation.");
  }
  const sheets = await getSheetsClient();
  const pricingResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: "Pricing_Base!A:H",
  });
  const existingRates = new Map<string, number>();
  for (const row of ((pricingResult.data.values || []) as string[][]).slice(1)) {
    const key = `${text(row[1]).toLowerCase()}|||${text(row[2]).toLowerCase()}`;
    const fx = Number(row[6]);
    if (key !== "|||" && Number.isFinite(fx) && fx > 0) existingRates.set(key, fx);
  }
  const effectiveRates = inputs.map(value => {
    const key = `${text(value.description).toLowerCase()}|||${text(value.specification).toLowerCase()}`;
    const explicit = text(value.fxRate);
    if (explicit) {
      const rate = Number(explicit);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) {
        throw new Error("Invalid FX rate. Enter a positive PHP-per-USD rate.");
      }
      return rate;
    }
    return existingRates.get(key);
  });
  const entries = inputs.map((value, index) => buildNewDelivery(value, actionNote, effectiveRates[index]));
  const headers = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID, ranges: [`${SOURCE}!A1:M1`, `${AUDIT}!A1:J1`],
  });
  verifyDeliveryHeaders(headers.data.valueRanges?.[0]?.values?.[0] || []);
  const auditHeaders = headers.data.valueRanges?.[1]?.values?.[0] || [];
  if (AUDIT_HEADERS.some((value, index) => text(auditHeaders[index]) !== value)) {
    throw new Error("Audit_Log column mapping differs from the expected schema; no delivery was created.");
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(title,sheetId))" });
  const ids = new Map<string, number>();
  for (const entry of meta.data.sheets || []) {
    const title = entry.properties?.title, id = entry.properties?.sheetId;
    if (title && typeof id === "number") ids.set(title, id);
  }
  if (!ids.has(SOURCE) || !ids.has(AUDIT)) throw new Error("Required delivery or audit worksheet is missing.");
  if (!ids.has(DELIVERY_ACTIONS_SHEET)) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID, requestBody: { requests: [{
        addSheet: { properties: { title: DELIVERY_ACTIONS_SHEET } },
      }] },
    });
    const id = added.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (typeof id !== "number") throw new Error("Could not initialize delivery action history.");
    ids.set(DELIVERY_ACTIONS_SHEET, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${DELIVERY_ACTIONS_SHEET}!A1:I1`,
      valueInputOption: "RAW", requestBody: { values: [[...DELIVERY_ACTION_HEADERS]] },
    });
  }
  const actionHeaders = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${DELIVERY_ACTIONS_SHEET}!A1:I1`,
  });
  if (DELIVERY_ACTION_HEADERS.some((header, index) => text(actionHeaders.data.values?.[0]?.[index]) !== header)) {
    throw new Error("Delivery action history columns are invalid.");
  }

  const created = new Date().toISOString();
  const actionName = specialAction || (imported ? "IMPORT_DELIVERY" : "CREATE_DELIVERY");
  const newRows = entries.map(x => rowCells(x.row));
  const actionRows = entries.map(x => {
    const eventId = `DEL_ACTION_${randomUUID()}`;
    return { eventId, cells: rowCells([
      eventId, created, x.key, "", actionName, "", x.status, actionNote, actor,
    ]), entry: x };
  });
  const auditRows = actionRows.map(x => rowCells([
    `AUDIT_${randomUUID()}`, created, "Incoming Deliveries", actionName,
    x.eventId, text(x.entry.row[3]) || text(x.entry.row[0]), actor,
    `${actionName}: ${actionNote}`,
    JSON.stringify({}),
    JSON.stringify({ status: x.entry.status, note: actionNote, deliveryId: x.entry.row[0] }),
  ]));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: {
    requests: [
      { appendCells: { sheetId: ids.get(SOURCE)!, rows: newRows, fields: "userEnteredValue" } },
      { appendCells: { sheetId: ids.get(DELIVERY_ACTIONS_SHEET)!, rows: actionRows.map(x => x.cells), fields: "userEnteredValue" } },
      { appendCells: { sheetId: ids.get(AUDIT)!, rows: auditRows, fields: "userEnteredValue" } },
    ],
  }});
  return { count: entries.length, effectiveRates };
}
