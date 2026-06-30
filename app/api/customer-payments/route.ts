import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES_SHEET = "Sales";
const PAYMENTS_SHEET = "Payments";
const AUDIT_LOG_SHEET = "Audit_Log";
const CUSTOMER_CREDITS_SHEET = "Customer_Credits";

const PAYMENT_HEADERS = ["Payment Date","Sales Ref No.","Group Ref","Customer Name","Payment Method","Amount Paid (PHP)","Transaction Ref","Cashier Name","Notes","Created At","Payment ID","Sale ID","Payment Status","Voided At","Void Reason"];
const AUDIT_HEADERS = ["Audit ID","Created At","Module","Action","Record ID","Record Ref","Actor","Summary","Before JSON","After JSON"];
const CREDIT_HEADERS = ["Credit Date","Customer Name","Customer ID","Credit Amount (PHP)","Payment Method","Transaction Ref","Cashier Name","Notes","Created At","Credit ID","Source Payment ID","Status"];

function toNumber(value: unknown) { return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0; }
function text(value: unknown) { return String(value || "").trim(); }
function norm(value: unknown) { return text(value).toLowerCase().replace(/\s+/g, " "); }
function roundMoney(value: number) { return Math.round((Number(value) || 0) * 100) / 100; }
function columnLetter(index: number) { let column = ""; let current = index; while (current > 0) { const remainder = (current - 1) % 26; column = String.fromCharCode(65 + remainder) + column; current = Math.floor((current - 1) / 26); } return column; }
function today() { return new Date().toISOString().slice(0, 10); }
function makeId(prefix: string) { const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14); const random = Math.random().toString(36).slice(2, 8).toUpperCase(); return `${prefix}_${stamp}_${random}`; }
function saleKey(salesRefNo: string, groupRef: string, saleId?: string) { return text(saleId) || text(groupRef) || text(salesRefNo); }
function lineGrandTotal(row: string[]) { return toNumber(row[28] || row[7]); }
function getPaymentStatus(totalPaid: number, totalDue: number) { if (totalDue <= 0 || totalPaid <= 0) return "Pending"; if (totalPaid + 0.009 >= totalDue) return "Paid"; return "Partial"; }
function isVoidPayment(row: string[]) { return ["voided", "cancelled", "canceled"].includes(norm(row[12])); }
function isCancelledSale(row: string[]) { return ["cancelled", "canceled", "voided"].includes(norm(row[20])); }
function keysForSale(row: string[]) { return [text(row[22]), text(row[14]), text(row[1])].filter(Boolean); }
function keysForPayment(row: string[]) { return [text(row[11]), text(row[2]), text(row[1])].filter(Boolean); }
function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

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
async function readCreditRows(sheets: any) { await ensureSheetExists(sheets, CUSTOMER_CREDITS_SHEET, CREDIT_HEADERS); const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${CUSTOMER_CREDITS_SHEET}!A:L` }); return (response.data.values || []) as string[][]; }

function buildPaymentTotals(paymentRows: string[][]) {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  paymentRows.slice(1).forEach((row) => {
    if (isVoidPayment(row)) return;
    const amount = toNumber(row[5]);
    if (amount <= 0) return;
    keysForPayment(row).forEach((key) => {
      totals.set(key, roundMoney((totals.get(key) || 0) + amount));
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return { totals, counts };
}

function firstLedgerValue(map: Map<string, number>, keys: string[]) {
  for (const key of keys) if (map.has(key)) return map.get(key) || 0;
  return 0;
}

function buildSaleSummaries(salesRows: string[][], paymentRows: string[][]) {
  const { totals: paymentTotals, counts: paymentCounts } = buildPaymentTotals(paymentRows);
  const map = new Map<string, any>();
  salesRows.slice(1).forEach((row, index) => {
    if (isCancelledSale(row)) return;
    const saleDate = normalizeDate(row[0]);
    const salesRefNo = text(row[1]);
    const customerName = text(row[2]);
    const groupRef = text(row[14]);
    const saleId = text(row[22]);
    const customerId = text(row[33]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const due = lineGrandTotal(row);
    if (!key || !saleDate || !customerName || due <= 0) return;
    const current = map.get(key) || { key, salesRefNo, groupRef, saleId, customerId, customerName, saleDate, grandTotalPhp: 0, salesPaidPhp: 0, salesBalancePhp: 0, saleStatus: text(row[20]) || "Draft", rows: [] };
    current.grandTotalPhp = roundMoney(current.grandTotalPhp + due);
    current.salesPaidPhp = roundMoney(current.salesPaidPhp + toNumber(row[16]));
    current.salesBalancePhp = roundMoney(current.salesBalancePhp + toNumber(row[17]));
    current.rows.push({ rowNumber: index + 2, row });
    if (!current.saleId && saleId) current.saleId = saleId;
    if (!current.groupRef && groupRef) current.groupRef = groupRef;
    if (!current.customerId && customerId) current.customerId = customerId;
    if (norm(current.saleStatus) !== "confirmed" && text(row[20])) current.saleStatus = text(row[20]);
    map.set(key, current);
  });
  return Array.from(map.values()).map((sale) => {
    const lookupKeys = [sale.saleId, sale.groupRef, sale.salesRefNo, sale.key].filter(Boolean);
    const followUpPaid = roundMoney(firstLedgerValue(paymentTotals, lookupKeys));
    const paymentCount = firstLedgerValue(paymentCounts, lookupKeys);
    const paidFromSheetBalance = sale.salesBalancePhp > 0 ? roundMoney(Math.max(sale.grandTotalPhp - sale.salesBalancePhp, 0)) : 0;
    const paidFromSales = roundMoney(Math.max(sale.salesPaidPhp, 0));
    const paidFromLedgerOnly = roundMoney(Math.max(followUpPaid, 0));
    const totalPaid = roundMoney(Math.min(Math.max(paidFromSheetBalance, paidFromSales, paidFromLedgerOnly), sale.grandTotalPhp));
    const balance = roundMoney(Math.max(sale.grandTotalPhp - totalPaid, 0));
    return { ...sale, totalSalePhp: sale.grandTotalPhp, totalPaidPhp: totalPaid, paymentLedgerPaidPhp: followUpPaid, balancePhp: balance, paymentStatus: getPaymentStatus(totalPaid, sale.grandTotalPhp), paymentCount };
  });
}

async function updateSalePaymentFields(sheets: any, salesRows: string[][], key: string, totalPaid: number, paymentStatus: string) {
  const matchingRows = salesRows.slice(1).filter((row) => keysForSale(row).includes(key));
  const totalDueForKey = matchingRows.reduce((sum, row) => sum + lineGrandTotal(row), 0);
  const requests = salesRows.slice(1).flatMap((row, index) => {
    if (!keysForSale(row).includes(key)) return [];
    const due = lineGrandTotal(row);
    const share = totalDueForKey > 0 ? due / totalDueForKey : 0;
    const linePaid = roundMoney(Math.min(due, totalPaid * share));
    const lineBalance = roundMoney(Math.max(due - linePaid, 0));
    const rowNumber = index + 2;
    return [{ range: `${SALES_SHEET}!L${rowNumber}`, values: [[paymentStatus]] }, { range: `${SALES_SHEET}!Q${rowNumber}:R${rowNumber}`, values: [[linePaid, lineBalance]] }];
  });
  if (requests.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: requests } });
}

function parseCreditRows(rows: string[][]) {
  return rows.slice(1).map((row) => ({ creditDate: normalizeDate(row[0]), customerName: text(row[1]), customerId: text(row[2]), creditAmountPhp: toNumber(row[3]), paymentMethod: text(row[4]), transactionRef: text(row[5]), cashierName: text(row[6]), notes: text(row[7]), createdAt: text(row[8]), creditId: text(row[9]), sourcePaymentId: text(row[10]), status: text(row[11]) || "Open" })).filter((row) => row.customerName && row.creditAmountPhp > 0);
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const creditRows = await readCreditRows(sheets);
    return NextResponse.json({ credits: parseCreditRows(creditRows) });
  } catch (error: any) {
    console.error("CUSTOMER PAYMENTS GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load customer credits" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const customerName = text(body?.customerName);
    const customerId = text(body?.customerId);
    const paymentDate = normalizeDate(body?.paymentDate || today());
    const paymentMethod = text(body?.paymentMethod || "Bank Transfer");
    const transactionRef = text(body?.transactionRef);
    const cashierName = text(body?.cashierName || "Admin");
    const notes = text(body?.notes || "Customer group payment allocation");
    const paymentAmount = roundMoney(toNumber(body?.amountPaidPhp || body?.paymentAmount));
    const allocationMode = norm(body?.allocationMode || "fifo");

    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (paymentAmount <= 0) return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    if (!paymentDate) return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    if (allocationMode !== "fifo") return NextResponse.json({ error: "Only FIFO allocation is supported right now" }, { status: 400 });

    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    await ensureSheetExists(sheets, CUSTOMER_CREDITS_SHEET, CREDIT_HEADERS);
    const [salesRows, paymentRows] = await Promise.all([readSalesRows(sheets), readPaymentRows(sheets)]);
    const summaries = buildSaleSummaries(salesRows, paymentRows)
      .filter((sale) => norm(sale.customerName) === norm(customerName) || (customerId && norm(sale.customerId) === norm(customerId)))
      .filter((sale) => norm(sale.saleStatus) === "confirmed" && Number(sale.balancePhp || 0) > 0)
      .sort((a, b) => `${a.saleDate}-${a.createdAt || ""}-${a.salesRefNo}`.localeCompare(`${b.saleDate}-${b.createdAt || ""}-${b.salesRefNo}`));

    if (!summaries.length) {
      const groupPaymentId = makeId("PAYGROUP");
      const creditId = makeId("CREDIT");
      await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${CUSTOMER_CREDITS_SHEET}!A:L`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[paymentDate, customerName, customerId, paymentAmount, paymentMethod, transactionRef, cashierName, notes || "Customer advance payment", new Date().toISOString(), creditId, groupPaymentId, "Open"]] } });
      await appendAuditLog(sheets, { module: "Customer Payments", action: "CREATE_CUSTOMER_CREDIT", recordId: creditId, recordRef: customerName, actor: cashierName, summary: `Recorded customer credit ${paymentAmount} for ${customerName}; no open balances found`, after: { customerName, customerId, paymentAmount, creditAmountPhp: paymentAmount, paymentMethod, transactionRef } });
      return NextResponse.json({ ok: true, groupPaymentId, appliedAmountPhp: 0, creditAmountPhp: paymentAmount, allocations: [], creditId, message: "No open balances found. Full payment was saved as customer credit." });
    }

    let remaining = paymentAmount;
    const groupPaymentId = makeId("PAYGROUP");
    const allocationRows: any[] = [];
    const updatePlans: Array<{ key: string; newTotalPaid: number; paymentStatus: string }> = [];

    for (const sale of summaries) {
      if (remaining <= 0.009) break;
      const applyAmount = roundMoney(Math.min(remaining, sale.balancePhp));
      if (applyAmount <= 0) continue;
      const paymentId = makeId("PAY");
      allocationRows.push([paymentDate, sale.salesRefNo, sale.groupRef, sale.customerName, paymentMethod, applyAmount, transactionRef, cashierName, `${notes}${notes ? " | " : ""}Group payment ${groupPaymentId}`, new Date().toISOString(), paymentId, sale.saleId || "", "Active", "", ""]);
      const newTotalPaid = roundMoney(sale.totalPaidPhp + applyAmount);
      updatePlans.push({ key: sale.key, newTotalPaid, paymentStatus: getPaymentStatus(newTotalPaid, sale.grandTotalPhp) });
      remaining = roundMoney(remaining - applyAmount);
    }

    if (!allocationRows.length) return NextResponse.json({ error: "No balances could be allocated. Refresh and retry." }, { status: 400 });

    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:O`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: allocationRows } });
    for (const plan of updatePlans) await updateSalePaymentFields(sheets, salesRows, plan.key, plan.newTotalPaid, plan.paymentStatus);

    let creditId = "";
    const creditAmountPhp = roundMoney(Math.max(remaining, 0));
    if (creditAmountPhp > 0.009) {
      creditId = makeId("CREDIT");
      await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${CUSTOMER_CREDITS_SHEET}!A:L`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[paymentDate, customerName, customerId, creditAmountPhp, paymentMethod, transactionRef, cashierName, `Excess from group payment ${groupPaymentId}${notes ? ` | ${notes}` : ""}`, new Date().toISOString(), creditId, groupPaymentId, "Open"]] } });
    }

    const allocations = allocationRows.map((row) => ({ paymentDate: row[0], salesRefNo: row[1], groupRef: row[2], customerName: row[3], paymentMethod: row[4], amountPaidPhp: row[5], transactionRef: row[6], paymentId: row[10], saleId: row[11] }));
    const appliedAmountPhp = roundMoney(paymentAmount - creditAmountPhp);
    await appendAuditLog(sheets, { module: "Customer Payments", action: "CREATE_GROUP_PAYMENT", recordId: groupPaymentId, recordRef: customerName, actor: cashierName, summary: `Allocated group payment ${paymentAmount} for ${customerName}: applied ${appliedAmountPhp}, credit ${creditAmountPhp}`, before: { customerName, paymentAmount }, after: { groupPaymentId, customerName, customerId, paymentAmount, appliedAmountPhp, creditAmountPhp, allocationCount: allocations.length, allocations } });

    return NextResponse.json({ ok: true, groupPaymentId, appliedAmountPhp, creditAmountPhp, creditId, allocations, message: `Group payment saved. Applied ${appliedAmountPhp}; credit ${creditAmountPhp}.` });
  } catch (error: any) {
    console.error("CUSTOMER PAYMENTS POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save customer group payment" }, { status: 500 });
  }
}
