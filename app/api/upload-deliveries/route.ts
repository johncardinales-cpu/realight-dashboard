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

type DeliveryRow = {
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
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows as DeliveryRow[] : [];

    if (!rows.length) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const values = rows.map((row) => {
      const uploadDate = required(row.uploadDate);
      const arrivalDate = required(row.arrivalDate);
      const supplier = required(row.supplier);
      const batchReference = required(row.batchReference);
      const description = required(row.description);
      const specification = required(row.specification);
      const qtyAdded = required(row.qtyAdded);
      const status = required(row.status || "Incoming");

      if (!uploadDate || !supplier || !description || !specification || !qtyAdded || !status) {
        throw new Error("One or more rows are missing required fields");
      }

      return [
        uploadDate,
        arrivalDate,
        supplier,
        batchReference,
        description,
        specification,
        qtyAdded,
        row.unitPriceUsd ?? "",
        row.invoiceValid ?? "",
        status,
        row.notes ?? "",
        new Date().toISOString(),
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ ok: true, imported: values.length });
  } catch (error: any) {
    console.error("UPLOAD DELIVERIES API ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to upload deliveries" },
      { status: 500 }
    );
  }
}
