import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES_SHEET = "Sales";
const INVENTORY_SHEET = "App_Deliveries";
const AUDIT_LOG_SHEET = "Audit_Log";
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function itemKey(description: string, specification: string) {
  return `${safeText(description)}|||${safeText(specification)}`;
}

function saleKey(salesRefNo: string, groupRef: string) {
  return safeText(groupRef) || safeText(salesRefNo);
}

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
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

function lineGrandTotal(row: string[]) {
  return toNumber(row[28] || row[7]);
}

function paymentStatusFromAmounts(paid: number, total: number) {
  const paidAmount = roundMoney(toNumber(paid));
  const totalAmount = roundMoney(toNumber(total));
  if (totalAmount > 0 && paidAmount + 0.009 >= totalAmount) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Pending";
}

function isValidSalesRow(row: string[]) {
  return Boolean(
    safeText(row[0]) &&
    safeText(row[2]) &&
    safeText(row[3]) &&
    safeText(row[4]) &&
    toNumber(row[5]) > 0 &&
    safeText(row[0]).toLowerCase() !== "date"
  );
}

function validateRequestedPaymentStatus(requestedStatus: string, requestedPaid: number, totalSale: number, paymentMethod: string) {
  const status = safeText(requestedStatus).toLowerCase();
  const method = safeText(paymentMethod).toLowerCase();
  const paid = roundMoney(requestedPaid);
  const total = roundMoney(totalSale);
  const balance = roundMoney(Math.max(total - paid, 0));

  if (!status) return "";
  if (!["pending", "partial", "paid"].includes(status)) return "Payment Status must be Pending, Partial, or Paid.";
  if (status === "pending" && paid > 0) return "Payment Status is Pending but paid amount is greater than zero. Use Partial or Paid.";
  if (status === "partial") {
    if (paid <= 0) return "Payment Status is Partial but paid amount is zero. Enter a partial amount or use Pending.";
    if (paid + 0.009 >= total) return "Payment Status is Partial but paid amount already covers the full total. Use Paid.";
    if (method === "cash") return "Partial payment cannot use plain Cash in Confirm Sales. Use Installment, Mixed Payment, Bank Transfer, GCash, Maya, Check, or Credit.";
  }
  if (status === "paid" && paid + 0.009 < total) return `Payment Status is Paid but paid amount is short by PHP ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Use Partial or enter the full paid amount.`;
  return "";
}

function isInactive(status: string) {
  return ["cancelled", "canceled", "voided"].includes(safeText(status).toLowerCase());
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

async function appendAuditLog(sheets: any, entry: { action: string; recordId: string; recordRef: string; actor: string; summary: string; before?: unknown; after?: unknown }) {
  await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[makeId("AUDIT"), new Date().toISOString(), "Sales", entry.action, entry.recordId, entry.recordRef, entry.actor, entry.summary, entry.before ? JSON.stringify(entry.before) : "", entry.after ? JSON.stringify(entry.after) : ""]] },
  });
}

async function readSalesRows(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
  return (response.data.values || []) as string[][];
}

