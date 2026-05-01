import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "App_Deliveries";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`,
    });

    const row = rowResponse.data.values?.[0] || [];
    const currentArrivalDate = String(row[1] || "").trim();

    const updates: Array<{ range: string; values: string[][] }> = [
      {
        range: `${SHEET_NAME}!J${rowNumber}`,
        values: [[status]],
      },
    ];

    const statusLower = status.toLowerCase();
    if (
      (statusLower === "received" || statusLower === "available") &&
      !currentArrivalDate
    ) {
      updates.push({
        range: `${SHEET_NAME}!B${rowNumber}`,
        values: [[todayIso()]],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });

    return NextResponse.json({
      ok: true,
      rowNumber,
      status,
      autoFilledArrivalDate:
        (statusLower === "received" || statusLower === "available") &&
        !currentArrivalDate,
    });
  } catch (error: any) {
    console.error("INCOMING DELIVERIES STATUS ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to update delivery status" },
      { status: 500 }
    );
  }
}
