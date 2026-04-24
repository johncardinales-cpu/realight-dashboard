import { NextResponse } from "next/server";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "App_Deliveries";

const COLUMNS = [
  "Upload Date",
  "Arrival Date",
  "Supplier",
  "Batch / Reference",
  "Description",
  "Specification",
  "Qty Added",
  "Unit Price (USD)",
  "Invoice Valid",
  "Status",
  "Notes",
  "Created At",
];

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
    });

    const rows = response.data.values || [];
    const data = rows.slice(1).filter((row) =>
      row.some((cell) => String(cell || "").trim() !== "")
    );

    const items = data.map((row, index) => {
      const obj: Record<string, string> = {};
      COLUMNS.forEach((col, i) => {
        obj[col] = String(row[i] || "").trim();
      });
      obj["_rowNumber"] = String(index + 2);
      return obj;
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("INCOMING DELIVERIES READ ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load deliveries" },
      { status: 500 }
    );
  }
}
