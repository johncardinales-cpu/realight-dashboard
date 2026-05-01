import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "App_Deliveries";

type MarkDamagedBody = {
  description?: unknown;
  specification?: unknown;
  quantity?: unknown;
  reason?: unknown;
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to mark item as damaged";
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MarkDamagedBody;
    const description = String(body.description || "").trim();
    const specification = String(body.specification || "").trim();
    const quantity = toNumber(body.quantity);
    const reason = String(body.reason || "Marked damaged from dashboard").trim();
    const today = new Date().toISOString().slice(0, 10);

    if (!description || !specification || quantity <= 0) {
      return NextResponse.json(
        { error: "Description, specification, and damaged quantity are required." },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          today,
          today,
          "DAMAGE",
          "Dashboard Adjustment",
          description,
          specification,
          quantity,
          "",
          "",
          "Damaged",
          "",
          reason,
        ]],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("MARK DAMAGED ERROR:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
