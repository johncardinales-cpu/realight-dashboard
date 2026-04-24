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

function columnLetter(index: number) {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

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
    if (rows.length < 2) {
      return NextResponse.json({ error: "No delivery rows found" }, { status: 404 });
    }

    const header = rows[0].map((h) => String(h).trim());
    const createdAtIndex = header.findIndex((h) => h === "Created At");
    const statusIndex = header.findIndex((h) => h === "Status");

    if (createdAtIndex === -1 || statusIndex === -1) {
      return NextResponse.json(
        { error: "Could not find Created At or Status column" },
        { status: 400 }
      );
    }

    const dataIndex = rows.slice(1).findIndex(
      (row) => String(row[createdAtIndex] || "").trim() === createdAt
    );

    if (dataIndex === -1) {
      return NextResponse.json({ error: "Delivery row not found" }, { status: 404 });
    }

    const actualRowNumber = dataIndex + 2;
    const statusCell = `${SHEET_NAME}!${columnLetter(statusIndex)}${actualRowNumber}`;

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
