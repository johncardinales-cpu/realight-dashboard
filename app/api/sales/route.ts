import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const PRICING_SHEET = "Pricing_Base";
const INVENTORY_SHEET = "App_Deliveries";
const AUDIT_LOG_SHEET = "Audit_Log";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SALES_HEADERS = [
  "Sale Date", "Sales Ref No.", "Customer Name", "Description", "Specification", "Qty",
  "Manual Unit Price (PHP)", "Total Sale (PHP)", "Cost Price (PHP)", "Total Cost (PHP)",
  "Gross Profit (PHP)", "Payment Status", "Salesperson", "Notes", "Group Ref",
  "Payment Method", "Amount Paid (PHP)", "Balance (PHP)", "Transaction Ref",
  "Cashier Name", "Sale Status", "Confirmed At", "Sale ID", "Sale Item ID", "Created At",
  "Product Subtotal (PHP)", "Tax Rate (%)", "Tax Amount (PHP)", "Grand Total (PHP)",
  "Delivery Fee (PHP)", "Installation Fee (PHP)", "Other Charge (PHP)", "Discount (PHP)",
  "Customer ID", "Tendered Amount (PHP)", "Change Due (PHP)",
];

const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function itemKey(description: string, specification: string) {
  return `${String(description || "").trim()}|||${String(specification || "").trim()}`;
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

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
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
  return qty > 0;
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (meta.data.sheets || []).find((s: any) => s.properties?.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1:${columnLetter(headers.length)}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
}

async function appendAuditLog(sheets: any, entry: { module: string; action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[makeId("AUDIT"), new Date().toISOString(), entry.module, entry.action, entry.recordId, entry.recordRef, entry.actor, entry.summary, entry.before ? JSON.stringify(entry.before) : "", entry.after ? JSON.stringify(entry.after) : ""]],
    },
  });
}

async function getPricingMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${PRICING_SHEET}!A:N` });
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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${INVENTORY_SHEET}!A:L` });
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
    if (status === "available") map.set(key, current + qty);
    else if (["damaged", "defective", "damage"].includes(status)) map.set(key, current - qty);
  });
  return map;
}

async function getConfirmedSoldMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();
  rows.slice(1).filter(isValidSalesRow).forEach((row: string[]) => {
    const saleStatus = String(row[20] || "Draft").trim().toLowerCase();
    if (saleStatus !== "confirmed") return;
    const key = itemKey(String(row[3] || ""), String(row[4] || ""));
    map.set(key, (map.get(key) || 0) + toNumber(row[5]));
  });
  return map;
}

function getRequestedQtyMap(items: any[]) {
  const map = new Map<string, { description: string; specification: string; qty: number }>();
  items.forEach((item: any) => {
    const description = String(item?.description || "").trim();
    const specification = String(item?.specification || "").trim();
    const qty = toNumber(item?.qty);
    if (!description || !specification || qty <= 0) return;
    const key = itemKey(description, specification);
    const current = map.get(key);
    map.set(key, { description, specification, qty: (current?.qty || 0) + qty });
  });
  return map;
}

