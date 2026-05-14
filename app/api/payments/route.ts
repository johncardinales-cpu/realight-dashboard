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

const PAYMENT_HEADERS = [
  "Payment Date","Sales Ref No.","Group Ref","Customer Name","Payment Method",
  "Amount Paid (PHP)","Transaction Ref","Cashier Name","Notes","Created At",
  "Payment ID","Sale ID",
];

const AUDIT_HEADERS = [
  "Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON",
];

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

function today() {
  return new Date().toISOString().slice(0, 10);
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
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1:${lastCol}1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
}

async function appendAuditLog(sheets: any, entry: { module: string; action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[makeId("AUDIT"), new Date().toISOString(), entry.module, entry.action, entry.recordId, entry.recordRef, entry.actor, entry.summary, entry.before ? JSON.stringify(entry.before) : "", entry.after ? JSON.stringify(entry.after) : ""]] },
  });
}

function getPaymentStatus(totalPaid: number, totalSale: number) {
  if (totalSale <= 0) return "Pending";
  if (totalPaid <= 0) return "Pending";
  if (totalPaid >= totalSale) return "Paid";
  return "Partial";
}

function saleKey(salesRefNo: string, groupRef: string) {
  return groupRef || salesRefNo;
}

async function readSalesRows(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:Y` });
  return (response.data.values || []) as string[][];
}

async function readPaymentRows(sheets: any) {
  await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:L` });
  return (response.data.values || []) as string[][];
}

