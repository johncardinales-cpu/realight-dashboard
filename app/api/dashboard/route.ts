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

function toNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

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

    let incomingUnits = 0;
    let warehouseReceived = 0;
    let actualOnHand = 0;
    let sellableUnits = 0;

    for (const row of data) {
      const qty = toNumber(String(row[6] || ""));
      const status = String(row[9] || "").trim().toLowerCase();

      if (status === "incoming") {
        incomingUnits += qty;
      } else if (status === "received") {
        warehouseReceived += qty;
      } else if (status === "available") {
        actualOnHand += qty;
        sellableUnits += qty;
      }
    }

    return NextResponse.json({
      incomingUnits,
      warehouseReceived,
      actualOnHand,
      sellableUnits,
      totalSales: 0,
      totalExpenses: 0,
      netGain: 0,
    });
  } catch (error: any) {
    console.error("DASHBOARD API ERROR:", error);
    return NextResponse.json(
      {
        error: error?.message || String(error) || "Failed to load dashboard data",
      },
      { status: 500 }
    );
  }
}
