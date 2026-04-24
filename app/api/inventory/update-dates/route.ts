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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const description = String(body?.description || "").trim();
    const specification = String(body?.specification || "").trim();
    const latestReceived = String(body?.latestReceived || "").trim();
    const latestIncoming = String(body?.latestIncoming || "").trim();

    if (!description || !specification) {
      return NextResponse.json(
        { error: "Description and Specification are required" },
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
    const updates: any[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNum = index + 2;
      const rowDescription = String(row[4] || "").trim();
      const rowSpecification = String(row[5] || "").trim();
      const status = String(row[9] || "").trim().toLowerCase();

      if (rowDescription !== description || rowSpecification !== specification) return;

      if ((status === "received" || status === "available") && latestReceived) {
        updates.push({
          range: `${SHEET_NAME}!B${rowNum}`,
          values: [[latestReceived]],
        });
      }

      if ((status === "incoming" || status === "in transit") && latestIncoming) {
        updates.push({
          range: `${SHEET_NAME}!B${rowNum}`,
          values: [[latestIncoming]],
        });
      }
    });

    if (!updates.length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (error: any) {
    console.error("INVENTORY UPDATE DATES ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to update inventory dates" },
      { status: 500 }
    );
  }
}
