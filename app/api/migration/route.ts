import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PAYMENTS_SHEET = "Payments";
const AUDIT_LOG_SHEET = "Audit_Log";
const EXPENSES_SHEET = "Expenses";
const DELIVERIES_SHEET = "App_Deliveries";
const PRICING_SHEET = "Pricing_Base";

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

type SheetRow = string[];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

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

function saleKey(salesRefNo: string, groupRef: string) {
  return safeText(groupRef) || safeText(salesRefNo);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
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

async function readRange(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
    .catch(() => ({ data: { values: [] } }));
  return (response.data.values || []) as SheetRow[];
}

async function appendAuditLog(sheets: any, entry: { action: string; recordId: string; summary: string; after?: unknown }) {
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
        "Migration",
        entry.action,
        entry.recordId,
        "Migration Readiness",
        "System",
        entry.summary,
        "",
        entry.after ? JSON.stringify(entry.after) : "",
      ]],
    },
  });
}

function isSalesDataRow(row: SheetRow) {
  const saleDate = safeText(row[0]);
  const customerName = safeText(row[2]);
  const description = safeText(row[3]);
  const specification = safeText(row[4]);
  const qty = toNumber(row[5]);
  return Boolean(saleDate && customerName && description && specification && qty > 0 && saleDate.toLowerCase() !== "date");
}

function salesIdMap(salesRows: SheetRow[]) {
  const map = new Map<string, string>();
  salesRows.slice(1).filter(isSalesDataRow).forEach((row) => {
    const key = saleKey(row[1], row[14]);
    const saleId = safeText(row[22]);
    if (key && saleId && !map.has(key)) map.set(key, saleId);
  });
  return map;
}

async function backfillSales(sheets: any, salesRows: SheetRow[]) {
  const keyToSaleId = salesIdMap(salesRows);
  const now = new Date().toISOString();
  const updates: Array<{ range: string; values: string[][] }> = [];
  let updatedRows = 0;

  salesRows.slice(1).forEach((row, index) => {
    if (!isSalesDataRow(row)) return;
    const rowNumber = index + 2;
    const key = saleKey(row[1], row[14]);
    let saleId = safeText(row[22]);
    let saleItemId = safeText(row[23]);
    let createdAt = safeText(row[24]);

    if (!saleId) {
      saleId = keyToSaleId.get(key) || makeId("SALE");
      if (key) keyToSaleId.set(key, saleId);
    }
    if (!saleItemId) saleItemId = `${saleId}_ITEM_${String(rowNumber).padStart(5, "0")}`;
    if (!createdAt) createdAt = safeText(row[0]) ? `${safeText(row[0]).slice(0, 10)}T00:00:00.000Z` : now;

    if (safeText(row[22]) !== saleId || safeText(row[23]) !== saleItemId || safeText(row[24]) !== createdAt) {
      updates.push({ range: `${SALES_SHEET}!W${rowNumber}:Y${rowNumber}`, values: [[saleId, saleItemId, createdAt]] });
      updatedRows += 1;
    }
  });

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  return { updatedRows };
}

async function backfillPayments(sheets: any, paymentRows: SheetRow[], salesRows: SheetRow[]) {
  const keyToSaleId = salesIdMap(salesRows);
  const now = new Date().toISOString();
  const updates: Array<{ range: string; values: string[][] }> = [];
  let updatedRows = 0;

  paymentRows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const salesRefNo = safeText(row[1]);
    const groupRef = safeText(row[2]);
    const amount = toNumber(row[5]);
    if (!salesRefNo && !groupRef && amount <= 0) return;

    let createdAt = safeText(row[9]);
    let paymentId = safeText(row[10]);
    let saleId = safeText(row[11]);
    const key = saleKey(salesRefNo, groupRef);

    if (!createdAt) createdAt = safeText(row[0]) ? `${safeText(row[0]).slice(0, 10)}T00:00:00.000Z` : now;
    if (!paymentId) paymentId = makeId("PAY");
    if (!saleId && key) saleId = keyToSaleId.get(key) || "";

    if (safeText(row[9]) !== createdAt || safeText(row[10]) !== paymentId || safeText(row[11]) !== saleId) {
      updates.push({ range: `${PAYMENTS_SHEET}!J${rowNumber}:L${rowNumber}`, values: [[createdAt, paymentId, saleId]] });
      updatedRows += 1;
    }
  });

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  return { updatedRows };
}