async function validateAvailableStock(sheets: any, items: any[]) {
  const [availableStockMap, confirmedSoldMap] = await Promise.all([getAvailableStockMap(sheets), getConfirmedSoldMap(sheets)]);
  const requestedQtyMap = getRequestedQtyMap(items);
  const insufficientItems: string[] = [];
  requestedQtyMap.forEach(({ description, specification, qty }, key) => {
    const availableQty = Math.max((availableStockMap.get(key) || 0) - (confirmedSoldMap.get(key) || 0), 0);
    if (qty > availableQty) insufficientItems.push(`${description} / ${specification}: requested ${qty}, available ${availableQty}`);
  });
  return insufficientItems.length ? `Low stock blocked. ${insufficientItems.join("; ")}` : "";
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
    const rows = (response.data.values || []) as string[][];
    const data = rows.slice(1).filter(isValidSalesRow);
    const items = data.map((row: string[], index: number) => ({
      rowNumber: index + 2,
      saleDate: normalizeDate(row[0]),
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
      confirmedAt: normalizeDate(row[21]),
      saleId: String(row[22] || ""),
      saleItemId: String(row[23] || ""),
      createdAt: normalizeDate(row[24]),
      productSubtotalPhp: toNumber(row[25] || row[7]),
      taxRatePct: toNumber(row[26]),
      taxAmountPhp: toNumber(row[27]),
      grandTotalPhp: toNumber(row[28] || row[7]),
      deliveryFeePhp: toNumber(row[29]),
      installationFeePhp: toNumber(row[30]),
      otherChargePhp: toNumber(row[31]),
      discountPhp: toNumber(row[32]),
      customerId: String(row[33] || ""),
      tenderedAmountPhp: toNumber(row[34] || row[16]),
      changeDuePhp: toNumber(row[35]),
    }));
    return NextResponse.json(items);
  } catch (error: any) {
    console.error("SALES GET ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saleDate = String(body?.saleDate || "").trim();
    const salesRefNo = String(body?.salesRefNo || "").trim();
    const customerId = String(body?.customerId || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const paymentStatus = String(body?.paymentStatus || "Pending").trim();
    const salesperson = String(body?.salesperson || "").trim();
    const notes = String(body?.notes || "").trim();
    const groupRef = String(body?.groupRef || salesRefNo || `${Date.now()}`).trim();
    const paymentMethod = String(body?.paymentMethod || "").trim();
    const tenderedAmountPhp = Math.max(toNumber(body?.amountPaidPhp), 0);
    const transactionRef = String(body?.transactionRef || "").trim();
    const cashierName = String(body?.cashierName || "").trim();
    const saleStatus = String(body?.saleStatus || "Draft").trim();
    const normalizedSaleStatus = saleStatus.toLowerCase();
    const createdAt = new Date().toISOString();
    const confirmedAt = normalizedSaleStatus === "confirmed" ? String(body?.confirmedAt || createdAt).trim() : String(body?.confirmedAt || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!saleDate || !customerName || !items.length) return NextResponse.json({ error: "Sale Date, Customer Name, and at least one product are required" }, { status: 400 });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    await ensureSheetExists(sheets, SALES_SHEET, SALES_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);

    const validItems = items.filter((item: any) => String(item?.description || "").trim() && String(item?.specification || "").trim() && toNumber(item?.qty) > 0);
    if (!validItems.length) return NextResponse.json({ error: "At least one valid product line is required" }, { status: 400 });

    const stockError = await validateAvailableStock(sheets, validItems);
    if (stockError) return NextResponse.json({ error: stockError }, { status: 409 });

    if (normalizedSaleStatus === "confirmed") {
      if (!paymentMethod) return NextResponse.json({ error: "Payment Method is required before confirming a sale" }, { status: 400 });
      if (!cashierName) return NextResponse.json({ error: "Cashier Name is required before confirming a sale" }, { status: 400 });
    }

    const productSubtotalPhp = roundMoney(validItems.reduce((sum: number, item: any) => sum + (toNumber(item?.qty) * toNumber(item?.unitPricePhp)), 0));
    const deliveryFeePhp = Math.max(toNumber(body?.deliveryFeePhp), 0);
    const installationFeePhp = Math.max(toNumber(body?.installationFeePhp), 0);
    const otherChargePhp = Math.max(toNumber(body?.otherChargePhp), 0);
    const discountPhp = Math.max(toNumber(body?.discountPhp), 0);
    const taxableBasePhp = roundMoney(Math.max(productSubtotalPhp + deliveryFeePhp + installationFeePhp + otherChargePhp - discountPhp, 0));
    const taxRatePct = Math.max(toNumber(body?.taxRatePct), 0);
    const requestedTaxAmountPhp = toNumber(body?.taxAmountPhp);
    const taxAmountPhp = roundMoney(requestedTaxAmountPhp > 0 ? requestedTaxAmountPhp : taxableBasePhp * (taxRatePct / 100));
    const transactionTotal = roundMoney(taxableBasePhp + taxAmountPhp);
    const amountPaidPhp = roundMoney(Math.min(tenderedAmountPhp, transactionTotal));
    const changeDuePhp = roundMoney(Math.max(tenderedAmountPhp - transactionTotal, 0));
    const pricingMap = await getPricingMap(sheets);
    const saleId = makeId("SALE");

    const rowsToAppend = validItems.map((item: any, index: number) => {
      const description = String(item?.description || "").trim();
      const specification = String(item?.specification || "").trim();
      const qty = toNumber(item?.qty);
      const unitPricePhp = toNumber(item?.unitPricePhp);
      const key = itemKey(description, specification);
      const costPricePhp = pricingMap.get(key) || 0;
      const lineProductSubtotalPhp = roundMoney(qty * unitPricePhp);
      const lineShare = productSubtotalPhp > 0 ? lineProductSubtotalPhp / productSubtotalPhp : 0;
      const lineDeliveryFeePhp = roundMoney(deliveryFeePhp * lineShare);
      const lineInstallationFeePhp = roundMoney(installationFeePhp * lineShare);
      const lineOtherChargePhp = roundMoney(otherChargePhp * lineShare);
      const lineDiscountPhp = roundMoney(discountPhp * lineShare);
      const lineTaxableBasePhp = roundMoney(Math.max(lineProductSubtotalPhp + lineDeliveryFeePhp + lineInstallationFeePhp + lineOtherChargePhp - lineDiscountPhp, 0));
      const lineTaxAmountPhp = roundMoney(taxAmountPhp * lineShare);
      const lineGrandTotalPhp = roundMoney(lineTaxableBasePhp + lineTaxAmountPhp);
      const totalCostPhp = roundMoney(qty * costPricePhp);
      const grossProfitPhp = roundMoney(lineGrandTotalPhp - totalCostPhp);
      const lineAmountPaidPhp = transactionTotal > 0 ? roundMoney(amountPaidPhp * (lineGrandTotalPhp / transactionTotal)) : 0;
      const lineTenderedAmountPhp = transactionTotal > 0 ? roundMoney(tenderedAmountPhp * (lineGrandTotalPhp / transactionTotal)) : tenderedAmountPhp;
      const lineChangeDuePhp = transactionTotal > 0 ? roundMoney(changeDuePhp * (lineGrandTotalPhp / transactionTotal)) : changeDuePhp;
      const lineBalancePhp = roundMoney(Math.max(lineGrandTotalPhp - lineAmountPaidPhp, 0));
      const saleItemId = `${saleId}_ITEM_${String(index + 1).padStart(3, "0")}`;
      return [saleDate, salesRefNo, customerName, description, specification, qty, unitPricePhp, lineGrandTotalPhp, costPricePhp, totalCostPhp, grossProfitPhp, paymentStatus, salesperson, notes, groupRef, paymentMethod, lineAmountPaidPhp, lineBalancePhp, transactionRef, cashierName, saleStatus, confirmedAt, saleId, saleItemId, createdAt, lineProductSubtotalPhp, taxRatePct, lineTaxAmountPhp, lineGrandTotalPhp, lineDeliveryFeePhp, lineInstallationFeePhp, lineOtherChargePhp, lineDiscountPhp, customerId, lineTenderedAmountPhp, lineChangeDuePhp];
    });

    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: rowsToAppend } });
    await appendAuditLog(sheets, {
      module: "Sales",
      action: "CREATE_SALE",
      recordId: saleId,
      recordRef: salesRefNo || groupRef,
      actor: cashierName || salesperson || "System",
      summary: `Created sale with ${rowsToAppend.length} line(s), subtotal ${productSubtotalPhp}, delivery ${deliveryFeePhp}, installation ${installationFeePhp}, tax ${taxAmountPhp}, grand total ${transactionTotal}, tendered ${tenderedAmountPhp}, collected ${amountPaidPhp}, change ${changeDuePhp}`,
      after: { saleId, salesRefNo, groupRef, customerId, customerName, productSubtotalPhp, deliveryFeePhp, installationFeePhp, otherChargePhp, discountPhp, taxRatePct, taxAmountPhp, transactionTotal, tenderedAmountPhp, amountPaidPhp, changeDuePhp, paymentStatus, saleStatus, itemCount: rowsToAppend.length },
    });

    return NextResponse.json({ ok: true, lines: rowsToAppend.length, saleId, customerId, productSubtotalPhp, deliveryFeePhp, installationFeePhp, otherChargePhp, discountPhp, taxRatePct, taxAmountPhp, grandTotalPhp: transactionTotal, amountPaidPhp, tenderedAmountPhp, changeDuePhp });
  } catch (error: any) {
    console.error("SALES POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save sale" }, { status: 500 });
  }
}
