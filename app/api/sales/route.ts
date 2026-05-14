import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PRICING_SHEET = "Pricing_Base";
const INVENTORY_SHEET = "App_Deliveries";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SALES_HEADERS = [
  "Sale Date","Sales Ref No.","Customer Name","Description","Specification","Qty",
  "Manual Unit Price (PHP)","Total Sale (PHP)","Cost Price (PHP)","Total Cost (PHP)",
  "Gross Profit (PHP)","Payment Status","Salesperson","Notes","Group Ref",
  "Payment Method","Amount Paid (PHP)","Balance (PHP)","Transaction Ref",
  "Cashier Name","Sale Status","Confirmed At",
];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function itemKey(description: string, specification: string) {
  return `${description.trim()}|||${specification.trim()}`;
}

function columnLetter(index: number) {
  let column = "";
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function isValidSalesRow(row: string[]) {
  const saleDate = String(row[0] || "").trim();
  const customerName = String(row[2] || "").trim();
  const description = String(row[3] || "").trim();
  const specification = String(row[4] || "").trim();
  const qty = toNumber(row[5]);

  if (!saleDate || saleDate.toLowerCase() === "date") return false;
  if (!customerName || customerName.toLowerCase() === "customer") return false;
  if (!description || description.toLowerCase() === "description") return false;
  if (!specification || specification.toLowerCase() === "specification") return false;
  if (description.includes("One sold item per row")) return false;
  if (qty <= 0) return false;
  return true;
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title);

  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }

  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${lastCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
}

async function getPricingMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${PRICING_SHEET}!A:N`,
  });

  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();

  rows.slice(1).forEach((row: string[]) => {
    const key = itemKey(String(row[1] || ""), String(row[2] || ""));
    const costPhp = toNumber(row[7]);
    if (key !== "|||") map.set(key, costPhp);
  });

  return map;
}

async function getAvailableStockMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${INVENTORY_SHEET}!A:L`,
  });

  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();

  rows.slice(1).forEach((row: string[]) => {
    const description = String(row[4] || "").trim();
    const specification = String(row[5] || "").trim();
    const qty = toNumber(row[6]);
    const status = String(row[9] || "").trim().toLowerCase();

    if (!description && !specification) return;

    const key = itemKey(description, specification);
    const current = map.get(key) || 0;

    if (status === "available") {
      map.set(key, current + qty);
    } else if (status === "damaged" || status === "defective" || status === "damage") {
      map.set(key, current - qty);
    }
  });

  return map;
}

