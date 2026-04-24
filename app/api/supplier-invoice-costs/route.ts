import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Supplier_Invoice_Costs";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const HEADERS = [
  "Upload Date",
  "Supplier",
  "Batch / Reference",
  "Invoice No.",
  "Invoice Valid",
  "Product Subtotal",
  "Freight Cost",
  "Delivery Cost",
  "Customs Cost",
  "Other Cost",
  "Total Invoice Cost",
  "Notes",
];

async function ensureSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find(
    (s: any) => s.properties?.title === SHEET_NAME
  );
  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: SHEET_NAME,
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:L1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [HEADERS],
    },
  });
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

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
      HEADERS.forEach((col, i) => {
        obj[col] = String(row[i] || "").trim();
      });
      obj["_rowNumber"] = String(index + 2);
      return obj;
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("SUPPLIER COSTS GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load supplier invoice costs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const uploadDate = String(body?.uploadDate || "").trim();
    const supplier = String(body?.supplier || "").trim();
    const batchReference = String(body?.batchReference || "").trim();
    const invoiceNo = String(body?.invoiceNo || "").trim();
    const invoiceValid = String(body?.invoiceValid || "").trim();
    const productSubtotal = Number(body?.productSubtotal || 0);
    const freightCost = Number(body?.freightCost || 0);
    const deliveryCost = Number(body?.deliveryCost || 0);
    const customsCost = Number(body?.customsCost || 0);
    const otherCost = Number(body?.otherCost || 0);
    const notes = String(body?.notes || "").trim();

    if (!uploadDate || !supplier || !batchReference) {
      return NextResponse.json(
        { error: "Upload Date, Supplier, and Batch / Reference are required" },
        { status: 400 }
      );
    }

    const totalInvoiceCost =
      productSubtotal + freightCost + deliveryCost + customsCost + otherCost;

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          uploadDate,
          supplier,
          batchReference,
          invoiceNo,
          invoiceValid,
          productSubtotal,
          freightCost,
          deliveryCost,
          customsCost,
          otherCost,
          totalInvoiceCost,
          notes,
        ]],
      },
    });

    return NextResponse.json({ ok: true, totalInvoiceCost });
  } catch (error: any) {
    console.error("SUPPLIER COSTS POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to save supplier invoice cost" },
      { status: 500 }
    );
  }
}
