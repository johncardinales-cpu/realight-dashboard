import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const CONFIRMATION_TEXT = "RESET HARD TEST";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SHEET_HEADERS: Record<string, string[]> = {
  Sales: [
    "Sale Date","Sales Ref No.","Customer Name","Description","Specification","Qty",
    "Manual Unit Price (PHP)","Total Sale (PHP)","Cost Price (PHP)","Total Cost (PHP)",
    "Gross Profit (PHP)","Payment Status","Salesperson","Notes","Group Ref",
    "Payment Method","Amount Paid (PHP)","Balance (PHP)","Transaction Ref",
    "Cashier Name","Sale Status","Confirmed At","Sale ID","Sale Item ID","Created At",
    "Product Subtotal (PHP)","Tax Rate (%)","Tax Amount (PHP)","Grand Total (PHP)",
    "Delivery Fee (PHP)","Installation Fee (PHP)","Other Charge (PHP)","Discount (PHP)","Customer ID",
  ],
  Payments: ["Payment Date","Sales Ref No.","Group Ref","Customer Name","Payment Method","Amount Paid (PHP)","Transaction Ref","Cashier Name","Notes","Created At","Payment ID","Sale ID"],
  Expenses: ["Expense Date","Category","Description","Base Amount","Tax / VAT / Fee","Total Amount","Payment Method","Reference No.","Related Sales Ref No.","Payee","Notes","Created At","Expense ID"],
  App_Deliveries: ["Delivery ID","Upload Date","Supplier","Batch / PO Ref","Description","Specification","Qty","Unit","Unit Cost PHP","Status","Expected Arrival","Received Date","Notes"],
  Pricing_Base: ["Pricing ID","Description","Specification","Category","Unit","Currency","Unit Cost PHP","Cost Price PHP","Selling Price PHP","Margin PHP","Margin %","Supplier","Updated At","Notes"],
  Customers: ["Customer ID","Customer Name","Customer Type","Contact Person","Phone","Email","Address","Status","Created At","Notes"],
  Supplier_Invoice_Costs: ["Upload Date","Supplier","Batch / Reference","Invoice No.","Invoice Valid","Product Subtotal","Freight Cost","Delivery Cost","Customs Cost","Other Cost","Total Invoice Cost","Notes"],
  Audit_Log: ["Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON"],
};

const RESET_SHEETS = Object.keys(SHEET_HEADERS);

function columnLetter(index: number) {
  let column = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }
  return column || "A";
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function safeSheetName(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 90);
}

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function getExistingSheetTitles(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  return new Set((meta.data.sheets || []).map((sheet: any) => sheet.properties?.title).filter(Boolean));
}

async function ensureSheet(sheets: any, title: string) {
  const existing = await getExistingSheetTitles(sheets);
  if (!existing.has(title)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
}

async function readSheet(sheets: any, title: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${title}!A:ZZ` }).catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as string[][];
}

async function writeHeaders(sheets: any, title: string, headers: string[]) {
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1:${lastCol}1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
}

async function backupSheet(sheets: any, sourceTitle: string, rows: string[][], batchStamp: string) {
  const backupTitle = safeSheetName(`BACKUP_${sourceTitle}_${batchStamp}`);
  await ensureSheet(sheets, backupTitle);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${backupTitle}!A:ZZ` });
  const backupRows = rows.length ? rows : [SHEET_HEADERS[sourceTitle] || [sourceTitle]];
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${backupTitle}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: backupRows } });
  return backupTitle;
}

async function resetActiveSheet(sheets: any, title: string, headers: string[]) {
  await ensureSheet(sheets, title);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${title}!A:ZZ` });
  await writeHeaders(sheets, title, headers);
}

async function appendAudit(sheets: any, actor: string, batchStamp: string, backups: Record<string, string>, cleared: Record<string, number>) {
  await ensureSheet(sheets, "Audit_Log");
  await writeHeaders(sheets, "Audit_Log", SHEET_HEADERS.Audit_Log);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Audit_Log!A:J",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        `AUDIT_${batchStamp}`,
        new Date().toISOString(),
        "Testing Reset",
        "FULL_HARD_TEST_RESET",
        `RESET_${batchStamp}`,
        CONFIRMATION_TEXT,
        actor || "Admin",
        `Backed up and cleared full hard-test data sheets: ${RESET_SHEETS.join(", ")}`,
        "",
        JSON.stringify({ backups, cleared }),
      ]],
    },
  });
}

export async function GET() {
  try {
    const sheets = await getSheets();
    const existing = await getExistingSheetTitles(sheets);
    const counts: Record<string, number> = {};
    for (const title of RESET_SHEETS) {
      if (!existing.has(title)) {
        counts[title] = 0;
        continue;
      }
      const rows = await readSheet(sheets, title);
      counts[title] = Math.max(rows.length - 1, 0);
    }
    return NextResponse.json({
      confirmationText: CONFIRMATION_TEXT,
      willReset: RESET_SHEETS,
      willKeepIntact: ["Backup tabs", "Google Sheet file", "Sheet headers"],
      counts,
      salesRows: counts.Sales || 0,
      paymentRows: counts.Payments || 0,
      auditRows: counts.Audit_Log || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load reset status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || "").trim();
    const actor = String(body?.actor || "Admin").trim();
    if (confirmation !== CONFIRMATION_TEXT) {
      return NextResponse.json({ error: `Type ${CONFIRMATION_TEXT} exactly before running reset.` }, { status: 400 });
    }

    const sheets = await getSheets();
    const batchStamp = stamp();
    const backups: Record<string, string> = {};
    const cleared: Record<string, number> = {};

    for (const title of RESET_SHEETS) {
      await ensureSheet(sheets, title);
      const rows = await readSheet(sheets, title);
      backups[title] = await backupSheet(sheets, title, rows, batchStamp);
      cleared[title] = Math.max(rows.length - 1, 0);
      await resetActiveSheet(sheets, title, SHEET_HEADERS[title]);
    }

    await appendAudit(sheets, actor, batchStamp, backups, cleared);

    return NextResponse.json({
      ok: true,
      message: "Full hard-test reset completed. Backup tabs were created before clearing active data.",
      backups,
      cleared,
      stamp: batchStamp,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Reset failed" }, { status: 500 });
  }
}
