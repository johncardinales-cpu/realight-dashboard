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
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function clean(value: unknown) { return String(value || "").trim(); }
function toNumber(value: unknown) { return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0; }
function makeId(prefix: string) { const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14); const random = Math.random().toString(36).slice(2, 8).toUpperCase(); return `${prefix}_${stamp}_${random}`; }
function columnLetter(index: number) { let column = ""; let current = index; while (current > 0) { const remainder = (current - 1) % 26; column = String.fromCharCode(65 + remainder) + column; current = Math.floor((current - 1) / 26); } return column; }
function saleKey(salesRefNo: string, groupRef: string, saleId?: string) { return clean(saleId) || clean(groupRef) || clean(salesRefNo); }
function saleMatchKeys(row: string[]) { return [saleKey(clean(row[1]), clean(row[14]), clean(row[22])), clean(row[22]), clean(row[14]), clean(row[1])].filter(Boolean); }
function paymentMatchKeys(row: string[]) { return [saleKey(clean(row[1]), clean(row[2]), clean(row[11])), clean(row[11]), clean(row[2]), clean(row[1])].filter(Boolean); }
function isVoidedPayment(row: string[]) { return ["voided", "cancelled", "canceled"].includes(clean(row[12]).toLowerCase()); }
function normalizeDate(value: unknown) { const raw = clean(value); if (!raw) return ""; if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10); if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) { const [m, d, y0] = raw.split("/").map(Number); const y = y0 < 100 ? 2000 + y0 : y0; return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; } if (/^\d+(\.\d+)?$/.test(raw)) { const serial = Number(raw); if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10); } const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10); }

