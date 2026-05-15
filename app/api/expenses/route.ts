import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const EXPENSES_SHEET = "Expenses";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";
const AUDIT_LOG_SHEET = "Audit_Log";
const SALES_SHEET = "Sales";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const EXPENSE_HEADERS = [
  "Expense Date",
  "Category",
  "Description",
  "Amount",
  "Payment Method",
  "Reference No.",
  "Related Sales Ref No.",
  "Payee",
  "Notes",
  "Created At",
  "Expense ID",
];

const SUPPLIER_HEADERS = [
  "Upload Date",
  "Supplier",
  "Batch / Reference",
  "Invoice No.",
  "Invoice Valid",
  "Product Subtotal",
  "Freight Cost",
  "Delivery Cost",
  "Customs Cost",
  "Other Cost",
  "Total Invoice Cost",
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

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeRef(value: unknown) {
  return safeText(value).toLowerCase();
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

async function appendAuditLog(sheets: any, entry: { module: string; action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
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
        entry.module,
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

async function getSalesRefSet(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SALES_SHEET}!A:AC`,
  }).catch(() => ({ data: { values: [] } }));

  const rows = (response.data.values || []) as string[][];
  const refs = new Set<string>();
  rows.slice(1).forEach((row) => {
    const salesRefNo = normalizeRef(row[1]);
    const groupRef = normalizeRef(row[14]);
    const saleId = normalizeRef(row[22]);
    if (salesRefNo) refs.add(salesRefNo);
    if (groupRef) refs.add(groupRef);
    if (saleId) refs.add(saleId);
  });
  return refs;
}

function parseExpenseRow(row: string[], header: string[]) {
  const map: Record<string, string> = {};
  header.forEach((h, i) => {
    map[safeText(h)] = safeText(row[i]);
  });

  const date = map["Expense Date"] || map["Date"] || map["Upload Date"] || "";
  const category = map["Category"] || "General Expense";
  const description = map["Description"] || map["Expense"] || "";
  const amount = toNumber(map["Amount"] || map["Total"] || map["Expense Amount"]);
  const reference = map["Reference No."] || map["Reference"] || "";
  const notes = map["Notes"] || "";
  const paymentMethod = map["Payment Method"] || "";
  const relatedSalesRefNo = map["Related Sales Ref No."] || "";
  const payee = map["Payee"] || "";
  const expenseId = map["Expense ID"] || "";

  if (!date && !description && !amount) return null;

  return {
    Date: date,
    Category: category,
    Description: description,
    Amount: amount,
    PaymentMethod: paymentMethod,
    Reference: reference,
    RelatedSalesRefNo: relatedSalesRefNo,
    Payee: payee,
    Source: "Expenses",
    Notes: notes,
    ExpenseID: expenseId,
  };
}

function parseSupplierRow(row: string[]) {
  const date = safeText(row[0]);
  const supplier = safeText(row[1]);
  const batchReference = safeText(row[2]);
  const invoiceNo = safeText(row[3]);
  const totalInvoiceCost = toNumber(row[10]);
  const notes = safeText(row[11]);

  if (!date && !supplier && !totalInvoiceCost) return null;

  return {
    Date: date,
    Category: "Supplier Invoice Cost",
    Description: supplier,
    Amount: totalInvoiceCost,
    PaymentMethod: "",
    Reference: invoiceNo || batchReference,
    RelatedSalesRefNo: "",
    Payee: supplier,
    Source: "Supplier_Invoice_Costs",
    Notes: notes,
    ExpenseID: "",
  };
}

async function ensureSupplierSheetExists(sheets: any) {
  await ensureSheetExists(sheets, SUPPLIER_COSTS_SHEET, SUPPLIER_HEADERS);
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    await ensureSheetExists(sheets, EXPENSES_SHEET, EXPENSE_HEADERS);
    await ensureSupplierSheetExists(sheets);

    const [expensesRes, supplierRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${EXPENSES_SHEET}!A:K` }).catch(() => ({ data: { values: [] } })),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SUPPLIER_COSTS_SHEET}!A:L` }),
    ]);

    const expenseRows = expensesRes.data.values || [];
    const supplierRows = supplierRes.data.values || [];

    let items: Array<{
      Date: string;
      Category: string;
      Description: string;
      Amount: number;
      PaymentMethod: string;
      Reference: string;
      RelatedSalesRefNo: string;
      Payee: string;
      Source: string;
      Notes: string;
      ExpenseID: string;
    }> = [];

    if (expenseRows.length) {
      const header = expenseRows[0].map(safeText);
      items.push(...expenseRows.slice(1).map((row) => parseExpenseRow(row, header)).filter(Boolean) as any);
    }

    if (supplierRows.length) {
      items.push(...supplierRows.slice(1).map(parseSupplierRow).filter(Boolean) as any);
    }

    items = items.sort((a, b) => {
      const da = new Date(a.Date || "1900-01-01").getTime();
      const db = new Date(b.Date || "1900-01-01").getTime();
      return db - da;
    });

    const totalAmount = items.reduce((sum, item) => sum + item.Amount, 0);

    return NextResponse.json({ rows: items, totalAmount });
  } catch (error: any) {
    console.error("EXPENSES API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expenseDate = safeText(body?.expenseDate || new Date().toISOString().slice(0, 10));
    const category = safeText(body?.category || "Miscellaneous");
    const description = safeText(body?.description);
    const amount = toNumber(body?.amount);
    const paymentMethod = safeText(body?.paymentMethod);
    const referenceNo = safeText(body?.referenceNo);
    const relatedSalesRefNo = safeText(body?.relatedSalesRefNo);
    const payee = safeText(body?.payee);
    const notes = safeText(body?.notes);
    const actor = safeText(body?.actor || "Admin");

    if (!expenseDate) return NextResponse.json({ error: "Expense Date is required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, EXPENSES_SHEET, EXPENSE_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    if (relatedSalesRefNo) {
      const refs = await getSalesRefSet(sheets);
      if (!refs.has(normalizeRef(relatedSalesRefNo))) {
        return NextResponse.json({ error: `Related Sales Ref No. was not found in Sales: ${relatedSalesRefNo}` }, { status: 400 });
      }
    }

    const createdAt = new Date().toISOString();
    const expenseId = makeId("EXP");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${EXPENSES_SHEET}!A:K`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[expenseDate, category, description, amount, paymentMethod, referenceNo, relatedSalesRefNo, payee, notes, createdAt, expenseId]],
      },
    });

    await appendAuditLog(sheets, {
      module: "Expenses",
      action: "CREATE_EXPENSE",
      recordId: expenseId,
      recordRef: referenceNo || relatedSalesRefNo || category,
      actor,
      summary: `Recorded expense ${amount} for ${category}: ${description}${relatedSalesRefNo ? ` linked to sale ${relatedSalesRefNo}` : ""}`,
      after: { expenseId, expenseDate, category, description, amount, paymentMethod, referenceNo, relatedSalesRefNo, payee, notes },
    });

    return NextResponse.json({ ok: true, expenseId });
  } catch (error: any) {
    console.error("EXPENSES POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save expense" }, { status: 500 });
  }
}
