import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const CUSTOMERS_SHEET = "Customers";
const SALES_SHEET = "Sales";
const AUDIT_LOG_SHEET = "Audit_Log";
const READ_CACHE_MS = 15000;

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
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

let readCache: { expiresAt: number; customers: any[] } | null = null;

function safeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeName(value: unknown) {
  return safeText(value).toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
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

function clearReadCache() {
  readCache = null;
}

function isQuotaError(error: any) {
  const message = String(error?.message || error?.response?.data?.error?.message || error || "").toLowerCase();
  return message.includes("quota") || message.includes("read requests per minute") || message.includes("rate limit");
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

function parseSale(row: string[]) {
  return {
    saleDate: safeText(row[0]),
    salesRefNo: safeText(row[1]),
    customerName: safeText(row[2]),
    description: safeText(row[3]),
    specification: safeText(row[4]),
    qty: toNumber(row[5]),
    unitPricePhp: toNumber(row[6]),
    productSubtotalPhp: toNumber(row[25] || row[7]),
    taxAmountPhp: toNumber(row[27]),
    grandTotalPhp: toNumber(row[28] || row[7]),
    deliveryFeePhp: toNumber(row[29]),
    installationFeePhp: toNumber(row[30]),
    otherChargePhp: toNumber(row[31]),
    discountPhp: toNumber(row[32]),
    amountPaidPhp: toNumber(row[16]),
    balancePhp: toNumber(row[17]),
    paymentStatus: safeText(row[11]) || "Pending",
    saleStatus: safeText(row[20]) || "Draft",
    groupRef: safeText(row[14]),
    saleId: safeText(row[22]),
  };
}

function isActiveCustomerSale(sale: ReturnType<typeof parseSale>) {
  return !["cancelled", "canceled", "void", "voided"].includes(safeText(sale.saleStatus).toLowerCase());
}

function attachSalesHistory(customers: any[], salesRows: string[][]) {
  const sales = salesRows.slice(1).map(parseSale).filter((sale) => sale.customerName && sale.description && sale.grandTotalPhp > 0);
  return customers.map((customer) => {
    const customerKey = normalizeName(customer.customerName);
    const customerSales = sales.filter((sale) => normalizeName(sale.customerName) === customerKey);
    const activeCustomerSales = customerSales.filter(isActiveCustomerSale);
    const totalOrders = new Set(activeCustomerSales.map((sale) => sale.salesRefNo || sale.groupRef || sale.saleId).filter(Boolean)).size || activeCustomerSales.length;
    const totalPurchasedPhp = activeCustomerSales.reduce((sum, sale) => sum + sale.grandTotalPhp, 0);
    const totalPaidPhp = activeCustomerSales.reduce((sum, sale) => sum + sale.amountPaidPhp, 0);
    const outstandingBalancePhp = activeCustomerSales.reduce((sum, sale) => sum + sale.balancePhp, 0);
    const lastPurchaseDate = activeCustomerSales
      .map((sale) => sale.saleDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";

    return {
      ...customer,
      totalOrders,
      totalPurchasedPhp,
      totalPaidPhp,
      outstandingBalancePhp,
      lastPurchaseDate,
      purchases: customerSales.slice(0, 25),
    };
  });
}

async function readCustomersForGet() {
  const now = Date.now();
  if (readCache && readCache.expiresAt > now) return readCache.customers;
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: [`${CUSTOMERS_SHEET}!A:J`, `${SALES_SHEET}!A:AJ`],
  });
  const customerRows = (response.data.valueRanges?.[0]?.values || []) as string[][];
  const salesRows = (response.data.valueRanges?.[1]?.values || []) as string[][];
  const customers = customerRows
    .slice(1)
    .map(parseCustomer)
    .filter((row) => row.customerName || row.phone || row.email)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
  const result = attachSalesHistory(customers, salesRows);
  readCache = { expiresAt: now + READ_CACHE_MS, customers: result };
  return result;
}

export async function GET() {
  try {
    const customers = await readCustomersForGet();
    const response = NextResponse.json(customers);
    response.headers.set("Cache-Control", "private, max-age=10");
    response.headers.set("X-Realights-Read-Cache", readCache && readCache.expiresAt > Date.now() ? "hit" : "miss");
    return response;
  } catch (error: any) {
    console.error("CUSTOMERS GET ERROR:", error);
    if (isQuotaError(error)) return NextResponse.json({ error: "Google Sheets is temporarily rate-limiting customer reads. Please wait 30 to 60 seconds, then refresh once." }, { status: 429 });
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
    const customerType = safeText(body?.customerType) || "Retail";
    const status = safeText(body?.status) || "Active";
    const notes = safeText(body?.notes);
    if (!customerName) return NextResponse.json({ error: "Customer Name is required" }, { status: 400 });

    const sheets = await getSheets();
    await ensureSheetExists(sheets, CUSTOMERS_SHEET, CUSTOMER_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const row = [customerId, new Date().toISOString(), customerName, contactPerson, phone, email, address, customerType, status, notes];
    if (rowNumber > 1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${CUSTOMERS_SHEET}!A${rowNumber}:J${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
      await appendAuditLog(sheets, { action: "UPDATE_CUSTOMER", recordId: customerId, recordRef: customerName, actor: "Admin", summary: `Updated customer ${customerName}`, after: { customerId, customerName, contactPerson, phone, email, address, customerType, status, notes } });
      clearReadCache();
      return NextResponse.json({ ok: true, mode: "updated", customerId });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${CUSTOMERS_SHEET}!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    await appendAuditLog(sheets, { action: "CREATE_CUSTOMER", recordId: customerId, recordRef: customerName, actor: "Admin", summary: `Created customer ${customerName}`, after: { customerId, customerName, contactPerson, phone, email, address, customerType, status, notes } });
    clearReadCache();
    return NextResponse.json({ ok: true, mode: "created", customerId });
  } catch (error: any) {
    console.error("CUSTOMERS POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save customer" }, { status: 500 });
  }
}
