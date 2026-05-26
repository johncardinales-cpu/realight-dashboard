import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PAYMENTS_SHEET = "Payments";
const AUDIT_LOG_SHEET = "Audit_Log";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const PAYMENT_HEADERS = ["Payment Date","Sales Ref No.","Group Ref","Customer Name","Payment Method","Amount Paid (PHP)","Transaction Ref","Cashier Name","Notes","Created At","Payment ID","Sale ID","Payment Status","Voided At","Void Reason"];
const AUDIT_HEADERS = ["Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON"];

function toNumber(value: unknown) { return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0; }
function text(value: unknown) { return String(value || "").trim(); }
function columnLetter(index: number) { let column = ""; let current = index; while (current > 0) { const remainder = (current - 1) % 26; column = String.fromCharCode(65 + remainder) + column; current = Math.floor((current - 1) / 26); } return column; }
function today() { return new Date().toISOString().slice(0, 10); }
function makeId(prefix: string) { const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14); const random = Math.random().toString(36).slice(2, 8).toUpperCase(); return `${prefix}_${stamp}_${random}`; }
function saleKey(salesRefNo: string, groupRef: string, saleId?: string) { return text(saleId) || text(groupRef) || text(salesRefNo); }
function lineGrandTotal(row: string[]) { return toNumber(row[28] || row[7]); }
function getPaymentStatus(totalPaid: number, totalDue: number) { if (totalDue <= 0 || totalPaid <= 0) return "Pending"; if (totalPaid >= totalDue) return "Paid"; return "Partial"; }
function isVoidPayment(row: string[]) { return ["voided", "cancelled", "canceled"].includes(text(row[12]).toLowerCase()); }
function isCancelledSale(row: string[]) { return ["cancelled", "canceled", "voided"].includes(text(row[20]).toLowerCase()); }

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title);
  if (!found) await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1:${columnLetter(headers.length)}1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
}

