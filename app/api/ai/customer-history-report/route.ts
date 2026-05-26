import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

type SalesItem = {
  saleDate: string;
  salesRefNo: string;
  customerName: string;
  description: string;
  specification: string;
  qty: number;
  totalSalePhp: number;
  grossProfitPhp: number;
  paymentStatus: string;
  amountPaidPhp: number;
  balancePhp: number;
  saleStatus: string;
  salesperson: string;
};

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function numberText(value: number) {
  return Number(value || 0).toLocaleString();
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
  if (qty <= 0) return false;
  return true;
}

function isCancelledSale(item: SalesItem) {
  const saleStatus = item.saleStatus.toLowerCase();
  const paymentStatus = item.paymentStatus.toLowerCase();
  return saleStatus.includes("cancel") || saleStatus.includes("void") || paymentStatus.includes("cancel") || paymentStatus.includes("void");
}

function buildCustomerRows(items: SalesItem[]) {
  const customerMap = new Map<string, {
    customer: string;
    salesCount: number;
    totalQty: number;
    totalSalesPhp: number;
    totalPaidPhp: number;
    balancePhp: number;
    grossProfitPhp: number;
    lastSaleDate: string;
  }>();

  items.forEach((item) => {
    const customer = item.customerName || "Unspecified Customer";
    const current = customerMap.get(customer) || {
      customer,
      salesCount: 0,
      totalQty: 0,
      totalSalesPhp: 0,
      totalPaidPhp: 0,
      balancePhp: 0,
      grossProfitPhp: 0,
      lastSaleDate: "",
    };

    current.salesCount += 1;
    current.totalQty += item.qty;
    current.totalSalesPhp += item.totalSalePhp;
    current.totalPaidPhp += item.amountPaidPhp;
    current.balancePhp += item.balancePhp;
    current.grossProfitPhp += item.grossProfitPhp;
    current.lastSaleDate = !current.lastSaleDate || item.saleDate > current.lastSaleDate ? item.saleDate : current.lastSaleDate;
    customerMap.set(customer, current);
  });

  return [...customerMap.values()];
}