async function getConfirmedSoldMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SALES_SHEET}!A:V`,
  });

  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();

  rows.slice(1).filter(isValidSalesRow).forEach((row: string[]) => {
    const description = String(row[3] || "").trim();
    const specification = String(row[4] || "").trim();
    const qty = toNumber(row[5]);
    const saleStatus = String(row[20] || "Draft").trim().toLowerCase();

    if (saleStatus !== "confirmed") return;

    const key = itemKey(description, specification);
    map.set(key, (map.get(key) || 0) + qty);
  });

  return map;
}

function getRequestedQtyMap(items: any[]) {
  const map = new Map<string, { description: string; specification: string; qty: number }>();

  items.forEach((item: any) => {
    const description = String(item?.description || "").trim();
    const specification = String(item?.specification || "").trim();
    const qty = toNumber(item?.qty);
    const key = itemKey(description, specification);
    const current = map.get(key);

    map.set(key, {
      description,
      specification,
      qty: (current?.qty || 0) + qty,
    });
  });

  return map;
}

async function validateConfirmedStock(sheets: any, items: any[]) {
  const [availableStockMap, confirmedSoldMap] = await Promise.all([
    getAvailableStockMap(sheets),
    getConfirmedSoldMap(sheets),
  ]);
  const requestedQtyMap = getRequestedQtyMap(items);
  const insufficientItems: string[] = [];

  requestedQtyMap.forEach(({ description, specification, qty }, key) => {
    const availableQty = Math.max((availableStockMap.get(key) || 0) - (confirmedSoldMap.get(key) || 0), 0);

    if (qty > availableQty) {
      insufficientItems.push(`${description} / ${specification}: requested ${qty}, available ${availableQty}`);
    }
  });

  if (insufficientItems.length) {
    return `Insufficient confirmed stock. ${insufficientItems.join("; ")}`;
  }

  return "";
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SALES_SHEET}!A:V`,
    });

    const rows = (response.data.values || []) as string[][];
    const data = rows.slice(1).filter(isValidSalesRow);

    const items = data.map((row: string[], index: number) => ({
      rowNumber: index + 2,
      saleDate: String(row[0] || ""),
      salesRefNo: String(row[1] || ""),
      customerName: String(row[2] || ""),
      description: String(row[3] || ""),
      specification: String(row[4] || ""),
      qty: toNumber(row[5]),
      unitPricePhp: toNumber(row[6]),
      totalSalePhp: toNumber(row[7]),
      costPricePhp: toNumber(row[8]),
      totalCostPhp: toNumber(row[9]),
      grossProfitPhp: toNumber(row[10]),
      paymentStatus: String(row[11] || "Pending"),
      salesperson: String(row[12] || ""),
      notes: String(row[13] || ""),
      groupRef: String(row[14] || ""),
      paymentMethod: String(row[15] || ""),
      amountPaidPhp: toNumber(row[16]),
      balancePhp: toNumber(row[17]),
      transactionRef: String(row[18] || ""),
      cashierName: String(row[19] || ""),
      saleStatus: String(row[20] || "Draft"),
      confirmedAt: String(row[21] || ""),
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("SALES GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to load sales" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saleDate = String(body?.saleDate || "").trim();
    const salesRefNo = String(body?.salesRefNo || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const paymentStatus = String(body?.paymentStatus || "Pending").trim();
    const salesperson = String(body?.salesperson || "").trim();
    const notes = String(body?.notes || "").trim();
    const groupRef = String(body?.groupRef || salesRefNo || `${Date.now()}`).trim();
    const paymentMethod = String(body?.paymentMethod || "").trim();
    const amountPaidPhp = toNumber(body?.amountPaidPhp);
    const transactionRef = String(body?.transactionRef || "").trim();
    const cashierName = String(body?.cashierName || "").trim();
    const saleStatus = String(body?.saleStatus || "Draft").trim();
    const normalizedSaleStatus = saleStatus.toLowerCase();
    const confirmedAt = normalizedSaleStatus === "confirmed"
      ? String(body?.confirmedAt || new Date().toISOString()).trim()
      : String(body?.confirmedAt || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!saleDate || !customerName || !items.length) {
      return NextResponse.json(
        { error: "Sale Date, Customer Name, and at least one product are required" },
        { status: 400 }
      );
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);

    const validItems = items.filter((item: any) =>
      String(item?.description || "").trim() &&
      String(item?.specification || "").trim() &&
      toNumber(item?.qty) > 0
    );

    if (!validItems.length) {
      return NextResponse.json(
        { error: "At least one valid product line is required" },
        { status: 400 }
      );
    }

    const transactionTotal = validItems.reduce((sum: number, item: any) => {
      const qty = toNumber(item?.qty);
      const unitPricePhp = toNumber(item?.unitPricePhp);
      return sum + (qty * unitPricePhp);
    }, 0);

    if (amountPaidPhp > transactionTotal) {
      return NextResponse.json(
        { error: "Amount Paid cannot be higher than Total Sale" },
        { status: 400 }
      );
    }

    if (normalizedSaleStatus === "confirmed") {
      if (!paymentMethod) {
        return NextResponse.json(
          { error: "Payment Method is required before confirming a sale" },
          { status: 400 }
        );
      }

      if (!cashierName) {
        return NextResponse.json(
          { error: "Cashier Name is required before confirming a sale" },
          { status: 400 }
        );
      }

      const stockError = await validateConfirmedStock(sheets, validItems);
      if (stockError) {
        return NextResponse.json({ error: stockError }, { status: 409 });
      }
    }

    const pricingMap = await getPricingMap(sheets);

    const rowsToAppend = validItems.map((item: any) => {
      const description = String(item?.description || "").trim();
      const specification = String(item?.specification || "").trim();
      const qty = toNumber(item?.qty);
      const unitPricePhp = toNumber(item?.unitPricePhp);

      const key = itemKey(description, specification);
      const costPricePhp = pricingMap.get(key) || 0;
      const totalSalePhp = qty * unitPricePhp;
      const totalCostPhp = qty * costPricePhp;
      const grossProfitPhp = totalSalePhp - totalCostPhp;
      const lineAmountPaidPhp = transactionTotal > 0
        ? amountPaidPhp * (totalSalePhp / transactionTotal)
        : 0;
      const lineBalancePhp = Math.max(totalSalePhp - lineAmountPaidPhp, 0);

      return [
        saleDate, salesRefNo, customerName, description, specification, qty,
        unitPricePhp, totalSalePhp, costPricePhp, totalCostPhp, grossProfitPhp,
        paymentStatus, salesperson, notes, groupRef,
        paymentMethod, lineAmountPaidPhp, lineBalancePhp, transactionRef,
        cashierName, saleStatus, confirmedAt,
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SALES_SHEET}!A:V`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rowsToAppend },
    });

    return NextResponse.json({ ok: true, lines: rowsToAppend.length });
  } catch (error: any) {
    console.error("SALES POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || String(error) || "Failed to save sale" },
      { status: 500 }
    );
  }
}
