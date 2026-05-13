import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DAILY_REPORTS_SHEET = "Daily Reports";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function rowToObject(headers: string[], row: string[]) {
  return headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = row[index] || "";
    return acc;
  }, {});
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${DAILY_REPORTS_SHEET}'!A:Z`,
    });

    const values = response.data.values || [];
    const [headers = [], ...rows] = values as string[][];

    const reports = rows
      .filter((row) => row.some((cell) => String(cell || "").trim()))
      .map((row) => {
        const item = rowToObject(headers, row);

        return {
          reportId: item["Report ID"],
          reportDate: item["Report Date"],
          salesmanName: item["Salesman Name"],
          route: item["Route"],
          vehicleNo: item["Vehicle No"],
          cashAdvance: toNumber(item["Cash Advance"]),
          cashSales: toNumber(item["Cash Sales"]),
          collectionsTotal: toNumber(item["Collections Total"]),
          approvedExpenses: toNumber(item["Approved Expenses"]),
          deposits: toNumber(item["Deposits / Bank Transfers"]),
          expectedCash: toNumber(item["Expected Cash Remittance"]),
          actualCash: toNumber(item["Actual Cash Remitted"]),
          variance: toNumber(item["Variance"]),
          invoiceScanCount: toNumber(item["Invoice Scan Count"]),
          expenseReceiptCount: toNumber(item["Expense Receipt Count"]),
          returnCount: toNumber(item["Return Count"]),
          status: item["Status"],
          accountingReviewStatus: item["Accounting Review Status"],
          reviewedBy: item["Reviewed By"],
          reviewedAt: item["Reviewed At"],
          createdAt: item["Created At"],
          notes: item["Notes"],
        };
      })
      .reverse();

    const totals = reports.reduce(
      (acc, report) => {
        acc.cashSales += report.cashSales;
        acc.collectionsTotal += report.collectionsTotal;
        acc.approvedExpenses += report.approvedExpenses;
        acc.expectedCash += report.expectedCash;
        acc.actualCash += report.actualCash;
        acc.variance += report.variance;
        if (Math.abs(report.variance) > 0.009) acc.varianceCount += 1;
        return acc;
      },
      {
        cashSales: 0,
        collectionsTotal: 0,
        approvedExpenses: 0,
        expectedCash: 0,
        actualCash: 0,
        variance: 0,
        varianceCount: 0,
      }
    );

    return NextResponse.json({ ok: true, reports, totals });
  } catch (error: any) {
    console.error("ACCOUNTING REPORTS GET ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load accounting reports." },
      { status: 500 }
    );
  }
}
