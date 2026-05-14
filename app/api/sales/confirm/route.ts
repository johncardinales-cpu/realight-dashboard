import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const INVENTORY_SHEET = "App_Deliveries";
const AUDIT_LOG_SHEET = "Audit_Log";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const AUDIT_HEADERS = [
  "Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON",
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function itemKey(description: string, specification: string) {
  return `${safeText(description)}|||${safeText(specification)}`;
}

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
}

function columnLetter(index: number) {
  let column = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }
  return column;
}

function saleKey(salesRefNo: string, groupRef: string) {
  return safeText(groupRef) || safeText(salesRefNo);
}

function isValidSalesRow(row: string[]) {
  return Boolean(
    safeText(row[0]) &&
    safeText(row[2]) &&
    safeText(row[3]) &&
    safeText(row[4]) &&
    toNumber(row[5]) > 0 &&
    safeText(row[0]).toLowerCase() !== "date"
  );
}

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1:${lastCol}1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
}

async function appendAuditLog(sheets: any, entry: { action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        makeId("AUDIT"),
        new Date().toISOString(),
        "Sales",
        entry.action,
        entry.recordId,
        entry.recordRef,
        entry.actor,
        entry.summary,
        entry.before ? JSON.stringify(entry.before) : "",
        entry.after ? JSON.stringify(entry.after) : "",
      ]],
    },
  });
}

async function readSalesRows(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:Y` });
  return (response.data.values || []) as string[][];
}

async function getAvailableStockMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${INVENTORY_SHEET}!A:L` });
  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();

  rows.slice(1).forEach((row) => {
    const description = safeText(row[4]);
    const specification = safeText(row[5]);
    const qty = toNumber(row[6]);
    const status = safeText(row[9]).toLowerCase();
    if (!description && !specification) return;
    const key = itemKey(description, specification);
    const current = map.get(key) || 0;
    if (status === "available") map.set(key, current + qty);
    else if (["damaged", "defective", "damage"].includes(status)) map.set(key, current - qty);
  });

  return map;
}

function getConfirmedSoldMap(salesRows: string[][], saleIdBeingConfirmed: string, saleKeyBeingConfirmed: string) {
  const map = new Map<string, number>();

  salesRows.slice(1).filter(isValidSalesRow).forEach((row) => {
    const rowSaleId = safeText(row[22]);
    const rowKey = saleKey(row[1], row[14]);
    const saleStatus = safeText(row[20]).toLowerCase() || "draft";
    if (saleStatus !== "confirmed") return;
    if ((saleIdBeingConfirmed && rowSaleId === saleIdBeingConfirmed) || (saleKeyBeingConfirmed && rowKey === saleKeyBeingConfirmed)) return;

    const key = itemKey(row[3], row[4]);
    map.set(key, (map.get(key) || 0) + toNumber(row[5]));
  });

  return map;
}

function findTargetRows(salesRows: string[][], body: any) {
  const saleId = safeText(body?.saleId);
  const salesRefNo = safeText(body?.salesRefNo);
  const groupRef = safeText(body?.groupRef);
  const key = saleKey(salesRefNo, groupRef);

  return salesRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
    const rowSaleId = safeText(row[22]);
    const rowSalesRefNo = safeText(row[1]);
    const rowGroupRef = safeText(row[14]);
    const rowKey = saleKey(rowSalesRefNo, rowGroupRef);
    if (saleId && rowSaleId === saleId) return true;
    if (key && rowKey === key) return true;
    if (salesRefNo && rowSalesRefNo === salesRefNo) return true;
    if (groupRef && rowGroupRef === groupRef) return true;
    return false;
  });
}

