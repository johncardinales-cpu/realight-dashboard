import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const EXPENSES_SHEET = "Expenses";
const SUPPLIER_COSTS_SHEET = "Supplier_Invoice_Costs";
const AUDIT_LOG_SHEET = "Audit_Log";
const SALES_SHEET = "Sales";

const EXPENSE_HEADERS = ["Expense Date", "Category", "Description", "Base Amount", "Tax / VAT / Fee", "Total Amount", "Payment Method", "Reference No.", "Related Sales Ref No.", "Payee", "Notes", "Created At", "Expense ID", "Customer / Expense For", "Expense Payment Status", "Amount Paid", "Balance Amount"];
const SUPPLIER_HEADERS = ["Upload Date", "Supplier", "Batch / Reference", "Invoice No.", "Invoice Valid", "Product Subtotal", "Freight Cost", "Delivery Cost", "Customs Cost", "Other Cost", "Total Invoice Cost", "Notes"];
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function toNumber(value: string | number | undefined) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeDate(value: unknown) {
  const raw = safeText(value);
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

function normalizeRef(value: unknown) {
  return safeText(value).toLowerCase();
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

function paymentStatusFromAmounts(totalAmount: number, amountPaid: number, preferredStatus = "") {
  const status = safeText(preferredStatus).toLowerCase();
  const total = round(totalAmount);
  const paid = round(amountPaid);
  const balance = round(Math.max(total - paid, 0));
  if (status === "pending") return "Pending";
  if (status === "installment") return balance > 0 ? "Installment" : "Paid";
  if (paid <= 0 && total > 0) return "Pending";
  if (balance > 0) return "Installment";
  return "Paid";
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
    requestBody: { values: [[makeId("AUDIT"), new Date().toISOString(), entry.module, entry.action, entry.recordId, entry.recordRef, entry.actor || "Admin", entry.summary, entry.before ? JSON.stringify(entry.before) : "", entry.after ? JSON.stringify(entry.after) : ""]] },
  });
}

