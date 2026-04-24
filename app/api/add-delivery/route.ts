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

type Payload = {
  uploadDate: string;
  arrivalDate: string;
  supplier: string;
  batchReference: string;
  description: string;
  specification: string;
  qtyAdded: string | number;
  unitPriceUsd?: string | number;
  invoiceValid?: string;
  status: string;
  notes?: string;
};

function required(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const uploadDate = required(body.uploadDate);
    const arrivalDate = required(body.arrivalDate);
    const supplier = required(body.supplier);
    const batchReference = required(body.batchReference);
    const description = required(body.description);
    const specification = required(body.specification);
    const qtyAdded = required(body.qtyAdded);
    const status = required(body.status);

    if (!uploadDate || !supplier || !description || !specification || !qtyAdded || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const row = [
      uploadDate,
      arrivalDate,
      supplier,
      batchReference,
      description,
      specification,
      qtyAdded,
      body.unitPriceUsd ?? "",
      body.invoiceValid ?? "",
      status,
      body.notes ?? "",
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("ADD DELIVERY API ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to add delivery" },
      { status: 500 }
    );
  }
}
