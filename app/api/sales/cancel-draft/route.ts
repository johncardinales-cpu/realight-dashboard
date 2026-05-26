import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
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

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
}

async function sheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function appendAuditLog(sheets: any, row: string[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  }).catch(async () => {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: AUDIT_LOG_SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_LOG_SHEET}!A1:J1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"]] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_LOG_SHEET}!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const saleId = clean(body?.saleId);
    const salesRefNo = clean(body?.salesRefNo);
    const groupRef = clean(body?.groupRef);
    const actor = clean(body?.actor || body?.cashierName || "Admin");

    if (!saleId && !salesRefNo && !groupRef) {
      return NextResponse.json({ error: "Sale reference is required" }, { status: 400 });
    }

    const sheets = await sheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
    const rows = (response.data.values || []) as string[][];

    const matches = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
      if (saleId && clean(row[22]) === saleId) return true;
      if (groupRef && clean(row[14]) === groupRef) return true;
      if (salesRefNo && clean(row[1]) === salesRefNo) return true;
      return false;
    });

    if (!matches.length) {
      return NextResponse.json({ error: "Sale was not found" }, { status: 404 });
    }

    if (matches.some(({ row }) => clean(row[20]).toLowerCase() === "confirmed")) {
      return NextResponse.json({ error: "Confirmed sales cannot be cancelled here." }, { status: 400 });
    }

    const first = matches[0].row;
    const recordRef = clean(first[1]) || clean(first[14]) || clean(first[22]) || salesRefNo || groupRef || saleId;
    const customerName = clean(first[2]);
    const summary = `Cancelled draft sale ${recordRef}${customerName ? ` for ${customerName}` : ""}. No inventory deduction and no report impact.`;
    const beforeJson = JSON.stringify({ salesRefNo: clean(first[1]), groupRef: clean(first[14]), saleId: clean(first[22]), customerName, saleStatus: clean(first[20]) || "Draft", paymentStatus: clean(first[11]) || "Pending", lineCount: matches.length });
    const stamp = new Date().toISOString();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: matches.flatMap(({ rowNumber }) => [
          { range: `${SALES_SHEET}!L${rowNumber}`, values: [["Cancelled"]] },
          { range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Cancelled", stamp]] },
        ]),
      },
    });

    await appendAuditLog(sheets, [
      makeId("AUDIT"),
      stamp,
      "Sales",
      "CANCEL_DRAFT_SALE",
      clean(first[22]),
      recordRef,
      actor,
      summary,
      beforeJson,
      JSON.stringify({ saleStatus: "Cancelled", paymentStatus: "Cancelled", cancelledAt: stamp }),
    ]);

    return NextResponse.json({ ok: true, message: "Draft sale cancelled successfully and recorded in Recent Activity." });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to cancel draft sale" }, { status: 500 });
  }
}