function buildPaymentTotals(paymentRows: string[][]) {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();

  paymentRows.slice(1).forEach((row) => {
    const salesRefNo = String(row[1] || "").trim();
    const groupRef = String(row[2] || "").trim();
    const key = saleKey(salesRefNo, groupRef);
    const amount = toNumber(row[5]);
    if (!key || amount <= 0) return;
    totals.set(key, (totals.get(key) || 0) + amount);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return { totals, counts };
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const { totals: paymentTotals, counts: paymentCounts } = buildPaymentTotals(paymentRows);
  const map = new Map<string, any>();

  salesRows.slice(1).forEach((row, index) => {
    const saleDate = String(row[0] || "").trim();
    const salesRefNo = String(row[1] || "").trim();
    const customerName = String(row[2] || "").trim();
    const groupRef = String(row[14] || "").trim();
    const key = saleKey(salesRefNo, groupRef);
    const totalSalePhp = toNumber(row[7]);
    const legacyAmountPaidPhp = toNumber(row[16]);
    const saleStatus = String(row[20] || "Draft").trim() || "Draft";
    const saleId = String(row[22] || "").trim();
    if (!key || !saleDate || !customerName || totalSalePhp <= 0) return;

    const current = map.get(key) || { key, salesRefNo, groupRef, customerName, saleDate, saleId, totalSalePhp: 0, legacyAmountPaidPhp: 0, paymentCount: 0, saleStatus, rows: [] };
    current.totalSalePhp += totalSalePhp;
    current.legacyAmountPaidPhp += legacyAmountPaidPhp;
    current.paymentCount = paymentCounts.get(key) || 0;
    current.paymentLedgerPaidPhp = paymentTotals.get(key) || 0;
    current.totalPaidPhp = current.legacyAmountPaidPhp + current.paymentLedgerPaidPhp;
    current.balancePhp = Math.max(current.totalSalePhp - current.totalPaidPhp, 0);
    current.paymentStatus = getPaymentStatus(current.totalPaidPhp, current.totalSalePhp);
    if (!current.saleId && saleId) current.saleId = saleId;
    current.rows.push({ rowNumber: index + 2, row });
    map.set(key, current);
  });

  return Array.from(map.values()).map((summary) => ({
    key: summary.key,
    saleDate: summary.saleDate,
    salesRefNo: summary.salesRefNo,
    groupRef: summary.groupRef,
    saleId: summary.saleId || "",
    customerName: summary.customerName,
    totalSalePhp: summary.totalSalePhp,
    totalPaidPhp: summary.totalPaidPhp || 0,
    legacyAmountPaidPhp: summary.legacyAmountPaidPhp || 0,
    paymentLedgerPaidPhp: summary.paymentLedgerPaidPhp || 0,
    balancePhp: Math.max(summary.totalSalePhp - (summary.totalPaidPhp || 0), 0),
    paymentStatus: getPaymentStatus(summary.totalPaidPhp || 0, summary.totalSalePhp),
    saleStatus: summary.saleStatus,
    paymentCount: summary.paymentCount,
  }));
}

async function updateSalePaymentFields(sheets: any, salesRows: string[][], key: string, totalPaid: number, paymentStatus: string) {
  const matchingRows = salesRows.slice(1).filter((candidate) => saleKey(String(candidate[1] || "").trim(), String(candidate[14] || "").trim()) === key);
  const totalSaleForKey = matchingRows.reduce((sum, candidate) => sum + toNumber(candidate[7]), 0);
  const requests = salesRows.slice(1).flatMap((row, index) => {
    const rowKey = saleKey(String(row[1] || "").trim(), String(row[14] || "").trim());
    if (rowKey !== key) return [];
    const totalSalePhp = toNumber(row[7]);
    const lineShare = totalSaleForKey > 0 ? totalSalePhp / totalSaleForKey : 0;
    const linePaid = Math.min(totalSalePhp, totalPaid * lineShare);
    const lineBalance = Math.max(totalSalePhp - linePaid, 0);
    const rowNumber = index + 2;
    return [
      { range: `${SALES_SHEET}!L${rowNumber}`, values: [[paymentStatus]] },
      { range: `${SALES_SHEET}!Q${rowNumber}:R${rowNumber}`, values: [[linePaid, lineBalance]] },
    ];
  });
  if (!requests.length) return;
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: requests } });
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const [salesRows, paymentRows] = await Promise.all([readSalesRows(sheets), readPaymentRows(sheets)]);
    return NextResponse.json(buildSaleSummaries(salesRows, paymentRows));
  } catch (error: any) {
    console.error("PAYMENTS GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load payment summaries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const salesRefNo = String(body?.salesRefNo || "").trim();
    const groupRef = String(body?.groupRef || "").trim();
    const key = String(body?.key || saleKey(salesRefNo, groupRef)).trim();
    const paymentDate = String(body?.paymentDate || today()).trim();
    const paymentMethod = String(body?.paymentMethod || "").trim();
    const amountPaidPhp = toNumber(body?.amountPaidPhp);
    const transactionRef = String(body?.transactionRef || "").trim();
    const cashierName = String(body?.cashierName || "").trim();
    const notes = String(body?.notes || "").trim();

    if (!key) return NextResponse.json({ error: "Sales Ref No. is required" }, { status: 400 });
    if (!paymentMethod) return NextResponse.json({ error: "Payment Method is required" }, { status: 400 });
    if (amountPaidPhp <= 0) return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    if (!cashierName) return NextResponse.json({ error: "Cashier Name is required" }, { status: 400 });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const [salesRows, paymentRows] = await Promise.all([readSalesRows(sheets), readPaymentRows(sheets)]);
    const summaries = buildSaleSummaries(salesRows, paymentRows);
    const summary = summaries.find((item) => item.key === key || item.salesRefNo === key || item.groupRef === key);

    if (!summary) return NextResponse.json({ error: "Sale reference was not found" }, { status: 404 });
    if (amountPaidPhp > summary.balancePhp) {
      return NextResponse.json({ error: `Payment exceeds balance. Remaining balance is ₱${summary.balancePhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }, { status: 400 });
    }

    const createdAt = new Date().toISOString();
    const paymentId = makeId("PAY");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${PAYMENTS_SHEET}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[paymentDate, summary.salesRefNo, summary.groupRef, summary.customerName, paymentMethod, amountPaidPhp, transactionRef, cashierName, notes, createdAt, paymentId, summary.saleId || ""]] },
    });

    const newTotalPaid = summary.totalPaidPhp + amountPaidPhp;
    const newBalance = Math.max(summary.totalSalePhp - newTotalPaid, 0);
    const newPaymentStatus = getPaymentStatus(newTotalPaid, summary.totalSalePhp);
    await updateSalePaymentFields(sheets, salesRows, summary.key, newTotalPaid, newPaymentStatus);

    await appendAuditLog(sheets, {
      module: "Payments",
      action: "CREATE_PAYMENT",
      recordId: paymentId,
      recordRef: summary.salesRefNo,
      actor: cashierName,
      summary: `Recorded payment ${amountPaidPhp} for ${summary.salesRefNo}`,
      before: { totalPaidPhp: summary.totalPaidPhp, balancePhp: summary.balancePhp, paymentStatus: summary.paymentStatus },
      after: { totalPaidPhp: newTotalPaid, balancePhp: newBalance, paymentStatus: newPaymentStatus, paymentMethod, transactionRef },
    });

    return NextResponse.json({ ok: true, paymentId, salesRefNo: summary.salesRefNo, totalSalePhp: summary.totalSalePhp, totalPaidPhp: newTotalPaid, balancePhp: newBalance, paymentStatus: newPaymentStatus });
  } catch (error: any) {
    console.error("PAYMENTS POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save payment" }, { status: 500 });
  }
}