async function getAvailableStockMap(sheets: any) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${INVENTORY_SHEET}!A:L` });
  const rows = (response.data.values || []) as string[][];
  const map = new Map<string, number>();

  rows.slice(1).forEach((row) => {
    const description = safeText(row[4]);
    const specification = safeText(row[5]);
    const qty = toNumber(row[6]);
    const status = safeText(row[9]).toLowerCase();
    if (!description && !specification) return;
    const key = itemKey(description, specification);
    const current = map.get(key) || 0;
    if (status === "available") map.set(key, current + qty);
    else if (["damaged", "defective", "damage"].includes(status)) map.set(key, current - qty);
  });

  return map;
}

function getConfirmedSoldMap(salesRows: string[][], saleIdBeingConfirmed: string, saleKeyBeingConfirmed: string) {
  const map = new Map<string, number>();
  salesRows.slice(1).filter(isValidSalesRow).forEach((row) => {
    const rowSaleId = safeText(row[22]);
    const rowKey = saleKey(row[1], row[14]);
    const saleStatus = safeText(row[20]).toLowerCase() || "draft";
    if (saleStatus !== "confirmed") return;
    if ((saleIdBeingConfirmed && rowSaleId === saleIdBeingConfirmed) || (saleKeyBeingConfirmed && rowKey === saleKeyBeingConfirmed)) return;
    const key = itemKey(row[3], row[4]);
    map.set(key, (map.get(key) || 0) + toNumber(row[5]));
  });
  return map;
}

function findTargetRows(salesRows: string[][], body: any) {
  const saleId = safeText(body?.saleId);
  const salesRefNo = safeText(body?.salesRefNo);
  const groupRef = safeText(body?.groupRef);
  const key = saleKey(salesRefNo, groupRef);

  return salesRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => {
    const rowSaleId = safeText(row[22]);
    const rowSalesRefNo = safeText(row[1]);
    const rowGroupRef = safeText(row[14]);
    const rowKey = saleKey(rowSalesRefNo, rowGroupRef);
    if (saleId && rowSaleId === saleId) return true;
    if (key && rowKey === key) return true;
    if (salesRefNo && rowSalesRefNo === salesRefNo) return true;
    if (groupRef && rowGroupRef === groupRef) return true;
    return false;
  });
}

function summarizeTarget(targetRows: Array<{ row: string[]; rowNumber: number }>) {
  const first = targetRows[0]?.row || [];
  const totalSale = roundMoney(targetRows.reduce((sum, item) => sum + lineGrandTotal(item.row), 0));
  const paid = roundMoney(targetRows.reduce((sum, item) => sum + toNumber(item.row[16]), 0));
  const balance = roundMoney(Math.max(totalSale - paid, 0));
  const saleStatus = safeText(first[20]) || "Draft";
  const paymentStatus = paymentStatusFromAmounts(paid, totalSale);
  const saleId = safeText(first[22]);
  const salesRefNo = safeText(first[1]);
  const groupRef = safeText(first[14]);

  return {
    saleId,
    salesRefNo,
    groupRef,
    key: saleKey(salesRefNo, groupRef),
    customerName: safeText(first[2]),
    totalSale,
    paid,
    balance,
    paymentStatus,
    paymentMethod: safeText(first[15]),
    transactionRef: safeText(first[18]),
    cashierName: safeText(first[19]),
    saleStatus,
    items: targetRows.map(({ row }) => ({ description: safeText(row[3]), specification: safeText(row[4]), qty: toNumber(row[5]) })),
  };
}

async function validateStock(sheets: any, salesRows: string[][], target: ReturnType<typeof summarizeTarget>) {
  const availableStockMap = await getAvailableStockMap(sheets);
  const confirmedSoldMap = getConfirmedSoldMap(salesRows, target.saleId, target.key);
  const requestedMap = new Map<string, { description: string; specification: string; qty: number }>();

  target.items.forEach((item) => {
    const key = itemKey(item.description, item.specification);
    const current = requestedMap.get(key);
    requestedMap.set(key, { ...item, qty: (current?.qty || 0) + item.qty });
  });

  const insufficient: string[] = [];
  requestedMap.forEach((item, key) => {
    const available = Math.max((availableStockMap.get(key) || 0) - (confirmedSoldMap.get(key) || 0), 0);
    if (item.qty > available) insufficient.push(`${item.description} / ${item.specification}: requested ${item.qty}, available ${available}`);
  });

  return insufficient.length ? `Insufficient confirmed stock. ${insufficient.join("; ")}` : "";
}

function clampPaid(totalPaid: number, totalSale: number) {
  return roundMoney(Math.min(Math.max(totalPaid, 0), totalSale));
}

function makePaymentUpdates(targetRows: Array<{ row: string[]; rowNumber: number }>, totalPaid: number, paymentMethod: string, transactionRef: string, cashierName: string) {
  const totalSale = roundMoney(targetRows.reduce((sum, item) => sum + lineGrandTotal(item.row), 0));
  const paidAmount = clampPaid(totalPaid, totalSale);
  const status = paymentStatusFromAmounts(paidAmount, totalSale);

  return targetRows.flatMap(({ row, rowNumber }, index) => {
    const lineTotal = lineGrandTotal(row);
    const lineShare = totalSale > 0 ? lineTotal / totalSale : 0;
    const previousLinesPaid = targetRows.slice(0, index).reduce((sum, item) => sum + roundMoney(paidAmount * (lineGrandTotal(item.row) / totalSale)), 0);
    const linePaid = index === targetRows.length - 1 ? roundMoney(paidAmount - previousLinesPaid) : roundMoney(paidAmount * lineShare);
    const lineBalance = roundMoney(Math.max(lineTotal - linePaid, 0));
    return [
      { range: `${SALES_SHEET}!L${rowNumber}`, values: [[status]] },
      { range: `${SALES_SHEET}!P${rowNumber}:T${rowNumber}`, values: [[paymentMethod, linePaid, lineBalance, transactionRef, cashierName]] },
    ];
  });
}

function makeVoidUpdates(targetRows: Array<{ row: string[]; rowNumber: number }>, actor: string) {
  return targetRows.flatMap(({ rowNumber }) => [
    { range: `${SALES_SHEET}!L${rowNumber}`, values: [["Cancelled"]] },
    { range: `${SALES_SHEET}!P${rowNumber}:T${rowNumber}`, values: [["Voided", 0, 0, "Voided from Confirm Sales", actor]] },
    { range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Cancelled", ""]] },
    { range: `${SALES_SHEET}!AI${rowNumber}:AJ${rowNumber}`, values: [[0, 0]] },
  ]);
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const action = safeText(body?.action || "confirm").toLowerCase();
    const actor = safeText(body?.actor || body?.cashierName || "System");

    if (!["confirm", "undo", "unconfirm", "update-payment", "void", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Unsupported sales action" }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, AUDIT_LOG_SHEET, AUDIT_HEADERS);
    const salesRows = await readSalesRows(sheets);
    const targetRows = findTargetRows(salesRows, body);
    if (!targetRows.length) return NextResponse.json({ error: "Sale was not found" }, { status: 404 });

    const target = summarizeTarget(targetRows);
    const normalizedSaleStatus = target.saleStatus.toLowerCase();

    if (action === "void" || action === "cancel") {
      if (isInactive(target.saleStatus)) return NextResponse.json({ ok: true, message: "Sale is already cancelled or voided", sale: target });
      const updateData = makeVoidUpdates(targetRows, actor);
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateData } });
      await appendAuditLog(sheets, {
        action: "VOID_SALE_PAYMENT",
        recordId: target.saleId || target.key,
        recordRef: target.salesRefNo || target.groupRef,
        actor,
        summary: `Voided sale and payment for ${target.salesRefNo || target.groupRef} with ${targetRows.length} line(s)`,
        before: { saleStatus: target.saleStatus, paymentStatus: target.paymentStatus, paid: target.paid, balance: target.balance, totalSale: target.totalSale },
        after: { saleStatus: "Cancelled", paymentStatus: "Cancelled", paid: 0, balance: 0, tendered: 0, change: 0 },
      });
      return NextResponse.json({ ok: true, message: "Sale and payment voided successfully.", sale: { ...target, saleStatus: "Cancelled", paymentStatus: "Cancelled", paid: 0, balance: 0 } });
    }

    if (action === "update-payment") {
      const requestedPaid = toNumber(body?.amountPaidPhp);
      const requestedStatus = safeText(body?.paymentStatus);
      const paymentMethod = safeText(body?.paymentMethod || target.paymentMethod);
      const transactionRef = safeText(body?.transactionRef || target.transactionRef);
      const cashierName = safeText(body?.cashierName || target.cashierName || actor);
      const ruleError = validateRequestedPaymentStatus(requestedStatus, requestedPaid, target.totalSale, paymentMethod);
      if (ruleError) return NextResponse.json({ error: `Payment procedure review: ${ruleError}` }, { status: 400 });
      const updateData = makePaymentUpdates(targetRows, requestedPaid, paymentMethod, transactionRef, cashierName);
      const finalPaid = clampPaid(requestedPaid, target.totalSale);
      const finalStatus = paymentStatusFromAmounts(finalPaid, target.totalSale);
      const finalBalance = roundMoney(Math.max(target.totalSale - finalPaid, 0));

      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateData } });
      await appendAuditLog(sheets, {
        action: "UPDATE_SALE_PAYMENT",
        recordId: target.saleId || target.key,
        recordRef: target.salesRefNo || target.groupRef,
        actor,
        summary: `Updated payment for sale ${target.salesRefNo || target.groupRef} to ${finalStatus}`,
        before: { paymentStatus: target.paymentStatus, paid: target.paid, balance: target.balance, paymentMethod: target.paymentMethod },
        after: { paymentStatus: finalStatus, paid: finalPaid, balance: finalBalance, paymentMethod, transactionRef, cashierName },
      });

      return NextResponse.json({ ok: true, message: `Payment updated to ${finalStatus}.`, sale: { ...target, paymentStatus: finalStatus, paid: finalPaid, balance: finalBalance, paymentMethod, transactionRef, cashierName } });
    }

    if (action === "undo" || action === "unconfirm") {
      if (normalizedSaleStatus !== "confirmed") return NextResponse.json({ ok: true, message: "Sale is not confirmed, no undo needed", sale: target });
      const updateData = targetRows.map(({ rowNumber }) => ({ range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Draft", ""]] }));
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateData } });
      await appendAuditLog(sheets, {
        action: "UNDO_CONFIRM_SALE",
        recordId: target.saleId || target.key,
        recordRef: target.salesRefNo || target.groupRef,
        actor,
        summary: `Undid confirmation for sale ${target.salesRefNo || target.groupRef} with ${targetRows.length} line(s)`,
        before: { saleStatus: target.saleStatus, paymentStatus: target.paymentStatus, balance: target.balance },
        after: { saleStatus: "Draft", confirmedAt: "", paymentStatus: target.paymentStatus, balance: target.balance },
      });
      return NextResponse.json({ ok: true, message: "Sale confirmation undone successfully", sale: { ...target, saleStatus: "Draft", confirmedAt: "" } });
    }

    if (normalizedSaleStatus === "confirmed") return NextResponse.json({ ok: true, message: "Sale is already confirmed", sale: target });
    if (isInactive(normalizedSaleStatus)) return NextResponse.json({ error: "Cancelled or voided sales cannot be confirmed" }, { status: 400 });

    const stockError = await validateStock(sheets, salesRows, target);
    if (stockError) return NextResponse.json({ error: stockError }, { status: 409 });

    const confirmedAt = new Date().toISOString();
    const finalPaid = clampPaid(target.paid, target.totalSale);
    const finalPaymentStatus = paymentStatusFromAmounts(finalPaid, target.totalSale);
    const finalBalance = roundMoney(Math.max(target.totalSale - finalPaid, 0));
    const updateData = targetRows.map(({ rowNumber }) => ({ range: `${SALES_SHEET}!U${rowNumber}:V${rowNumber}`, values: [["Confirmed", confirmedAt]] }));

    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: updateData } });
    await appendAuditLog(sheets, {
      action: "CONFIRM_SALE",
      recordId: target.saleId || target.key,
      recordRef: target.salesRefNo || target.groupRef,
      actor,
      summary: `Confirmed sale ${target.salesRefNo || target.groupRef} with payment ${finalPaymentStatus} and balance ${finalBalance}`,
      before: { saleStatus: target.saleStatus, paymentStatus: target.paymentStatus, balance: target.balance, paid: target.paid, totalSale: target.totalSale },
      after: { saleStatus: "Confirmed", confirmedAt, paymentStatus: finalPaymentStatus, balance: finalBalance, paid: finalPaid, totalSale: target.totalSale, paymentMethod: target.paymentMethod, transactionRef: target.transactionRef, cashierName: target.cashierName },
    });

    return NextResponse.json({
      ok: true,
      message: `Sale confirmed successfully. Payment status ${finalPaymentStatus}.`,
      confirmedAt,
      sale: { ...target, saleStatus: "Confirmed", confirmedAt, paymentStatus: finalPaymentStatus, paid: finalPaid, balance: finalBalance },
    });
  } catch (error: any) {
    console.error("CONFIRM SALE ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to update sale confirmation" }, { status: 500 });
  }
}