function buildReport(items: SalesItem[]) {
  const activeItems = items.filter((item) => !isCancelledSale(item));
  const cancelledItems = items.filter(isCancelledSale);
  const activeCustomers = buildCustomerRows(activeItems);

  const paymentCounts = new Map<string, number>();
  const saleStatusCounts = new Map<string, number>();

  items.forEach((item) => {
    const paymentStatus = item.paymentStatus || "Unspecified";
    paymentCounts.set(paymentStatus, (paymentCounts.get(paymentStatus) || 0) + 1);
    const saleStatus = item.saleStatus || "Unspecified";
    saleStatusCounts.set(saleStatus, (saleStatusCounts.get(saleStatus) || 0) + 1);
  });

  const activeSalesPhp = activeItems.reduce((sum, item) => sum + item.totalSalePhp, 0);
  const activePaidPhp = activeItems.reduce((sum, item) => sum + item.amountPaidPhp, 0);
  const activeBalancePhp = activeItems.reduce((sum, item) => sum + item.balancePhp, 0);
  const activeQty = activeItems.reduce((sum, item) => sum + item.qty, 0);
  const cancelledSalesPhp = cancelledItems.reduce((sum, item) => sum + item.totalSalePhp, 0);
  const topCustomers = [...activeCustomers].sort((a, b) => b.totalSalesPhp - a.totalSalesPhp).slice(0, 10);
  const outstandingCustomers = [...activeCustomers].filter((item) => item.balancePhp > 0).sort((a, b) => b.balancePhp - a.balancePhp).slice(0, 10);
  const recentSales = [...items].sort((a, b) => String(b.saleDate).localeCompare(String(a.saleDate))).slice(0, 12);

  return {
    title: "Customer History Report",
    generatedBy: "Customer History Agent",
    mode: "Safe Read-Only",
    sources: ["Sales sheet via read-only Google Sheets scope"],
    executiveSummary: `The customer history review found ${numberText(activeCustomers.length)} active customer(s), ${numberText(activeItems.length)} active sale line(s), ${peso(activeSalesPhp)} in active tracked sales, and ${peso(activeBalancePhp)} outstanding balance. ${numberText(cancelledItems.length)} cancelled/void sale line(s) totaling ${peso(cancelledSalesPhp)} were separated from active totals.`,
    summaryCards: [
      { label: "Customers", value: numberText(activeCustomers.length), helper: "Unique active customers" },
      { label: "Active Sale Lines", value: numberText(activeItems.length), helper: "Excludes cancelled/void" },
      { label: "Active Sales", value: peso(activeSalesPhp), helper: "Confirmed/non-cancelled sales" },
      { label: "Amount Paid", value: peso(activePaidPhp), helper: "Collected active sales amount" },
      { label: "Outstanding", value: peso(activeBalancePhp), helper: "Remaining active balances" },
      { label: "Cancelled Lines", value: numberText(cancelledItems.length), helper: "Separated from active totals" },
    ],
    sections: [
      {
        title: "Top Customers by Active Sales",
        description: "Customers ranked by active tracked sales value. Cancelled/void sales are excluded.",
        columns: ["Customer", "Sale Lines", "Total Sales", "Paid", "Balance", "Last Sale"],
        rows: topCustomers.map((item) => ({ Customer: item.customer, "Sale Lines": item.salesCount, "Total Sales": peso(item.totalSalesPhp), Paid: peso(item.totalPaidPhp), Balance: peso(item.balancePhp), "Last Sale": item.lastSaleDate || "Not specified" })),
        emptyMessage: "No active customer sales were found.",
      },
      {
        title: "Outstanding Customer Balances",
        description: "Customers with remaining active balances that may require follow-up.",
        columns: ["Customer", "Balance", "Total Sales", "Paid", "Sale Lines", "Last Sale"],
        rows: outstandingCustomers.map((item) => ({ Customer: item.customer, Balance: peso(item.balancePhp), "Total Sales": peso(item.totalSalesPhp), Paid: peso(item.totalPaidPhp), "Sale Lines": item.salesCount, "Last Sale": item.lastSaleDate || "Not specified" })),
        emptyMessage: "No outstanding customer balances were detected.",
      },
      {
        title: "Payment Status Summary",
        description: "All valid sales rows grouped by current payment status.",
        columns: ["Payment Status", "Records"],
        rows: [...paymentCounts.entries()].map(([status, count]) => ({ "Payment Status": status, Records: count })),
        emptyMessage: "No payment status records were found.",
      },
      {
        title: "Sale Status Summary",
        description: "All valid sales rows grouped by sale status.",
        columns: ["Sale Status", "Records"],
        rows: [...saleStatusCounts.entries()].map(([status, count]) => ({ "Sale Status": status, Records: count })),
        emptyMessage: "No sale status records were found.",
      },
      {
        title: "Cancelled / Void Sales Excluded From Totals",
        description: "Cancelled or void rows are shown for audit visibility, but not included in active sales totals.",
        columns: ["Date", "Sales Ref", "Customer", "Product", "Qty", "Total", "Status"],
        rows: cancelledItems.map((item) => ({ Date: item.saleDate || "Not specified", "Sales Ref": item.salesRefNo || "Not specified", Customer: item.customerName, Product: `${item.description} - ${item.specification}`, Qty: item.qty, Total: peso(item.totalSalePhp), Status: item.saleStatus || item.paymentStatus || "Not specified" })),
        emptyMessage: "No cancelled or void sales were detected.",
      },
      {
        title: "Recent Customer Sales",
        description: "Latest customer sale lines returned from the Sales sheet. Cancelled/void rows are visibly marked by status.",
        columns: ["Date", "Sales Ref", "Customer", "Product", "Qty", "Total", "Balance", "Status"],
        rows: recentSales.map((item) => ({ Date: item.saleDate || "Not specified", "Sales Ref": item.salesRefNo || "Not specified", Customer: item.customerName, Product: `${item.description} - ${item.specification}`, Qty: item.qty, Total: peso(item.totalSalePhp), Balance: peso(item.balancePhp), Status: item.saleStatus || item.paymentStatus || "Not specified" })),
        emptyMessage: "No recent customer sales were found.",
      },
    ],
    recommendedActions: [
      outstandingCustomers.length ? `Follow up on the highest outstanding active balance: ${outstandingCustomers[0].customer} at ${peso(outstandingCustomers[0].balancePhp)}.` : "No active customer balance follow-up is required from the current read-only review.",
      cancelledItems.length ? `Review ${numberText(cancelledItems.length)} cancelled/void sale line(s) for audit completeness; they are excluded from active totals.` : "No cancelled or void sale rows were detected.",
      "Compare customer balances against payment records before closing daily sales review.",
      "Use customer filters by date, payment status, sale status, and customer name when investigating specific sales history.",
    ],
    systemNote: "This customer history report was generated in safe read-only mode. Cancelled/void sales are separated from active totals. No sales, customer, payment, balance, inventory, supplier, or pricing records were modified.",
  };
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
    const rows = (response.data.values || []) as string[][];
    const items = rows.slice(1).filter(isValidSalesRow).map((row) => ({
      saleDate: normalizeDate(row[0]),
      salesRefNo: String(row[1] || "").trim(),
      customerName: String(row[2] || "").trim(),
      description: String(row[3] || "").trim(),
      specification: String(row[4] || "").trim(),
      qty: toNumber(row[5]),
      totalSalePhp: toNumber(row[28] || row[7]),
      grossProfitPhp: toNumber(row[10]),
      paymentStatus: String(row[11] || "Pending").trim(),
      amountPaidPhp: toNumber(row[16]),
      balancePhp: toNumber(row[17]),
      saleStatus: String(row[20] || "Draft").trim(),
      salesperson: String(row[12] || "").trim(),
    }));

    return NextResponse.json({ mode: "safe-read-only", source: SALES_SHEET, report: buildReport(items), writeActionsEnabled: false, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to build customer history report" }, { status: 500 });
  }
}
