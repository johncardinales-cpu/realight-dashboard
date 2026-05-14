import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PAYMENTS_SHEET = "Payments";
const AUDIT_LOG_SHEET = "Audit_Log";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SALES_HEADERS = [
  "Sale Date","Sales Ref No.","Customer Name","Description","Specification","Qty",
  "Manual Unit Price (PHP)","Total Sale (PHP)","Cost Price (PHP)","Total Cost (PHP)",
  "Gross Profit (PHP)","Payment Status","Salesperson","Notes","Group Ref",
  "Payment Method","Amount Paid (PHP)","Balance (PHP)","Transaction Ref",
  "Cashier Name","Sale Status","Confirmed At","Sale ID","Sale Item ID","Created At",
];

const PAYMENT_HEADERS = [
  "Payment Date","Sales Ref No.","Group Ref","Customer Name","Payment Method",
  "Amount Paid (PHP)","Transaction Ref","Cashier Name","Notes","Created At",
  "Payment ID","Sale ID",
];

const AUDIT_HEADERS = [
  "Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON",
];

function safeText(value: unknown) {
  return String(value || "").trim();
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

function compactTimestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function getSpreadsheetMeta(sheets: any) {
  return sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
}

async function sheetExists(sheets: any, title: string) {
  const meta = await getSpreadsheetMeta(sheets);
  return Boolean((meta.data.sheets || []).find((s: any) => s.properties?.title === title));
}

async function ensureSheetExists(sheets: any, title: string, headers?: string[]) {
  const exists = await sheetExists(sheets, title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
  if (headers?.length) {
    const lastCol = columnLetter(headers.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${title}!A1:${lastCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
    .catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

async function copyRowsToBackupSheet(sheets: any, sourceTitle: string, backupTitle: string, rows: string[][]) {
  await ensureSheetExists(sheets, backupTitle);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${backupTitle}!A:Z` });
  if (!rows.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${backupTitle}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

async function resetSheetToHeaders(sheets: any, title: string, headers: string[]) {
  await ensureSheetExists(sheets, title);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${title}!A:Z` });
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${lastCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
}

async function appendAuditLog(sheets: any, entry: { action: string; actor: string; summary: string; after?: unknown }) {
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
        "Testing Reset",
        entry.action,
        makeId("RESET"),
        "Sales/Payments/Audit reset",
        entry.actor,
        entry.summary,
        "",
        entry.after ? JSON.stringify(entry.after) : "",
      ]],
    },
  });
}

export async function GET() {
  try {
    const sheets = await getSheets();
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const [salesRows, paymentRows, auditRows] = await Promise.all([
      readRange(sheets, `${SALES_SHEET}!A:Y`),
      readRange(sheets, `${PAYMENTS_SHEET}!A:L`),
      readRange(sheets, `${AUDIT_LOG_SHEET}!A:J`),
    ]);

    return NextResponse.json({
      salesRows: Math.max(salesRows.length - 1, 0),
      paymentRows: Math.max(paymentRows.length - 1, 0),
      auditRows: Math.max(auditRows.length - 1, 0),
      willKeepIntact: ["App_Deliveries", "Pricing_Base", "Expenses", "Supplier_Invoice_Costs"],
      willReset: [SALES_SHEET, PAYMENTS_SHEET, AUDIT_LOG_SHEET],
      confirmationText: "RESET TEST DATA",
    });
  } catch (error: any) {
    console.error("TESTING RESET STATUS ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load reset status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const confirmation = safeText(body?.confirmation);
    const actor = safeText(body?.actor || "Admin");

    if (confirmation !== "RESET TEST DATA") {
      return NextResponse.json({ error: "Type RESET TEST DATA exactly before running reset" }, { status: 400 });
    }

    const sheets = await getSheets();
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const stamp = compactTimestamp();
    const backupSalesSheet = `Backup_Sales_${stamp}`;
    const backupPaymentsSheet = `Backup_Payments_${stamp}`;
    const backupAuditSheet = `Backup_Audit_${stamp}`;

    const [salesRows, paymentRows, auditRows] = await Promise.all([
      readRange(sheets, `${SALES_SHEET}!A:Y`),
      readRange(sheets, `${PAYMENTS_SHEET}!A:L`),
      readRange(sheets, `${AUDIT_LOG_SHEET}!A:J`),
    ]);

    await copyRowsToBackupSheet(sheets, SALES_SHEET, backupSalesSheet, salesRows.length ? salesRows : [SALES_HEADERS]);
    await copyRowsToBackupSheet(sheets, PAYMENTS_SHEET, backupPaymentsSheet, paymentRows.length ? paymentRows : [PAYMENT_HEADERS]);
    await copyRowsToBackupSheet(sheets, AUDIT_LOG_SHEET, backupAuditSheet, auditRows.length ? auditRows : [AUDIT_HEADERS]);

    await resetSheetToHeaders(sheets, SALES_SHEET, SALES_HEADERS);
    await resetSheetToHeaders(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await resetSheetToHeaders(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    await appendAuditLog(sheets, {
      action: "RESET_TEST_DATA",
      actor,
      summary: `Reset test transaction data after backing up Sales, Payments, and Audit_Log at ${stamp}`,
      after: {
        backupSalesSheet,
        backupPaymentsSheet,
        backupAuditSheet,
        clearedSalesRows: Math.max(salesRows.length - 1, 0),
        clearedPaymentRows: Math.max(paymentRows.length - 1, 0),
        previousAuditRows: Math.max(auditRows.length - 1, 0),
        keptIntact: ["App_Deliveries", "Pricing_Base", "Expenses", "Supplier_Invoice_Costs"],
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Testing data reset complete. Sales and Payments are empty; inventory source data is intact.",
      backups: { backupSalesSheet, backupPaymentsSheet, backupAuditSheet },
      cleared: {
        salesRows: Math.max(salesRows.length - 1, 0),
        paymentRows: Math.max(paymentRows.length - 1, 0),
        auditRows: Math.max(auditRows.length - 1, 0),
      },
    });
  } catch (error: any) {
    console.error("TESTING RESET POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to reset testing data" }, { status: 500 });
  }
}