function buildStatus(salesRows: SheetRow[], paymentRows: SheetRow[], auditRows: SheetRow[]) {
  const salesData = salesRows.slice(1).filter(isSalesDataRow);
  const paymentData = paymentRows.slice(1).filter((row) => safeText(row[1]) || safeText(row[2]) || toNumber(row[5]) > 0);
  const missingSaleIds = salesData.filter((row) => !safeText(row[22]) || !safeText(row[23]) || !safeText(row[24])).length;
  const missingPaymentIds = paymentData.filter((row) => !safeText(row[9]) || !safeText(row[10])).length;
  const missingPaymentSaleLinks = paymentData.filter((row) => !safeText(row[11])).length;

  return {
    salesRows: salesData.length,
    paymentsRows: paymentData.length,
    auditRows: Math.max(auditRows.length - 1, 0),
    missingSaleIds,
    missingPaymentIds,
    missingPaymentSaleLinks,
    migrationReady: missingSaleIds === 0 && missingPaymentIds === 0,
    recommendedDatabase: "Supabase Postgres",
    futureTables: ["products", "pricing", "customers", "sales", "sale_items", "payments", "expenses", "deliveries", "inventory_movements", "supplier_invoice_costs", "users", "audit_logs"],
  };
}

function exportSales(salesRows: SheetRow[]) {
  return toCsv([
    ["sale_id", "sales_ref_no", "group_ref", "sale_date", "customer_name", "payment_status", "sale_status", "total_sale_php", "amount_paid_php", "balance_php", "salesperson", "cashier_name", "created_at", "confirmed_at", "notes"],
    ...salesRows.slice(1).filter(isSalesDataRow).reduce((items: Array<Array<string | number>>, row) => {
      const saleId = safeText(row[22]);
      if (items.some((item) => item[0] === saleId)) return items;
      const sameSale = salesRows.slice(1).filter((candidate) => safeText(candidate[22]) === saleId);
      const totalSale = sameSale.reduce((sum, item) => sum + toNumber(item[7]), 0);
      const paid = sameSale.reduce((sum, item) => sum + toNumber(item[16]), 0);
      const balance = sameSale.reduce((sum, item) => sum + toNumber(item[17]), 0);
      items.push([saleId, safeText(row[1]), safeText(row[14]), safeText(row[0]), safeText(row[2]), safeText(row[11]), safeText(row[20]), totalSale, paid, balance, safeText(row[12]), safeText(row[19]), safeText(row[24]), safeText(row[21]), safeText(row[13])]);
      return items;
    }, []),
  ]);
}

function exportSaleItems(salesRows: SheetRow[]) {
  return toCsv([
    ["sale_item_id", "sale_id", "description", "specification", "qty", "unit_price_php", "total_sale_php", "cost_price_php", "total_cost_php", "gross_profit_php", "created_at"],
    ...salesRows.slice(1).filter(isSalesDataRow).map((row) => [safeText(row[23]), safeText(row[22]), safeText(row[3]), safeText(row[4]), toNumber(row[5]), toNumber(row[6]), toNumber(row[7]), toNumber(row[8]), toNumber(row[9]), toNumber(row[10]), safeText(row[24])]),
  ]);
}

