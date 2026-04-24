import { NextResponse } from "next/server";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "App_Deliveries";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const createdAt = String(body?.createdAt || "").trim();
    const status = String(body?.status || "").trim();

    if (!createdAt || !status) {
      return NextResponse.json(
        { error: "createdAt and status are required" },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
    });

    const rows = response.data.values || [];
    const data = rows.slice(1);

    const dataIndex = data.findIndex(
      (row) => String(row[11] || "").trim() === createdAt
    );

    if (dataIndex === -1) {
      return NextResponse.json({ error: "Delivery row not found" }, { status: 404 });
    }

    const actualRowNumber = dataIndex + 2;
    const statusCell = `${SHEET_NAME}!J${actualRowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: statusCell,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[status]],
      },
    });

    return NextResponse.json({ ok: true, createdAt, status });
  } catch (error: any) {
    console.error("INCOMING DELIVERIES STATUS ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to update delivery status" },
      { status: 500 }
    );
  }
}
