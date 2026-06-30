import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES = "Sales!A:AJ";
const PAYMENTS = "Payments!A:O";
const INVENTORY = "App_Deliveries!A:L";
const EXPENSES = "Expenses!A:Z";
const CREDITS = "Customer_Credits!A:L";

const txt = (value: unknown) => String(value || "").trim();
const num = (value: unknown) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const norm = (value: unknown) => txt(value).toLowerCase().replace(/\s+/g, " ");
const inactive = (value: unknown) => ["voided", "cancelled", "canceled"].includes(norm(value));
const confirmed = (value: unknown) => norm(value) === "confirmed";
const uniq = (values: string[]) => Array.from(new Set(values.map(txt).filter(Boolean)));
const saleKey = (salesRefNo: string, groupRef: string, saleId?: string) => txt(saleId) || txt(groupRef) || txt(salesRefNo);

function money(value: number) {
  return `PHP ${round(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normDate(value: unknown) {
  const raw = txt(value);
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
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function statusFrom(total: number, paid: number) {
  if (paid <= 0) return "Pending";
  if (paid + 0.009 >= total) return "Paid";
  return "Partial";
}

async function readRanges() {
  const sheets = await getSheetsClient();
  const ranges = [SALES, PAYMENTS, INVENTORY, EXPENSES, CREDITS];
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges });
  return ranges.map((_, index) => (res.data.valueRanges?.[index]?.values || []) as string[][]);
}

function keysForPayment(row: string[]) {
  return uniq([saleKey(row[1], row[2], row[11]), txt(row[11]), txt(row[2]), txt(row[1])]);
}

function buildPaymentMap(paymentRows: string[][]) {
  const map = new Map<string, { amount: number; count: number; refs: string[] }>();
  paymentRows.slice(1).forEach((row) => {
    if (inactive(row[12])) return;
    const amount = num(row[5]);
    if (amount <= 0) return;
    keysForPayment(row).forEach((key) => {
      const current = map.get(key) || { amount: 0, count: 0, refs: [] };
      current.amount = round(current.amount + amount);
      current.count += 1;
      if (txt(row[6])) current.refs.push(txt(row[6]));
      map.set(key, current);
    });
  });
  return map;
}

function firstPayment(map: Map<string, { amount: number; count: number; refs: string[] }>, keys: string[]) {
  for (const key of uniq(keys)) {
    const value = map.get(key);
    if (value) return value;
  }
  return { amount: 0, count: 0, refs: [] };
}

function parseSales(salesRows: string[][], paymentRows: string[][]) {
  const paymentMap = buildPaymentMap(paymentRows);
  const grouped = new Map<string, any>();

  salesRows.slice(1).forEach((row) => {
    const saleStatus = txt(row[20]) || "Draft";
    const paymentStatus = txt(row[11]) || "Pending";
    if (!confirmed(saleStatus) || inactive(saleStatus) || inactive(paymentStatus)) return;
    const salesRefNo = txt(row[1]);
    const groupRef = txt(row[14]);
    const saleId = txt(row[22]);
    const key = saleKey(salesRefNo, groupRef, saleId);
    const total = num(row[28] || row[7]);
    const customerName = txt(row[2]);
    if (!key || !customerName || total <= 0) return;

    const current = grouped.get(key) || {
      key,
      salesRefNo,
      groupRef,
      saleId,
      saleDate: normDate(row[0]),
      customerName,
      customerId: txt(row[33]),
      description: txt(row[3]),
      specification: txt(row[4]),
      qty: 0,
      totalSalePhp: 0,
      grossProfitPhp: 0,
      salesPaidPhp: 0,
      salesBalancePhp: 0,
      rowCount: 0,
      saleStatus,
    };
    current.qty += num(row[5]);
    current.totalSalePhp = round(current.totalSalePhp + total);
    current.grossProfitPhp = round(current.grossProfitPhp + num(row[10]));
    current.salesPaidPhp = round(current.salesPaidPhp + num(row[16]));
    current.salesBalancePhp = round(current.salesBalancePhp + num(row[17]));
    current.rowCount += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((sale) => {
    const payment = firstPayment(paymentMap, [sale.saleId, sale.groupRef, sale.salesRefNo, sale.key]);
    const paidByBalance = round(Math.max(sale.totalSalePhp - Math.max(sale.salesBalancePhp, 0), 0));
    const reconciledPaidPhp = round(Math.min(Math.max(sale.salesPaidPhp, payment.amount, paidByBalance), sale.totalSalePhp));
    const reconciledBalancePhp = round(Math.max(sale.totalSalePhp - reconciledPaidPhp, 0));
    const doubleCountedPaidPhp = round(sale.salesPaidPhp + payment.amount);
    return {
      ...sale,
      paymentLedgerPaidPhp: payment.amount,
      paymentLedgerCount: payment.count,
      reconciledPaidPhp,
      reconciledBalancePhp,
      doubleCountedPaidPhp,
      reconciledStatus: statusFrom(sale.totalSalePhp, reconciledPaidPhp),
      doubleCountRisk: sale.salesPaidPhp > 0 && payment.amount > 0 && doubleCountedPaidPhp > sale.totalSalePhp + 0.009,
    };
  });
}

function parseCredits(rows: string[][]) {
  return rows.slice(1).map((row) => ({
    creditDate: normDate(row[0]),
    customerName: txt(row[1]),
    customerId: txt(row[2]),
    creditAmountPhp: num(row[3]),
    status: txt(row[11]) || "Open",
  })).filter((row) => row.customerName && row.creditAmountPhp > 0 && norm(row.status) === "open");
}

function parseExpenses(rows: string[][]) {
  const header = rows[0]?.map(txt) || [];
  return rows.slice(1).map((row) => {
    const map: Record<string, string> = {};
    header.forEach((head, index) => { map[head] = txt(row[index]); });
    return {
      date: normDate(map["Expense Date"] || map.Date || map["Upload Date"]),
      category: map.Category || "General Expense",
      amount: num(map["Total Amount"] || map.Amount || map.Total || map["Expense Amount"]),
      balanceAmount: num(map["Balance Amount"] || map.Balance),
      status: map["Expense Payment Status"] || map["Payment Status"] || "Paid",
      customerName: map["Customer / Expense For"] || map.Customer || "",
    };
  }).filter((row) => row.date || row.amount > 0);
}

function inventoryAudit(salesRows: string[][], inventoryRows: string[][]) {
  const stock = new Map<string, any>();
  inventoryRows.slice(1).forEach((row) => {
    const description = txt(row[4]);
    const specification = txt(row[5]);
    const qty = num(row[6]);
    const status = norm(row[9]);
    if (!description && !specification) return;
    const key = `${description}|||${specification}`;
    const current = stock.get(key) || { description, specification, availableQty: 0, damagedQty: 0 };
    if (status === "available") current.availableQty += qty;
    if (["damaged", "damage", "defective"].includes(status)) current.damagedQty += qty;
    stock.set(key, current);
  });

  const sold = new Map<string, number>();
  salesRows.slice(1).forEach((row) => {
    if (!confirmed(row[20]) || inactive(row[20]) || inactive(row[11])) return;
    const qty = num(row[5]);
    if (qty <= 0) return;
    const description = txt(row[3]);
    const specification = txt(row[4]);
    const key = `${description}|||${specification}`;
    sold.set(key, round((sold.get(key) || 0) + qty));
  });

  return Array.from(stock.entries()).map(([key, item]) => {
    const soldQty = sold.get(key) || 0;
    const remainingQty = round(Math.max(item.availableQty - item.damagedQty - soldQty, 0));
    return { ...item, soldQty, remainingQty, status: soldQty > item.availableQty - item.damagedQty ? "Critical" : "Balanced" };
  }).sort((a, b) => b.soldQty - a.soldQty);
}

export async function GET() {
  try {
    const [salesRows, paymentRows, inventoryRows, expenseRows, creditRows] = await readRanges();
    const sales = parseSales(salesRows, paymentRows);
    const credits = parseCredits(creditRows);
    const expenses = parseExpenses(expenseRows);
    const inventory = inventoryAudit(salesRows, inventoryRows);

    const issues: Array<{ severity: "critical" | "warning" | "info"; area: string; record: string; message: string; expected?: string; actual?: string }> = [];

    sales.forEach((sale) => {
      const expectedBalanceFromSheetPaid = round(Math.max(sale.totalSalePhp - sale.salesPaidPhp, 0));
      if (Math.abs(expectedBalanceFromSheetPaid - sale.salesBalancePhp) > 0.009) {
        issues.push({ severity: "critical", area: "Sales Balance", record: sale.salesRefNo, message: "Sales row paid amount and balance do not reconcile.", expected: money(expectedBalanceFromSheetPaid), actual: money(sale.salesBalancePhp) });
      }
      if (Math.abs(sale.reconciledBalancePhp - sale.salesBalancePhp) > 0.009) {
        issues.push({ severity: "warning", area: "Payments Sync", record: sale.salesRefNo, message: "Payment ledger and Sales balance are not fully synced. Refresh reports after checking payment allocation.", expected: money(sale.reconciledBalancePhp), actual: money(sale.salesBalancePhp) });
      }
      if (sale.doubleCountRisk) {
        issues.push({ severity: "info", area: "Double Count Guard", record: sale.salesRefNo, message: "This record has payment values in both Sales and Payments ledger. Reports must reconcile using max/payment balance logic and must not add both together.", expected: money(sale.reconciledPaidPhp), actual: money(sale.doubleCountedPaidPhp) });
      }
    });

    inventory.filter((item) => item.status === "Critical").forEach((item) => {
      issues.push({ severity: "critical", area: "Inventory", record: `${item.description} / ${item.specification}`, message: "Confirmed sold quantity is higher than available inventory.", expected: `${item.availableQty - item.damagedQty} available`, actual: `${item.soldQty} sold` });
    });

    expenses.filter((expense) => expense.balanceAmount > 0 && !["installment", "pending"].includes(norm(expense.status))).forEach((expense) => {
      issues.push({ severity: "warning", area: "Expense Payables", record: expense.customerName || expense.category, message: "Expense has balance but status is not Pending or Installment.", expected: "Pending or Installment", actual: expense.status });
    });

    const customerMap = new Map<string, any>();
    sales.forEach((sale) => {
      const key = norm(sale.customerName);
      const current = customerMap.get(key) || { customerName: sale.customerName, totalSalesPhp: 0, paidPhp: 0, balancePhp: 0, orderCount: 0, creditPhp: 0 };
      current.totalSalesPhp = round(current.totalSalesPhp + sale.totalSalePhp);
      current.paidPhp = round(current.paidPhp + sale.reconciledPaidPhp);
      current.balancePhp = round(current.balancePhp + sale.reconciledBalancePhp);
      current.orderCount += 1;
      customerMap.set(key, current);
    });
    credits.forEach((credit) => {
      const key = norm(credit.customerName);
      const current = customerMap.get(key) || { customerName: credit.customerName, totalSalesPhp: 0, paidPhp: 0, balancePhp: 0, orderCount: 0, creditPhp: 0 };
      current.creditPhp = round(current.creditPhp + credit.creditAmountPhp);
      customerMap.set(key, current);
    });

    const customerSummaries = Array.from(customerMap.values()).sort((a, b) => b.balancePhp - a.balancePhp || a.customerName.localeCompare(b.customerName));
    const totalSalesPhp = round(sales.reduce((sum, sale) => sum + sale.totalSalePhp, 0));
    const totalPaidPhp = round(sales.reduce((sum, sale) => sum + sale.reconciledPaidPhp, 0));
    const totalBalancePhp = round(sales.reduce((sum, sale) => sum + sale.reconciledBalancePhp, 0));
    const totalCreditPhp = round(credits.reduce((sum, credit) => sum + credit.creditAmountPhp, 0));
    const critical = issues.filter((issue) => issue.severity === "critical").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    const health = critical > 0 ? "Critical" : warnings > 0 ? "Warning" : "Balanced";

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      health,
      summary: { totalSalesPhp, totalPaidPhp, totalBalancePhp, totalCreditPhp, saleCount: sales.length, customerCount: customerSummaries.length, critical, warnings, info: issues.filter((issue) => issue.severity === "info").length },
      issues,
      customerSummaries,
      sales: sales.sort((a, b) => b.reconciledBalancePhp - a.reconciledBalancePhp),
      inventory,
      restorePoint: { status: "Manual", dailyAutomationVerified: false, note: "Repository contains restore point documents, but no verified daily restore-point automation is connected to this audit." },
    });
  } catch (error: any) {
    console.error("ACCOUNTING AUDIT ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to run accounting audit" }, { status: 500 });
  }
}
