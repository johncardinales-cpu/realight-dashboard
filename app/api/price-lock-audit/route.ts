import { NextResponse } from "next/server";
import { getSheetsClient, SHEET_ID } from "@/lib/sheets";

const SALES = "Sales!A:AJ";
const PRICING = "Pricing_Base!A:N";

const txt = (value: unknown) => String(value || "").trim();
const num = (value: unknown) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const norm = (value: unknown) => txt(value).toLowerCase().replace(/\s+/g, " ");
const inactive = (value: unknown) => ["voided", "cancelled", "canceled"].includes(norm(value));
const confirmed = (value: unknown) => norm(value) === "confirmed";

function key(description: string, specification: string) {
  return `${txt(description)}|||${txt(specification)}`;
}

function money(value: number) {
  return `PHP ${round(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normDate(value: unknown) {
  const raw = txt(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

async function readRanges() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges: [SALES, PRICING] });
  return [(res.data.valueRanges?.[0]?.values || []) as string[][], (res.data.valueRanges?.[1]?.values || []) as string[][]];
}

function pricingMap(rows: string[][]) {
  const map = new Map<string, any>();
  rows.slice(1).forEach((row) => {
    const itemKey = key(row[1], row[2]);
    if (itemKey === "|||") return;
    map.set(itemKey, {
      itemId: txt(row[0]),
      description: txt(row[1]),
      specification: txt(row[2]),
      currentCostPhp: num(row[7]),
      currentSellingPhp: num(row[8]),
      currentDealerPhp: num(row[9]),
      currentMinimumPhp: num(row[10]),
      status: txt(row[12]) || "Active",
    });
  });
  return map;
}

export async function GET() {
  try {
    const [salesRows, priceRows] = await readRanges();
    const prices = pricingMap(priceRows);
    const findings: any[] = [];
    const rows = salesRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => confirmed(row[20]) && !inactive(row[11]) && !inactive(row[20]));

    rows.forEach(({ row, rowNumber }) => {
      const qty = num(row[5]);
      if (qty <= 0) return;
      const description = txt(row[3]);
      const specification = txt(row[4]);
      const salesRefNo = txt(row[1]);
      const item = prices.get(key(description, specification));
      const saleUnitPrice = num(row[6]);
      const saleCostPrice = num(row[8]);
      const saleTotal = num(row[28] || row[7]);
      const saleGrossProfit = num(row[10]);
      const expectedGross = round(saleTotal - round(qty * saleCostPrice));

      if (saleUnitPrice <= 0) {
        findings.push({ severity: "critical", area: "Price Snapshot", salesRefNo, rowNumber, message: "Confirmed product sale has no saved unit selling price. Old report values are not fully protected.", expected: "Saved unit selling price greater than zero", actual: money(saleUnitPrice) });
      }
      if (saleCostPrice <= 0) {
        findings.push({ severity: "warning", area: "Cost Snapshot", salesRefNo, rowNumber, message: "Confirmed product sale has no saved cost price. Gross profit may be overstated unless this is intentional.", expected: "Saved cost price greater than zero", actual: money(saleCostPrice) });
      }
      if (Math.abs(expectedGross - saleGrossProfit) > 0.02) {
        findings.push({ severity: "critical", area: "Gross Profit", salesRefNo, rowNumber, message: "Saved gross profit does not reconcile with saved sale total and saved cost snapshot.", expected: money(expectedGross), actual: money(saleGrossProfit) });
      }
      if (item && item.currentSellingPhp > 0 && Math.abs(item.currentSellingPhp - saleUnitPrice) > 0.02) {
        findings.push({ severity: "info", area: "Historical Price Lock", salesRefNo, rowNumber, message: "Current product price differs from this confirmed sale. This is normal and old sale must remain frozen.", expected: `Old sale locked at ${money(saleUnitPrice)}`, actual: `Current price list ${money(item.currentSellingPhp)}` });
      }
      if (item && item.currentCostPhp > 0 && Math.abs(item.currentCostPhp - saleCostPrice) > 0.02) {
        findings.push({ severity: "info", area: "Historical Cost Lock", salesRefNo, rowNumber, message: "Current cost differs from this confirmed sale. This is normal and old gross profit must remain based on saved cost snapshot.", expected: `Old cost locked at ${money(saleCostPrice)}`, actual: `Current cost ${money(item.currentCostPhp)}` });
      }
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      checkedConfirmedRows: rows.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
      info: findings.filter((item) => item.severity === "info").length,
      rule: "Confirmed Sales rows are the historical price/cost/profit source. Pricing_Base changes affect new sales only.",
      findings,
    });
  } catch (error: any) {
    console.error("PRICE LOCK AUDIT ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to run price lock audit" }, { status: 500 });
  }
}