async function appendAuditLog(sheets: any, entry: { module: string; action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${AUDIT_LOG_SHEET}!A:J`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[makeId("AUDIT"), new Date().toISOString(), entry.module, entry.action, entry.recordId, entry.recordRef, entry.actor, entry.summary, entry.before ? JSON.stringify(entry.before) : "", entry.after ? JSON.stringify(entry.after) : ""]] } });
}

async function readSalesRows(sheets: any) { const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` }); return (response.data.values || []) as string[][]; }
async function readPaymentRows(sheets: any) { await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS); const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:O` }); return (response.data.values || []) as string[][]; }

function matchKeys(row: string[]) { return [saleKey(text(row[1]), text(row[14]), text(row[22])), text(row[22]), text(row[14]), text(row[1])].filter(Boolean); }
function paymentMatchKeys(row: string[]) { return [saleKey(text(row[1]), text(row[2]), text(row[11])), text(row[11]), text(row[2]), text(row[1])].filter(Boolean); }

function buildPaymentTotals(paymentRows: string[][]) {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  paymentRows.slice(1).forEach((row) => {
    if (isVoidPayment(row)) return;
    const amount = toNumber(row[5]);
    if (amount <= 0) return;
    paymentMatchKeys(row).forEach((key) => {
      totals.set(key, (totals.get(key) || 0) + amount);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return { totals, counts };
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const { totals: paymentTotals, counts: paymentCounts } = buildPaymentTotals(paymentRows);
  const map = new Map<string, any>();
  salesRows.slice(1).forEach((row, index) => {
    if (isCancelledSale(row)) return;
    const saleDate = text(row[0]);
    const salesRefNo = text(row[1]);
    const customerName = text(row[2]);
    const groupRef = text(row[14]);
    const saleId = text(row[22]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const due = lineGrandTotal(row);
    const initialPaid = toNumber(row[16]);
    const saleStatus = text(row[20]) || "Draft";
    if (!key || !saleDate || !customerName || due <= 0) return;
    const current = map.get(key) || { key, salesRefNo, groupRef, saleId, customerName, saleDate, grandTotalPhp: 0, initialPaidPhp: 0, saleStatus, rows: [] };
    current.grandTotalPhp += due;
    current.initialPaidPhp += initialPaid;
    current.rows.push({ rowNumber: index + 2, row });
    map.set(key, current);
  });
  return Array.from(map.values()).map((sale) => {
    const followUpPaid = paymentTotals.get(sale.saleId) || paymentTotals.get(sale.groupRef) || paymentTotals.get(sale.salesRefNo) || paymentTotals.get(sale.key) || 0;
    const paymentCount = paymentCounts.get(sale.saleId) || paymentCounts.get(sale.groupRef) || paymentCounts.get(sale.salesRefNo) || paymentCounts.get(sale.key) || 0;
    const totalPaid = sale.initialPaidPhp + followUpPaid;
    const balance = Math.max(sale.grandTotalPhp - totalPaid, 0);
    return { ...sale, totalSalePhp: sale.grandTotalPhp, totalPaidPhp: totalPaid, legacyAmountPaidPhp: sale.initialPaidPhp, paymentLedgerPaidPhp: followUpPaid, balancePhp: balance, paymentStatus: getPaymentStatus(totalPaid, sale.grandTotalPhp), paymentCount };
  });
}

async function updateSalePaymentFields(sheets: any, salesRows: string[][], key: string, totalPaid: number, paymentStatus: string) {
  const matchingRows = salesRows.slice(1).filter((row) => matchKeys(row).includes(key));
  const totalDueForKey = matchingRows.reduce((sum, row) => sum + lineGrandTotal(row), 0);
  const requests = salesRows.slice(1).flatMap((row, index) => {
    if (!matchKeys(row).includes(key)) return [];
    const due = lineGrandTotal(row);
    const share = totalDueForKey > 0 ? due / totalDueForKey : 0;
    const linePaid = Math.min(due, totalPaid * share);
    const lineBalance = Math.max(due - linePaid, 0);
    const rowNumber = index + 2;
    return [{ range: `${SALES_SHEET}!L${rowNumber}`, values: [[paymentStatus]] }, { range: `${SALES_SHEET}!Q${rowNumber}:R${rowNumber}`, values: [[linePaid, lineBalance]] }];
  });
  if (requests.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: requests } });
}

async function voidPaymentRowsForKey(sheets: any, paymentRows: string[][], key: string, actor: string, reason: string) {
  const stamp = new Date().toISOString();
  const matches = paymentRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => !isVoidPayment(row) && paymentMatchKeys(row).includes(key));
  if (!matches.length) return { voidedCount: 0, voidedAmount: 0 };
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: matches.flatMap(({ rowNumber }) => [
    { range: `${PAYMENTS_SHEET}!M${rowNumber}:O${rowNumber}`, values: [["Voided", stamp, reason]] },
  ]) } });
  const voidedAmount = matches.reduce((sum, item) => sum + toNumber(item.row[5]), 0);
  await appendAuditLog(sheets, { module: "Payments", action: "VOID_PAYMENT", recordId: key, recordRef: key, actor, summary: `Voided ${matches.length} payment record(s), amount ${voidedAmount}, reason: ${reason}`, before: { paymentCount: matches.length, amount: voidedAmount }, after: { paymentStatus: "Voided", voidedAt: stamp, reason } });
  return { voidedCount: matches.length, voidedAmount };
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

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const action = text(body?.action || "void-sale-payments").toLowerCase();
    const key = text(body?.key || saleKey(text(body?.salesRefNo), text(body?.groupRef), text(body?.saleId)));
    const actor = text(body?.actor || body?.cashierName || "Admin");
    const reason = text(body?.reason || "Payment voided by user");
    if (action !== "void-sale-payments") return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
    if (!key) return NextResponse.json({ error: "Sale reference is required" }, { status: 400 });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const [salesRows, paymentRows] = await Promise.all([readSalesRows(sheets), readPaymentRows(sheets)]);
    const result = await voidPaymentRowsForKey(sheets, paymentRows, key, actor, reason);
    await updateSalePaymentFields(sheets, salesRows, key, 0, "Pending");
    return NextResponse.json({ ok: true, message: `Voided ${result.voidedCount} payment record(s).`, ...result });
  } catch (error: any) {
    console.error("PAYMENTS PATCH ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to void payment" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const salesRefNo = text(body?.salesRefNo);
    const groupRef = text(body?.groupRef);
    const saleId = text(body?.saleId);
    const key = text(body?.key || saleKey(salesRefNo, groupRef, saleId));
    const paymentDate = text(body?.paymentDate || today());
    const paymentMethod = text(body?.paymentMethod);
    const amountPaidPhp = toNumber(body?.amountPaidPhp);
    const transactionRef = text(body?.transactionRef);
    const cashierName = text(body?.cashierName);
    const notes = text(body?.notes);
    if (!key) return NextResponse.json({ error: "Sales Ref No. is required" }, { status: 400 });
    if (!paymentMethod) return NextResponse.json({ error: "Payment Method is required" }, { status: 400 });
    if (amountPaidPhp <= 0) return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    if (!cashierName) return NextResponse.json({ error: "Cashier Name is required" }, { status: 400 });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const [salesRows, paymentRows] = await Promise.all([readSalesRows(sheets), readPaymentRows(sheets)]);
    const summary = buildSaleSummaries(salesRows, paymentRows).find((item) => item.key === key || item.saleId === key || item.salesRefNo === key || item.groupRef === key);
    if (!summary) return NextResponse.json({ error: "Sale reference was not found" }, { status: 404 });
    if (amountPaidPhp > summary.balancePhp) return NextResponse.json({ error: `Payment exceeds balance. Remaining balance is PHP ${summary.balancePhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }, { status: 400 });
    const paymentId = makeId("PAY");
    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:O`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[paymentDate, summary.salesRefNo, summary.groupRef, summary.customerName, paymentMethod, amountPaidPhp, transactionRef, cashierName, notes, new Date().toISOString(), paymentId, summary.saleId || "", "Active", "", ""]] } });
    const newTotalPaid = summary.totalPaidPhp + amountPaidPhp;
    const newBalance = Math.max(summary.grandTotalPhp - newTotalPaid, 0);
    const newPaymentStatus = getPaymentStatus(newTotalPaid, summary.grandTotalPhp);
    await updateSalePaymentFields(sheets, salesRows, summary.key, newTotalPaid, newPaymentStatus);
    await appendAuditLog(sheets, { module: "Payments", action: "CREATE_PAYMENT", recordId: paymentId, recordRef: summary.salesRefNo, actor: cashierName, summary: `Recorded payment ${amountPaidPhp} for ${summary.salesRefNo}`, before: { totalPaidPhp: summary.totalPaidPhp, balancePhp: summary.balancePhp, paymentStatus: summary.paymentStatus }, after: { totalPaidPhp: newTotalPaid, balancePhp: newBalance, paymentStatus: newPaymentStatus, paymentMethod, transactionRef } });
    return NextResponse.json({ ok: true, paymentId, salesRefNo: summary.salesRefNo, grandTotalPhp: summary.grandTotalPhp, totalSalePhp: summary.grandTotalPhp, totalPaidPhp: newTotalPaid, balancePhp: newBalance, paymentStatus: newPaymentStatus });
  } catch (error: any) {
    console.error("PAYMENTS POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save payment" }, { status: 500 });
  }
}