function exportPayments(paymentRows: SheetRow[]) {
  return toCsv([
    ["payment_id", "sale_id", "payment_date", "sales_ref_no", "group_ref", "customer_name", "payment_method", "amount_paid_php", "transaction_ref", "cashier_name", "notes", "created_at"],
    ...paymentRows.slice(1).filter((row) => safeText(row[1]) || safeText(row[2]) || toNumber(row[5]) > 0).map((row) => [safeText(row[10]), safeText(row[11]), safeText(row[0]), safeText(row[1]), safeText(row[2]), safeText(row[3]), safeText(row[4]), toNumber(row[5]), safeText(row[6]), safeText(row[7]), safeText(row[8]), safeText(row[9])]),
  ]);
}

function exportSimpleRows(rows: SheetRow[], filenameType: "expenses" | "deliveries" | "pricing" | "audit") {
  if (!rows.length) return "";
  return toCsv(rows as Array<Array<string | number>>);
}

async function getAllRows(sheets: any) {
  await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
  await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  const [salesRows, paymentRows, auditRows, expenseRows, deliveryRows, pricingRows] = await Promise.all([
    readRange(sheets, `${SALES_SHEET}!A:Y`),
    readRange(sheets, `${PAYMENTS_SHEET}!A:L`),
    readRange(sheets, `${AUDIT_LOG_SHEET}!A:J`),
    readRange(sheets, `${EXPENSES_SHEET}!A:Z`),
    readRange(sheets, `${DELIVERIES_SHEET}!A:Z`),
    readRange(sheets, `${PRICING_SHEET}!A:Z`),
  ]);
  return { salesRows, paymentRows, auditRows, expenseRows, deliveryRows, pricingRows };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const exportType = url.searchParams.get("export");
    const sheets = await getSheets();
    const rows = await getAllRows(sheets);

    if (exportType) {
      const exporters: Record<string, string> = {
        sales: exportSales(rows.salesRows),
        sale_items: exportSaleItems(rows.salesRows),
        payments: exportPayments(rows.paymentRows),
        expenses: exportSimpleRows(rows.expenseRows, "expenses"),
        deliveries: exportSimpleRows(rows.deliveryRows, "deliveries"),
        pricing: exportSimpleRows(rows.pricingRows, "pricing"),
        audit_logs: exportSimpleRows(rows.auditRows, "audit"),
      };
      const csv = exporters[exportType];
      if (csv === undefined) return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="realights-${exportType}.csv"`,
        },
      });
    }

    return NextResponse.json(buildStatus(rows.salesRows, rows.paymentRows, rows.auditRows));
  } catch (error: any) {
    console.error("MIGRATION GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load migration status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = safeText(body?.action || "backfill");
    if (action !== "backfill") return NextResponse.json({ error: "Unsupported migration action" }, { status: 400 });

    const sheets = await getSheets();
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const salesRowsBefore = await readRange(sheets, `${SALES_SHEET}!A:Y`);
    const paymentRowsBefore = await readRange(sheets, `${PAYMENTS_SHEET}!A:L`);
    const salesResult = await backfillSales(sheets, salesRowsBefore);
    const salesRowsAfter = await readRange(sheets, `${SALES_SHEET}!A:Y`);
    const paymentsResult = await backfillPayments(sheets, paymentRowsBefore, salesRowsAfter);
    const paymentRowsAfter = await readRange(sheets, `${PAYMENTS_SHEET}!A:L`);
    const auditRows = await readRange(sheets, `${AUDIT_LOG_SHEET}!A:J`);
    const status = buildStatus(salesRowsAfter, paymentRowsAfter, auditRows);

    await appendAuditLog(sheets, {
      action: "BACKFILL_IDS",
      recordId: makeId("MIGRATION"),
      summary: `Backfilled ${salesResult.updatedRows} sales row(s) and ${paymentsResult.updatedRows} payment row(s)` ,
      after: { salesResult, paymentsResult, status },
    });

    return NextResponse.json({ ok: true, salesResult, paymentsResult, status });
  } catch (error: any) {
    console.error("MIGRATION POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to run migration backfill" }, { status: 500 });
  }
}
