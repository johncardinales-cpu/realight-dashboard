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
const DELIVERIES_SHEET = "App_Deliveries";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";

function toNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const [deliveriesRes, supplierRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${DELIVERIES_SHEET}!A:L`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SUPPLIER_COSTS_SHEET}!A:L`,
      }).catch(() => ({ data: { values: [] } })),
    ]);

    const rows = deliveriesRes.data.values || [];
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

    const supplierRows = (supplierRes.data.values || []).slice(1);
    const totalExpenses = supplierRows.reduce((sum, row) => {
      return sum + toNumber(String(row[10] || ""));
    }, 0);

    return NextResponse.json({
      incomingUnits,
      warehouseReceived,
      actualOnHand,
      sellableUnits,
      totalSales: 0,
      totalExpenses,
      netGain: 0 - totalExpenses,
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
