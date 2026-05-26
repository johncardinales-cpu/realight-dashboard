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

function clean(value: unknown) {
  return String(value || "").trim();
}

function moneyNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function normalDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [m, d, y0] = raw.split("/").map(Number);
    const y = y0 < 100 ? 2000 + y0 : y0;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) {
      return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function id(prefix: string) {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isConfirmed(row: string[]) {
  return clean(row[20]).toLowerCase() === "confirmed";
}

function isVoidedPayment(row: string[]) {
  return ["voided", "cancelled", "canceled"].includes(clean(row[12]).toLowerCase());
}

function saleTotal(row: string[]) {
  return moneyNumber(row[28] || row[7]);
}

async function sheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function ensureAudit(sheets: any) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A1:J1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"]] },
  }).catch(async () => {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: AUDIT_LOG_SHEET } } }] } });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_LOG_SHEET}!A1:J1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"]] },
    });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saleDate = normalDate(body?.saleDate);
    const salesRefNo = clean(body?.salesRefNo);
    const customerName = clean(body?.customerName);
    const totalSalePhp = moneyNumber(body?.totalSalePhp);
    const actor = clean(body?.actor || "Admin");
    const reason = clean(body?.reason || "Testing cleanup from app");

    if (!saleDate || !customerName || totalSalePhp <= 0) {
      return NextResponse.json({ error: "Sale date, customer name, and total sale amount are required." }, { status: 400 });
    }

    const sheets = await sheetsClient();
    await ensureAudit(sheets);

    const [salesRes, paymentsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PAYMENTS_SHEET}!A:O` }).catch(() => ({ data: { values: [] } })),
    ]);

    const salesRows = (salesRes.data.values || []) as string[][];
    const paymentRows = (paymentsRes.data.values || []) as string[][];

    const matches = salesRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
      if (isConfirmed(row)) return false;
      if (normalDate(row[0]) !== saleDate) return false;
      if (clean(row[2]).toLowerCase() !== customerName.toLowerCase()) return false;
      if (salesRefNo && clean(row[1]) !== salesRefNo) return false;
      return Math.abs(saleTotal(row) - totalSalePhp) < 0.01;
    });

    if (!matches.length) {
      return NextResponse.json({ error: "No matching unconfirmed sale was found. Confirmed sales must use Undo Confirm first." }, { status: 404 });
    }

    const first = matches[0].row;
    const recordRef = clean(first[1]) || clean(first[14]) || clean(first[22]) || "unconfirmed sale";
    const stamp = new Date().toISOString();
    const saleRef = clean(first[1]);
    const groupRef = clean(first[14]);
    const saleId = clean(first[22]);
    const keys = [saleId, groupRef, saleRef].filter(Boolean);

    const linkedPayments = paymentRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
      if (isVoidedPayment(row)) return false;
      const paymentKeys = [clean(row[11]), clean(row[2]), clean(row[1])].filter(Boolean);
      const direct = keys.some((key) => paymentKeys.includes(key));
      const fallback = clean(row[1]) === saleRef && clean(row[3]).toLowerCase() === customerName.toLowerCase();
      return direct || fallback;
    });

    const updates = [
      ...matches.flatMap(({ rowNumber }) => [
        { range: `${SALES_SHEET}!L${rowNumber}`, values: [["Cancelled"]] },
        { range: `${SALES_SHEET}!Q${rowNumber}:R${rowNumber}`, values: [[0, 0]] },
        { range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Cancelled", stamp]] },
        { range: `${SALES_SHEET}!AI${rowNumber}:AJ${rowNumber}`, values: [[0, 0]] },
      ]),
      ...linkedPayments.map(({ rowNumber }) => ({ range: `${PAYMENTS_SHEET}!M${rowNumber}:O${rowNumber}`, values: [["Voided", stamp, reason]] })),
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_LOG_SHEET}!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          id("AUDIT"),
          stamp,
          "Testing Cleanup",
          "CLEAN_UNCONFIRMED_SALE",
          saleId,
          recordRef,
          actor,
          `Cancelled ${matches.length} unconfirmed sale row(s) and voided ${linkedPayments.length} payment row(s).`,
          JSON.stringify({ saleDate, salesRefNo, customerName, totalSalePhp, reason }),
          JSON.stringify({ saleStatus: "Cancelled", paymentStatus: "Cancelled", paymentRowsVoided: linkedPayments.length }),
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Cleanup completed. Cancelled ${matches.length} sale row(s) and voided ${linkedPayments.length} payment row(s).`,
      cancelledSaleRows: matches.length,
      voidedPaymentRows: linkedPayments.length,
    });
  } catch (error: any) {
    console.error("TESTING CLEANUP ERROR:", error);
    return NextResponse.json({ error: error?.message || "Cleanup failed" }, { status: 500 });
  }
}