async function sheetsClient() { const client = await auth.getClient(); return google.sheets({ version: "v4", auth: client as any }); }
async function ensureSheetExists(sheets: any, title: string, headers: string[]) { const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID }); const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title); if (!found) await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } }); await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1:${columnLetter(headers.length)}1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } }); }
async function appendAuditLog(sheets: any, row: string[]) { await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS); await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${AUDIT_LOG_SHEET}!A:J`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [row] } }); }

function rowMatchesFallback(row: string[], body: any) {
  const saleDate = normalizeDate(body?.saleDate);
  const customerName = clean(body?.customerName).toLowerCase();
  const totalSalePhp = toNumber(body?.totalSalePhp);
  if (!saleDate || !customerName || totalSalePhp <= 0) return false;
  const rowDate = normalizeDate(row[0]);
  const rowCustomer = clean(row[2]).toLowerCase();
  const rowTotal = toNumber(row[28] || row[7]);
  return rowDate === saleDate && rowCustomer === customerName && Math.abs(rowTotal - totalSalePhp) < 0.01;
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const saleId = clean(body?.saleId);
    const salesRefNo = clean(body?.salesRefNo);
    const groupRef = clean(body?.groupRef);
    const actor = clean(body?.actor || body?.cashierName || "Admin");
    const reason = clean(body?.reason || "Cancelled unconfirmed sale");
    if (!saleId && !salesRefNo && !groupRef && !body?.saleDate) return NextResponse.json({ error: "Sale reference is required" }, { status: 400 });

    const sheets = await sheetsClient();
    await ensureSheetExists(sheets, PAYMENTS_SHEET, PAYMENT_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const [salesResponse, paymentsResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:O` }).catch(() => ({ data: { values: [] } })),
    ]);

    const rows = (salesResponse.data.values || []) as string[][];
    const paymentRows = (paymentsResponse.data.values || []) as string[][];
    const requestedKeys = [saleKey(salesRefNo, groupRef, saleId), saleId, groupRef].filter(Boolean);
    if (!saleId && !groupRef && salesRefNo) requestedKeys.push(salesRefNo);

    let matches = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
      const keys = saleMatchKeys(row);
      if (requestedKeys.length && requestedKeys.some((key) => keys.includes(key))) return true;
      return false;
    });

    if (!saleId && !groupRef && salesRefNo && matches.length > 1) {
      const exactMatches = matches.filter(({ row }) => rowMatchesFallback(row, body));
      if (exactMatches.length) matches = exactMatches;
    }
    if (!matches.length) {
      matches = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => rowMatchesFallback(row, body));
    }
    if (!matches.length) return NextResponse.json({ error: "Sale was not found" }, { status: 404 });

    const unconfirmedMatches = matches.filter(({ row }) => clean(row[20]).toLowerCase() !== "confirmed");
    if (!unconfirmedMatches.length) return NextResponse.json({ error: "Confirmed sales must be undone first before cancelling/voiding." }, { status: 400 });
    matches = unconfirmedMatches;

    const first = matches[0].row;
    const recordRef = clean(first[1]) || clean(first[14]) || clean(first[22]) || salesRefNo || groupRef || saleId;
    const customerName = clean(first[2]);
    const targetKey = saleKey(clean(first[1]), clean(first[14]), clean(first[22])) || recordRef;
    const targetKeys = [targetKey, clean(first[22]), clean(first[14]), clean(first[1])].filter(Boolean);
    const stamp = new Date().toISOString();

    const linkedPayments = paymentRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
      if (isVoidedPayment(row)) return false;
      const keys = paymentMatchKeys(row);
      const direct = targetKeys.some((key) => keys.includes(key));
      const fallback = clean(row[3]).toLowerCase() === customerName.toLowerCase() && clean(row[1]) === clean(first[1]);
      return direct || fallback;
    });

    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: [
      ...matches.flatMap(({ rowNumber }) => [
        { range: `${SALES_SHEET}!L${rowNumber}`, values: [["Cancelled"]] },
        { range: `${SALES_SHEET}!Q${rowNumber}:R${rowNumber}`, values: [[0, 0]] },
        { range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Cancelled", stamp]] },
        { range: `${SALES_SHEET}!AI${rowNumber}:AJ${rowNumber}`, values: [[0, 0]] },
      ]),
      ...linkedPayments.map(({ rowNumber }) => ({ range: `${PAYMENTS_SHEET}!M${rowNumber}:O${rowNumber}`, values: [["Voided", stamp, reason]] })),
    ] } });

    const totalSale = matches.reduce((sum, item) => sum + toNumber(item.row[28] || item.row[7]), 0);
    const initialPaid = matches.reduce((sum, item) => sum + toNumber(item.row[16]), 0);
    const voidedPaymentAmount = linkedPayments.reduce((sum, item) => sum + toNumber(item.row[5]), 0);
    const summary = `Cancelled unconfirmed sale ${recordRef}${customerName ? ` for ${customerName}` : ""}. Voided ${linkedPayments.length} linked payment record(s). No inventory deduction and no report impact.`;
    await appendAuditLog(sheets, [makeId("AUDIT"), stamp, "Sales", "CANCEL_UNCONFIRMED_SALE", clean(first[22]), recordRef, actor, summary, JSON.stringify({ salesRefNo: clean(first[1]), groupRef: clean(first[14]), saleId: clean(first[22]), customerName, saleStatus: clean(first[20]) || "Draft", paymentStatus: clean(first[11]) || "Pending", totalSale, initialPaid, linkedPaymentCount: linkedPayments.length, linkedPaymentAmount: voidedPaymentAmount }), JSON.stringify({ saleStatus: "Cancelled", paymentStatus: "Cancelled", amountPaid: 0, balance: 0, linkedPayments: "Voided", cancelledAt: stamp, reason })]);
    return NextResponse.json({ ok: true, message: `Unconfirmed sale cancelled. ${linkedPayments.length} linked payment record(s) were voided.`, voidedPaymentCount: linkedPayments.length, voidedPaymentAmount });
  } catch (error: any) {
    console.error("CANCEL UNCONFIRMED SALE ERROR:", error);
    return NextResponse.json({ error: error?.message || "Failed to cancel unconfirmed sale" }, { status: 500 });
  }
}
