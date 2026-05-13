import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;

const DAILY_REPORTS_SHEET = "Daily Reports";
const COLLECTIONS_SHEET = "Collections";
const EXPENSES_SHEET = "Expenses";
const RETURNS_SHEET = "Returns Bad Orders";
const AUDIT_LOG_SHEET = "Audit Log";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const DAILY_REPORTS_HEADERS = [
  "Report ID",
  "Report Date",
  "Salesman ID",
  "Salesman Name",
  "Route",
  "Vehicle No",
  "Start Time",
  "End Time",
  "Cash Advance",
  "Cash Sales",
  "Collections Total",
  "Approved Expenses",
  "Deposits / Bank Transfers",
  "Expected Cash Remittance",
  "Actual Cash Remitted",
  "Variance",
  "Invoice Scan Count",
  "Expense Receipt Count",
  "Return Count",
  "Status",
  "Accounting Review Status",
  "Reviewed By",
  "Reviewed At",
  "Variance Explanation",
  "Created At",
  "Notes",
];

const COLLECTIONS_HEADERS = [
  "Collection ID",
  "Report ID",
  "Collection DateTime",
  "Salesman ID",
  "Salesman Name",
  "Customer ID",
  "Customer Name",
  "Invoice Ref",
  "Amount Collected",
  "Payment Method",
  "Proof File URL",
  "GPS Latitude",
  "GPS Longitude",
  "Customer Balance Before",
  "Customer Balance After",
  "Status",
  "Verified By",
  "Verified At",
  "Created At",
  "Posted To Balance",
  "Notes",
  "Reference No",
];

const EXPENSES_HEADERS = [
  "Expense ID",
  "Report ID",
  "Expense DateTime",
  "Salesman ID",
  "Salesman Name",
  "Category",
  "Description",
  "Amount",
  "Receipt No",
  "Receipt File URL",
  "GPS Latitude",
  "GPS Longitude",
  "Approval Status",
  "Approved Amount",
  "Approved By",
  "Approved At",
  "Duplicate Flag",
  "Suspicious Flag",
  "Created At",
  "Deduct From Cash",
  "Rejection Reason",
  "Notes",
  "Vendor / Station",
];

const RETURNS_HEADERS = [
  "Return ID",
  "Report ID",
  "Return DateTime",
  "Salesman ID",
  "Salesman Name",
  "Customer ID",
  "Customer Name",
  "Product ID",
  "Product Name",
  "Quantity",
  "Reason",
  "Photo File URL",
  "Verification Status",
  "Verified By",
  "Verified At",
  "Created At",
  "Adjustment Amount",
  "Notes",
];

const AUDIT_LOG_HEADERS = [
  "Audit ID",
  "DateTime",
  "User ID",
  "User Name",
  "Action",
  "Module",
  "Record ID",
  "Old Value",
  "New Value",
  "IP / Device",
  "GPS Latitude",
  "GPS Longitude",
  "Created At",
  "Notes",
];

type CollectionInput = {
  customerName?: string;
  invoiceRef?: string;
  amountPhp?: number;
  paymentMethod?: string;
  proofRef?: string;
};

type ExpenseInput = {
  category?: string;
  description?: string;
  amountPhp?: number;
  receiptRef?: string;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
};

