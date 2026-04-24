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

type InventoryItem = {
  Description: string;
  Specification: string;
  "Incoming Qty": number;
  "Received Qty": number;
  "Sold Qty": number;
  "Actual On Hand": number;
  "Minimum Buffer": number;
  "Sellable Qty": number;
  "Latest Received": string;
  "Latest Incoming": string;
};

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

    const grouped = new Map<string, InventoryItem>();

    for (const row of data) {
      const uploadDate = String(row[0] || "").trim();
      const arrivalDate = String(row[1] || "").trim();
      const description = String(row[4] || "").trim();
      const specification = String(row[5] || "").trim();
      const qty = toNumber(String(row[6] || ""));
      const status = String(row[9] || "").trim().toLowerCase();

      if (!description && !specification) continue;

      const key = `${description}|||${specification}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          Description: description,
          Specification: specification,
          "Incoming Qty": 0,
          "Received Qty": 0,
          "Sold Qty": 0,
          "Actual On Hand": 0,
          "Minimum Buffer": 0,
          "Sellable Qty": 0,
          "Latest Received": "",
          "Latest Incoming": "",
        });
      }

      const item = grouped.get(key)!;

      if (status === "incoming") {
        item["Incoming Qty"] += qty;
        if (arrivalDate) item["Latest Incoming"] = arrivalDate;
      } else if (status === "received") {
        item["Received Qty"] += qty;
        if (arrivalDate) item["Latest Received"] = arrivalDate;
      } else if (status === "available") {
        item["Actual On Hand"] += qty;
        item["Sellable Qty"] += qty;
        if (arrivalDate) item["Latest Received"] = arrivalDate;
      } else if (status === "in transit") {
        if (arrivalDate) item["Latest Incoming"] = arrivalDate;
      }

      if (!item["Latest Incoming"] && uploadDate) {
        item["Latest Incoming"] = uploadDate;
      }
    }

    return NextResponse.json(Array.from(grouped.values()));
  } catch (error: any) {
    console.error("INVENTORY API ERROR:", error);
    return NextResponse.json(
      {
        error: error?.message || String(error) || "Failed to load inventory data",
      },
      { status: 500 }
    );
  }
}