async function getSalesRefSet(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AH` }).catch(() => ({ data: { values: [] } }));
  const rows = (response.data.values || []) as string[][];
  const refs = new Set<string>();
  rows.slice(1).forEach((row) => {
    const salesRefNo = normalizeRef(row[1]);
    const groupRef = normalizeRef(row[14]);
    const saleId = normalizeRef(row[22]);
    if (salesRefNo) refs.add(salesRefNo);
    if (groupRef) refs.add(groupRef);
    if (saleId) refs.add(saleId);
  });
  return refs;
}

function parseExpenseRow(row: string[], header: string[]) {
  const map: Record<string, string> = {};
  header.forEach((h, i) => { map[safeText(h)] = safeText(row[i]); });
  const date = normalizeDate(map["Expense Date"] || map["Date"] || map["Upload Date"] || map["Created At"] || "");
  const category = map["Category"] || "General Expense";
  const description = map["Description"] || map["Expense"] || "";
  const legacyAmount = toNumber(map["Amount"] || map["Total"] || map["Expense Amount"]);
  const baseAmount = toNumber(map["Base Amount"] || map["Base"] || map["Subtotal"]) || legacyAmount;
  const taxFee = toNumber(map["Tax / VAT / Fee"] || map["Tax"] || map["VAT"] || map["Fee"]);
  const totalAmount = toNumber(map["Total Amount"] || map["Amount"] || map["Total"] || map["Expense Amount"]) || (baseAmount + taxFee);
  const reference = map["Reference No."] || map["Reference"] || "";
  const notes = map["Notes"] || "";
  const paymentMethod = map["Payment Method"] || "";
  const relatedSalesRefNo = map["Related Sales Ref No."] || "";
  const payee = map["Payee"] || "";
  const customerName = map["Customer / Expense For"] || map["Customer"] || map["Expense For"] || "";
  const expenseId = map["Expense ID"] || "";
  const hasPaymentColumns = Boolean(map["Expense Payment Status"] || map["Payment Status"] || map["Amount Paid"] || map["Balance Amount"] || map["Balance"]);
  const amountPaid = hasPaymentColumns ? toNumber(map["Amount Paid"] || map["Paid Amount"]) : totalAmount;
  const balanceAmount = hasPaymentColumns ? (toNumber(map["Balance Amount"] || map["Balance"]) || Math.max(totalAmount - amountPaid, 0)) : 0;
  const expensePaymentStatus = hasPaymentColumns ? paymentStatusFromAmounts(totalAmount, amountPaid, map["Expense Payment Status"] || map["Payment Status"]) : "Paid";
  if (!date && !description && !totalAmount) return null;
  return { Date: date, Category: category, Description: description, BaseAmount: baseAmount, TaxFee: taxFee, Amount: totalAmount, PaymentMethod: paymentMethod, Reference: reference, RelatedSalesRefNo: relatedSalesRefNo, CustomerName: customerName, Payee: payee, ExpensePaymentStatus: expensePaymentStatus, AmountPaid: round(amountPaid), BalanceAmount: round(balanceAmount), Source: "Expenses", Notes: notes, ExpenseID: expenseId };
}

function parseSupplierRow(row: string[]) {
  const date = normalizeDate(row[0]);
  const supplier = safeText(row[1]);
  const batchReference = safeText(row[2]);
  const invoiceNo = safeText(row[3]);
  const productSubtotal = toNumber(row[5]);
  const freightCost = toNumber(row[6]);
  const deliveryCost = toNumber(row[7]);
  const customsCost = toNumber(row[8]);
  const otherCost = toNumber(row[9]);
  const totalInvoiceCost = toNumber(row[10]);
  const notes = safeText(row[11]);
  const taxFee = customsCost + otherCost;
  const baseAmount = productSubtotal + freightCost + deliveryCost;
  if (!date && !supplier && !totalInvoiceCost) return null;
  return { Date: date, Category: "Supplier Invoice Cost", Description: supplier, BaseAmount: baseAmount || totalInvoiceCost, TaxFee: taxFee, Amount: totalInvoiceCost, PaymentMethod: "", Reference: invoiceNo || batchReference, RelatedSalesRefNo: "", CustomerName: "", Payee: supplier, ExpensePaymentStatus: "Paid", AmountPaid: totalInvoiceCost, BalanceAmount: 0, Source: "Supplier_Invoice_Costs", Notes: notes, ExpenseID: "" };
}

async function ensureSupplierSheetExists(sheets: any) {
  await ensureSheetExists(sheets, SUPPLIER_COSTS_SHEET, SUPPLIER_HEADERS);
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, EXPENSES_SHEET, EXPENSE_HEADERS);
    await ensureSupplierSheetExists(sheets);
    const [expensesRes, supplierRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${EXPENSES_SHEET}!A:Q` }).catch(() => ({ data: { values: [] } })),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SUPPLIER_COSTS_SHEET}!A:L` }),
    ]);
    const expenseRows = expensesRes.data.values || [];
    const supplierRows = supplierRes.data.values || [];
    let items: any[] = [];
    if (expenseRows.length) {
      const header = expenseRows[0].map(safeText);
      items.push(...expenseRows.slice(1).map((row) => parseExpenseRow(row, header)).filter(Boolean) as any);
    }
    if (supplierRows.length) items.push(...supplierRows.slice(1).map(parseSupplierRow).filter(Boolean) as any);
    items = items.sort((a, b) => new Date(b.Date || "1900-01-01").getTime() - new Date(a.Date || "1900-01-01").getTime());
    const totalAmount = items.reduce((sum, item) => sum + item.Amount, 0);
    const totalTaxFee = items.reduce((sum, item) => sum + (Number(item.TaxFee) || 0), 0);
    const totalBaseAmount = items.reduce((sum, item) => sum + (Number(item.BaseAmount) || 0), 0);
    const totalPaid = items.reduce((sum, item) => sum + (Number(item.AmountPaid) || 0), 0);
    const totalBalance = items.reduce((sum, item) => sum + (Number(item.BalanceAmount) || 0), 0);
    return NextResponse.json({ rows: items, totalAmount, totalTaxFee, totalBaseAmount, totalPaid, totalBalance });
  } catch (error: any) {
    console.error("EXPENSES API ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expenseDate = normalizeDate(body?.expenseDate || new Date().toISOString().slice(0, 10));
    const category = safeText(body?.category || "Miscellaneous");
    const description = safeText(body?.description);
    const baseAmount = toNumber(body?.baseAmount ?? body?.amount);
    const taxFee = toNumber(body?.taxFee);
    const totalAmount = toNumber(body?.totalAmount) || (baseAmount + taxFee);
    const paymentMethod = safeText(body?.paymentMethod);
    const referenceNo = safeText(body?.referenceNo);
    const relatedSalesRefNo = safeText(body?.relatedSalesRefNo);
    const payee = safeText(body?.payee);
    const customerName = safeText(body?.customerName || body?.expenseFor);
    const requestedPaymentStatus = safeText(body?.expensePaymentStatus || body?.paymentStatus || "Paid");
    const amountPaid = requestedPaymentStatus.toLowerCase() === "paid" ? totalAmount : requestedPaymentStatus.toLowerCase() === "pending" ? 0 : Math.min(toNumber(body?.amountPaid ?? body?.amountPaidPhp), totalAmount);
    const balanceAmount = round(Math.max(totalAmount - amountPaid, 0));
    const expensePaymentStatus = paymentStatusFromAmounts(totalAmount, amountPaid, requestedPaymentStatus);
    const notes = safeText(body?.notes);
    const actor = safeText(body?.actor || "Admin");
    if (!expenseDate) return NextResponse.json({ error: "Expense Date is required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    if (totalAmount <= 0) return NextResponse.json({ error: "Total Amount must be greater than zero" }, { status: 400 });
    if (expensePaymentStatus === "Installment" && amountPaid <= 0) return NextResponse.json({ error: "Installment expense needs an initial amount paid" }, { status: 400 });
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, EXPENSES_SHEET, EXPENSE_HEADERS);
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    if (relatedSalesRefNo) {
      const refs = await getSalesRefSet(sheets);
      if (!refs.has(normalizeRef(relatedSalesRefNo))) return NextResponse.json({ error: `Related Sales Ref No. was not found in Sales: ${relatedSalesRefNo}` }, { status: 400 });
    }
    const createdAt = new Date().toISOString();
    const expenseId = makeId("EXP");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${EXPENSES_SHEET}!A:Q`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[expenseDate, category, description, baseAmount, taxFee, totalAmount, paymentMethod, referenceNo, relatedSalesRefNo, payee, notes, createdAt, expenseId, customerName, expensePaymentStatus, amountPaid, balanceAmount]] },
    });
    await appendAuditLog(sheets, {
      module: "Expenses",
      action: "CREATE_EXPENSE",
      recordId: expenseId,
      recordRef: referenceNo || relatedSalesRefNo || category,
      actor,
      summary: `Recorded ${expensePaymentStatus.toLowerCase()} expense ${totalAmount} for ${customerName ? `${customerName} / ` : ""}${category}: ${description}${balanceAmount ? ` with balance ${balanceAmount}` : ""}${relatedSalesRefNo ? ` linked to sale ${relatedSalesRefNo}` : ""}`,
      after: { expenseId, expenseDate, category, description, baseAmount, taxFee, totalAmount, paymentMethod, referenceNo, relatedSalesRefNo, customerName, payee, expensePaymentStatus, amountPaid, balanceAmount, notes },
    });
    return NextResponse.json({ ok: true, expenseId, baseAmount, taxFee, totalAmount, customerName, expensePaymentStatus, amountPaid, balanceAmount });
  } catch (error: any) {
    console.error("EXPENSES POST ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to save expense" }, { status: 500 });
  }
}