type ReturnInput = {
  customerName?: string;
  product?: string;
  qty?: number;
  reason?: string;
};

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function createRecordId(prefix: string) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function lastColumnLetter(count: number) {
  let result = "";
  let n = count;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((sheet: any) => sheet.properties?.title === title);

  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${lastColumnLetter(headers.length)}1`,
  }).catch(() => ({ data: { values: [] } }));

  const firstRow = existing.data.values?.[0] || [];
  const hasHeaders = firstRow.some((cell: string) => String(cell || "").trim() !== "");

  if (!hasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${title}!A1:${lastColumnLetter(headers.length)}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

async function appendRows(sheets: any, sheetName: string, rows: unknown[][]) {
  if (!rows.length) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const reportDate = String(body?.reportDate || "").trim();
    const salesmanId = String(body?.salesmanId || "").trim();
    const salesmanName = String(body?.salesmanName || "").trim();
    const routeName = String(body?.routeName || "").trim();
    const vehicleNo = String(body?.vehicleNo || "").trim();
    const notes = String(body?.notes || "").trim();
    const invoiceScanRef = String(body?.invoiceScanRef || "").trim();

    if (!reportDate || !salesmanName) {
      return NextResponse.json(
        { error: "Report date and salesman name are required." },
        { status: 400 }
      );
    }

    const collections = Array.isArray(body?.collections) ? body.collections as CollectionInput[] : [];
    const expenses = Array.isArray(body?.expenses) ? body.expenses as ExpenseInput[] : [];
    const returns = Array.isArray(body?.returns) ? body.returns as ReturnInput[] : [];

    const cashAdvance = toNumber(body?.cashAdvancePhp);
    const cashSales = toNumber(body?.cashSalesPhp);
    const deposits = toNumber(body?.depositsPhp);
    const actualCash = toNumber(body?.actualCashRemittedPhp);

    const collectionTotal = collections.reduce((sum, line) => sum + toNumber(line.amountPhp), 0);
    const approvedExpenses = expenses.reduce((sum, line) => {
      if (line.approvalStatus !== "Approved") return sum;
      return sum + toNumber(line.amountPhp);
    }, 0);

    const expectedCash = cashAdvance + cashSales + collectionTotal - approvedExpenses - deposits;
    const variance = actualCash - expectedCash;
    const createdAt = new Date().toISOString();
    const reportId = createRecordId("DR");
    const reviewStatus = Math.abs(variance) > 0.009 ? "Variance Flagged" : "For Review";

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    await Promise.all([
      ensureSheetExists(sheets, DAILY_REPORTS_SHEET, DAILY_REPORTS_HEADERS),
      ensureSheetExists(sheets, COLLECTIONS_SHEET, COLLECTIONS_HEADERS),
      ensureSheetExists(sheets, EXPENSES_SHEET, EXPENSES_HEADERS),
      ensureSheetExists(sheets, RETURNS_SHEET, RETURNS_HEADERS),
      ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_LOG_HEADERS),
    ]);

    await appendRows(sheets, DAILY_REPORTS_SHEET, [[
      reportId,
      reportDate,
      salesmanId,
      salesmanName,
      routeName,
      vehicleNo,
      body?.startTime || "",
      body?.endTime || "",
      cashAdvance,
      cashSales,
      collectionTotal,
      approvedExpenses,
      deposits,
      expectedCash,
      actualCash,
      variance,
      invoiceScanRef ? 1 : 0,
      expenses.filter((line) => String(line.receiptRef || "").trim()).length,
      returns.filter((line) => String(line.customerName || line.product || "").trim()).length,
      "Submitted",
      reviewStatus,
      "",
      "",
      "",
      createdAt,
      notes,
    ]]);

    const collectionRows = collections
      .filter((line) => line.customerName || line.invoiceRef || toNumber(line.amountPhp) > 0)
      .map((line) => [
        createRecordId("COL"),
        reportId,
        createdAt,
        salesmanId,
        salesmanName,
        "",
        String(line.customerName || ""),
        String(line.invoiceRef || ""),
        toNumber(line.amountPhp),
        String(line.paymentMethod || "Cash"),
        String(line.proofRef || ""),
        "",
        "",
        "",
        "",
        "Submitted",
        "",
        "",
        createdAt,
        "No",
        "",
        "",
      ]);

    const expenseRows = expenses
      .filter((line) => line.category || line.description || toNumber(line.amountPhp) > 0)
      .map((line) => [
        createRecordId("EXP"),
        reportId,
        createdAt,
        salesmanId,
        salesmanName,
        String(line.category || ""),
        String(line.description || ""),
        toNumber(line.amountPhp),
        "",
        String(line.receiptRef || ""),
        "",
        "",
        String(line.approvalStatus || "Pending"),
        line.approvalStatus === "Approved" ? toNumber(line.amountPhp) : 0,
        "",
        "",
        "No",
        "No",
        createdAt,
        line.approvalStatus === "Approved" ? "Yes" : "Pending",
        "",
        "",
        "",
      ]);

    const returnRows = returns
      .filter((line) => line.customerName || line.product || toNumber(line.qty) > 0)
      .map((line) => [
        createRecordId("RET"),
        reportId,
        createdAt,
        salesmanId,
        salesmanName,
        "",
        String(line.customerName || ""),
        "",
        String(line.product || ""),
        toNumber(line.qty),
        String(line.reason || ""),
        "",
        "Submitted",
        "",
        "",
        createdAt,
        "",
        "",
      ]);

    await Promise.all([
      appendRows(sheets, COLLECTIONS_SHEET, collectionRows),
      appendRows(sheets, EXPENSES_SHEET, expenseRows),
      appendRows(sheets, RETURNS_SHEET, returnRows),
      appendRows(sheets, AUDIT_LOG_SHEET, [[
        createRecordId("AUD"),
        createdAt,
        salesmanId,
        salesmanName,
        "CREATE",
        "Daily Reports",
        reportId,
        "",
        "Submitted daily liquidation and reconciliation report",
        "",
        "",
        "",
        createdAt,
        "Internal auditing, liquidation, and accounting reconciliation only. No official BIR invoice or receipt issued.",
      ]]),
    ]);

    return NextResponse.json({
      ok: true,
      reportId,
      expectedCashRemittancePhp: expectedCash,
      actualCashRemittedPhp: actualCash,
      variancePhp: variance,
      accountingReviewStatus: reviewStatus,
    });
  } catch (error: any) {
    console.error("DAILY REPORTS POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to save daily report." },
      { status: 500 }
    );
  }
}
