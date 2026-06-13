import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES_SHEET = "Sales";
const CUSTOMERS_SHEET = "Customers";

function txt(value: unknown) {
  return String(value || "").trim();
}

function num(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function same(value: unknown, target: string) {
  return txt(value).toLowerCase() === target.toLowerCase();
}

function inactive(value: unknown) {
  return ["cancelled", "canceled", "voided"].includes(txt(value).toLowerCase());
}

function moneyRound(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function paymentStatusFromTotals(paid: number, total: number) {
  const paidAmount = moneyRound(paid);
  const totalAmount = moneyRound(total);
  if (totalAmount > 0 && paidAmount + 0.009 >= totalAmount) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Pending";
}

function parseSaleLine(row: string[]) {
  const saleDate = txt(row[0]);
  const salesRefNo = txt(row[1]);
  const customerName = txt(row[2]);
  const groupRef = txt(row[14]);
  const saleId = txt(row[22]);
  const productSubtotalPhp = num(row[25] || row[7]);
  const taxAmountPhp = num(row[27]);
  const grandTotalPhp = num(row[28] || row[7]);
  const deliveryFeePhp = num(row[29]);
  const installationFeePhp = num(row[30]);
  const otherChargePhp = num(row[31]);
  const discountPhp = num(row[32]);
  const amountPaidPhp = num(row[16]);
  const balancePhp = num(row[17]);
  const tenderedAmountPhp = num(row[34]) || amountPaidPhp;
  const changeDuePhp = num(row[35]);

  return {
    saleDate,
    salesRefNo,
    customerName,
    description: txt(row[3]),
    specification: txt(row[4]),
    qty: num(row[5]),
    unitPricePhp: num(row[6]),
    subtotalPhp: num(row[7]),
    costPricePhp: num(row[8]),
    totalCostPhp: num(row[9]),
    grossProfitPhp: num(row[10]),
    paymentStatus: txt(row[11]) || paymentStatusFromTotals(amountPaidPhp, grandTotalPhp),
    salesperson: txt(row[12]),
    notes: txt(row[13]),
    paymentMethod: txt(row[15]) || "Unspecified",
    paidPhp: amountPaidPhp,
    balancePhp,
    transactionRef: txt(row[18]),
    cashierName: txt(row[19]),
    saleStatus: txt(row[20]) || "Draft",
    confirmedAt: txt(row[21]),
    groupRef,
    saleId,
    productSubtotalPhp,
    taxAmountPhp,
    grandTotalPhp,
    deliveryFeePhp,
    installationFeePhp,
    otherChargePhp,
    discountPhp,
    customerId: txt(row[33]),
    tenderedAmountPhp,
    changeDuePhp,
  };
}

function parseCustomer(row: string[]) {
  return {
    customerId: txt(row[0]),
    customerName: txt(row[2]),
    contactPerson: txt(row[3]),
    phone: txt(row[4]),
    email: txt(row[5]),
    address: txt(row[6]),
    customerType: txt(row[7]) || "Retail",
  };
}

function resolveInvoiceLines(allLines: ReturnType<typeof parseSaleLine>[], target: string) {
  const exactSaleId = allLines.filter((line) => same(line.saleId, target));
  if (exactSaleId.length) return exactSaleId;

  const activeByGroupOrRef = allLines.filter((line) => !inactive(line.saleStatus) && (same(line.groupRef, target) || same(line.salesRefNo, target)));
  if (activeByGroupOrRef.length) return activeByGroupOrRef;

  return allLines.filter((line) => same(line.groupRef, target) || same(line.salesRefNo, target));
}

export async function GET(_req: Request, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await params;
    const target = decodeURIComponent(saleId || "");
    if (!target) return NextResponse.json({ error: "Sale reference is required" }, { status: 400 });

    const sheets = await getSheetsClient();
    const [salesRes, customersRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` }).catch(() => ({ data: { values: [] } })),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${CUSTOMERS_SHEET}!A:J` }).catch(() => ({ data: { values: [] } })),
    ]);

    const allSaleLines = ((salesRes.data.values || []) as string[][]).slice(1).map(parseSaleLine);
    const saleLines = resolveInvoiceLines(allSaleLines, target);

    if (!saleLines.length) return NextResponse.json({ error: "Invoice sale not found" }, { status: 404 });

    const first = saleLines[0];
    const customers = ((customersRes.data.values || []) as string[][]).slice(1).map(parseCustomer);
    const customer = customers.find((row) => same(row.customerId, first.customerId)) || customers.find((row) => same(row.customerName, first.customerName)) || {
      customerId: first.customerId,
      customerName: first.customerName,
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      customerType: "",
    };

    const totals = saleLines.reduce((acc, line) => {
      acc.productSubtotalPhp += line.productSubtotalPhp || line.subtotalPhp;
      acc.deliveryFeePhp += line.deliveryFeePhp;
      acc.installationFeePhp += line.installationFeePhp;
      acc.otherChargePhp += line.otherChargePhp;
      acc.discountPhp += line.discountPhp;
      acc.taxAmountPhp += line.taxAmountPhp;
      acc.grandTotalPhp += line.grandTotalPhp;
      acc.paidPhp += line.paidPhp;
      acc.balancePhp += line.balancePhp;
      acc.grossProfitPhp += line.grossProfitPhp;
      acc.tenderedAmountPhp += line.tenderedAmountPhp;
      acc.changeDuePhp += line.changeDuePhp;
      return acc;
    }, { productSubtotalPhp: 0, deliveryFeePhp: 0, installationFeePhp: 0, otherChargePhp: 0, discountPhp: 0, taxAmountPhp: 0, grandTotalPhp: 0, paidPhp: 0, balancePhp: 0, grossProfitPhp: 0, tenderedAmountPhp: 0, changeDuePhp: 0 });

    Object.keys(totals).forEach((key) => ((totals as any)[key] = moneyRound((totals as any)[key])));
    totals.balancePhp = moneyRound(Math.max(totals.grandTotalPhp - totals.paidPhp, 0));

    const paymentStatus = paymentStatusFromTotals(totals.paidPhp, totals.grandTotalPhp);
    const transactionRef = saleLines.find((line) => txt(line.transactionRef))?.transactionRef || "";
    const cashierName = saleLines.find((line) => txt(line.cashierName))?.cashierName || "";
    const salesperson = saleLines.find((line) => txt(line.salesperson))?.salesperson || "";

    return NextResponse.json({
      invoiceNo: first.saleId || first.salesRefNo || first.groupRef || target,
      saleDate: first.saleDate,
      saleStatus: first.saleStatus,
      paymentStatus,
      paymentMethod: first.paymentMethod,
      transactionRef,
      cashierName,
      salesperson,
      customer,
      lines: saleLines,
      totals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load invoice" }, { status: 500 });
  }
}
