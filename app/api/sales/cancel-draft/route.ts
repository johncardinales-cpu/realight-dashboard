import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";

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

async function sheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const saleId = clean(body?.saleId);
    const salesRefNo = clean(body?.salesRefNo);
    const groupRef = clean(body?.groupRef);

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

    return NextResponse.json({ ok: true, message: "Draft sale cancelled successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to cancel draft sale" }, { status: 500 });
  }
}