function summarizeTarget(targetRows: Array<{ row: string[]; rowNumber: number }>) {
  const first = targetRows[0]?.row || [];
  const totalSale = targetRows.reduce((sum, item) => sum + toNumber(item.row[7]), 0);
  const paid = targetRows.reduce((sum, item) => sum + toNumber(item.row[16]), 0);
  const balance = targetRows.reduce((sum, item) => sum + toNumber(item.row[17]), 0);
  const saleStatus = safeText(first[20]) || "Draft";
  const paymentStatus = safeText(first[11]) || (balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending");
  const saleId = safeText(first[22]);
  const salesRefNo = safeText(first[1]);
  const groupRef = safeText(first[14]);

  return {
    saleId,
    salesRefNo,
    groupRef,
    key: saleKey(salesRefNo, groupRef),
    customerName: safeText(first[2]),
    totalSale,
    paid,
    balance,
    paymentStatus,
    saleStatus,
    items: targetRows.map(({ row }) => ({ description: safeText(row[3]), specification: safeText(row[4]), qty: toNumber(row[5]) })),
  };
}

async function validateStock(sheets: any, salesRows: string[][], target: ReturnType<typeof summarizeTarget>) {
  const availableStockMap = await getAvailableStockMap(sheets);
  const confirmedSoldMap = getConfirmedSoldMap(salesRows, target.saleId, target.key);
  const requestedMap = new Map<string, { description: string; specification: string; qty: number }>();

  target.items.forEach((item) => {
    const key = itemKey(item.description, item.specification);
    const current = requestedMap.get(key);
    requestedMap.set(key, { ...item, qty: (current?.qty || 0) + item.qty });
  });

  const insufficient: string[] = [];
  requestedMap.forEach((item, key) => {
    const available = Math.max((availableStockMap.get(key) || 0) - (confirmedSoldMap.get(key) || 0), 0);
    if (item.qty > available) insufficient.push(`${item.description} / ${item.specification}: requested ${item.qty}, available ${available}`);
  });

  return insufficient.length ? `Insufficient confirmed stock. ${insufficient.join("; ")}` : "";
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const action = safeText(body?.action || "confirm").toLowerCase();
    const actor = safeText(body?.actor || body?.cashierName || "System");

    if (action !== "confirm") {
      return NextResponse.json({ error: "Unsupported sales action" }, { status: 400 });
    }

    const sheets = await getSheets();
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const salesRows = await readSalesRows(sheets);
    const targetRows = findTargetRows(salesRows, body);

    if (!targetRows.length) {
      return NextResponse.json({ error: "Sale was not found" }, { status: 404 });
    }

    const target = summarizeTarget(targetRows);
    const normalizedSaleStatus = target.saleStatus.toLowerCase();
    const normalizedPaymentStatus = target.paymentStatus.toLowerCase();

    if (normalizedSaleStatus === "confirmed") {
      return NextResponse.json({ ok: true, message: "Sale is already confirmed", sale: target });
    }

    if (normalizedSaleStatus === "cancelled") {
      return NextResponse.json({ error: "Cancelled sales cannot be confirmed" }, { status: 400 });
    }

    if (normalizedPaymentStatus === "pending" && target.paid <= 0) {
      return NextResponse.json({ error: "Pending/unpaid sales cannot be confirmed. Record a payment first." }, { status: 400 });
    }

    const stockError = await validateStock(sheets, salesRows, target);
    if (stockError) {
      return NextResponse.json({ error: stockError }, { status: 409 });
    }

    const confirmedAt = new Date().toISOString();
    const updateData = targetRows.flatMap(({ rowNumber }) => [
      { range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Confirmed", confirmedAt]] },
    ]);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updateData },
    });

    await appendAuditLog(sheets, {
      action: "CONFIRM_SALE",
      recordId: target.saleId || target.key,
      recordRef: target.salesRefNo || target.groupRef,
      actor,
      summary: `Confirmed sale ${target.salesRefNo || target.groupRef} with ${targetRows.length} line(s)` ,
      before: { saleStatus: target.saleStatus, paymentStatus: target.paymentStatus, balance: target.balance },
      after: { saleStatus: "Confirmed", confirmedAt, paymentStatus: target.paymentStatus, balance: target.balance },
    });

    return NextResponse.json({
      ok: true,
      message: "Sale confirmed successfully",
      confirmedAt,
      sale: { ...target, saleStatus: "Confirmed", confirmedAt },
    });
  } catch (error: any) {
    console.error("CONFIRM SALE ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to confirm sale" }, { status: 500 });
  }
}
