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
    const rowNumber = Number(body?.rowNumber);
    const status = String(body?.status || "").trim();

    if (!rowNumber || !status) {
      return NextResponse.json(
        { error: "rowNumber and status are required" },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const statusCell = `${SHEET_NAME}!J${rowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: statusCell,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[status]],
      },
    });

    return NextResponse.json({ ok: true, rowNumber, status });
  } catch (error: any) {
    console.error("INCOMING DELIVERIES STATUS ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to update delivery status" },
      { status: 500 }
    );
  }
}
