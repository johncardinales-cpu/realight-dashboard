import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const CUSTOMERS_SHEET = "Customers";
const AUDIT_LOG_SHEET = "Audit_Log";

const CUSTOMER_HEADERS = [
  "Customer ID",
  "Created At",
  "Customer Name",
  "Contact Person",
  "Phone",
  "Email",
  "Address",
  "Customer Type",
  "Status",
  "Notes",
];

const AUDIT_HEADERS = [
  "Audit ID",
  "Created At",
  "Module",
  "Action",
  "Record ID",
  "Record Ref",
  "Actor",
  "Summary",
  "Before JSON",
  "After JSON",
];

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function safeText(value: unknown) {
  return String(value || "").trim();
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

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${lastCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
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
        "Customers",
        entry.action,
        entry.recordId,
        entry.recordRef,
        entry.actor || "Admin",
        entry.summary,
        entry.before ? JSON.stringify(entry.before) : "",
        entry.after ? JSON.stringify(entry.after) : "",
      ]],
    },
  });
}

function parseCustomer(row: string[], index: number) {
  return {
    rowNumber: index + 2,
    customerId: safeText(row[0]),
    createdAt: safeText(row[1]),
    customerName: safeText(row[2]),
    contactPerson: safeText(row[3]),
    phone: safeText(row[4]),
    email: safeText(row[5]),
    address: safeText(row[6]),
    customerType: safeText(row[7]) || "Retail",
    status: safeText(row[8]) || "Active",
    notes: safeText(row[9]),
  };
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, CUSTOMERS_SHEET, CUSTOMER_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${CUSTOMERS_SHEET}!A:J`,
    }).catch(() => ({ data: { values: [] } }));

    const rows = (response.data.values || []) as string[][];
    const customers = rows
      .slice(1)
      .map(parseCustomer)
      .filter((row) => row.customerName || row.phone || row.email)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));

    return NextResponse.json(customers);
  } catch (error: any) {
    console.error("CUSTOMERS GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rowNumber = Number(body?.rowNumber || 0);
    const customerId = safeText(body?.customerId) || makeId("CUST");
    const customerName = safeText(body?.customerName);
    const contactPerson = safeText(body?.contactPerson);
    const phone = safeText(body?.phone);
    const email = safeText(body?.email);
    const address = safeText(body?.address);
    const customerType = safeText(body?.customerType || "Retail");
    const status = safeText(body?.status || "Active");
    const notes = safeText(body?.notes);
    const actor = safeText(body?.actor || "Admin");

    if (!customerName) return NextResponse.json({ error: "Customer Name is required" }, { status: 400 });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, CUSTOMERS_SHEET, CUSTOMER_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const createdAt = safeText(body?.createdAt) || new Date().toISOString();
    const row = [customerId, createdAt, customerName, contactPerson, phone, email, address, customerType, status, notes];

    if (rowNumber) {
      const beforeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${CUSTOMERS_SHEET}!A${rowNumber}:J${rowNumber}`,
      }).catch(() => ({ data: { values: [[]] } }));
      const before = beforeResponse.data.values?.[0] || [];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${CUSTOMERS_SHEET}!A${rowNumber}:J${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });

      await appendAuditLog(sheets, {
        action: "UPDATE_CUSTOMER",
        recordId: customerId,
        recordRef: customerName,
        actor,
        summary: `Updated customer ${customerName}`,
        before,
        after: { customerId, customerName, contactPerson, phone, email, address, customerType, status, notes },
      });

      return NextResponse.json({ ok: true, mode: "updated", customerId });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${CUSTOMERS_SHEET}!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    await appendAuditLog(sheets, {
      action: "CREATE_CUSTOMER",
      recordId: customerId,
      recordRef: customerName,
      actor,
      summary: `Created customer ${customerName}`,
      after: { customerId, customerName, contactPerson, phone, email, address, customerType, status, notes },
    });

    return NextResponse.json({ ok: true, mode: "created", customerId });
  } catch (error: any) {
    console.error("CUSTOMERS POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save customer" }, { status: 500 });
  }
}
