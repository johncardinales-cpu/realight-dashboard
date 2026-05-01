import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const EXPENSES_SHEET = "Expenses";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

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

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function parseExpenseRow(row: string[], header: string[]) {
  const map: Record<string, string> = {};
  header.forEach((h, i) => {
    map[safeText(h)] = safeText(row[i]);
  });

  const date =
    map["Expense Date"] ||
    map["Date"] ||
    map["Upload Date"] ||
    "";
  const category =
    map["Category"] ||
    "General Expense";
  const description =
    map["Description"] ||
    map["Expense"] ||
    "";
  const amount = toNumber(
    map["Amount"] || map["Total"] || map["Expense Amount"]
  );
  const reference =
    map["Reference No."] ||
    map["Reference"] ||
    "";
  const notes = map["Notes"] || "";

  if (!date && !description && !amount) return null;

  return {
    Date: date,
    Category: category,
    Description: description,
    Amount: amount,
    Reference: reference,
    Source: "Expenses",
    Notes: notes,
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
    Reference: invoiceNo || batchReference,
    Source: "Supplier_Invoice_Costs",
    Notes: notes,
  };
}

async function ensureSupplierSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find(
    (s: any) => s.properties?.title === SUPPLIER_COSTS_SHEET
  );
  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: SUPPLIER_COSTS_SHEET,
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SUPPLIER_COSTS_SHEET}!A1:L1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [SUPPLIER_HEADERS],
    },
  });
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    await ensureSupplierSheetExists(sheets);

    const [expensesRes, supplierRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${EXPENSES_SHEET}!A:Z`,
      }).catch(() => ({ data: { values: [] } })),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SUPPLIER_COSTS_SHEET}!A:L`,
      }),
    ]);

    const expenseRows = expensesRes.data.values || [];
    const supplierRows = supplierRes.data.values || [];

    let items: Array<{
      Date: string;
      Category: string;
      Description: string;
      Amount: number;
      Reference: string;
      Source: string;
      Notes: string;
    }> = [];

    if (expenseRows.length) {
      const header = expenseRows[0].map(safeText);
      items.push(
        ...expenseRows
          .slice(1)
          .map((row) => parseExpenseRow(row, header))
          .filter(Boolean) as any
      );
    }

    if (supplierRows.length) {
      items.push(
        ...supplierRows
          .slice(1)
          .map(parseSupplierRow)
          .filter(Boolean) as any
      );
    }

    items = items.sort((a, b) => {
      const da = new Date(a.Date || "1900-01-01").getTime();
      const db = new Date(b.Date || "1900-01-01").getTime();
      return db - da;
    });

    const totalAmount = items.reduce((sum, item) => sum + item.Amount, 0);

    return NextResponse.json({
      rows: items,
      totalAmount,
    });
  } catch (error: any) {
    console.error("EXPENSES API ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load expenses" },
      { status: 500 }
    );
  }
}
