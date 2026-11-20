import { deliveryStockImpact } from "./delivery-stock.ts";
export const STOCK_ADJUSTMENTS_SHEET = "Stock_Adjustments";
export const STOCK_ADJUSTMENT_HEADERS = [
  "Adjustment ID", "Created At", "Description", "Specification", "Before Qty",
  "Delta Qty", "After Qty", "Reason", "Actor", "Reference",
] as const;

type Row = unknown[];

export function stockKey(description: unknown, specification: unknown): string {
  return `${String(description || "").trim()}|||${String(specification || "").trim()}`;
}

export function adjustmentDeltas(rows: Row[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const id = String(row[0] || "").trim();
    if (!id) continue;
    const key = stockKey(row[2], row[3]);
    const raw = String(row[5] ?? "").trim();
    const delta = Number(raw);
    if (key === "|||" || !raw || !Number.isSafeInteger(delta)) {
      throw new Error("Stock adjustment ledger has an invalid row. Do not edit stock until it is reviewed.");
    }
    result.set(key, (result.get(key) || 0) + delta);
  }
  return result;
}

export async function readStockAdjustmentRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${STOCK_ADJUSTMENTS_SHEET}!A:J`,
    });
    return (response.data.values || []) as string[][];
  } catch (error: any) {
    const status = Number(error?.response?.status || error?.code);
    const message = String(error?.response?.data?.error?.message || error?.message || "");
    if ((status === 400 || status === 404) &&
        message.includes(STOCK_ADJUSTMENTS_SHEET) &&
        /unable to parse range|not found|does not exist/i.test(message)) {
      return [];
    }
    throw error;
  }
}

export function currentStockForItem(
  deliveries: Row[], sales: Row[], adjustmentRows: Row[],
  description: string, specification: string
): { found: boolean; rawQty: number; displayQty: number } {
  const wanted = stockKey(description, specification);
  let found = false;
  let rawQty = 0;
  for (const row of deliveries.slice(1)) {
    if (stockKey(row[4], row[5]) !== wanted) continue;
    found = true;
    rawQty += deliveryStockImpact(row).available;
  }
  for (const row of sales.slice(1)) {
    if (stockKey(row[3], row[4]) !== wanted) continue;
    if (String(row[20] || "").trim().toLowerCase() === "confirmed") {
      rawQty -= Number(row[5]) || 0;
    }
  }
  rawQty += adjustmentDeltas(adjustmentRows).get(wanted) || 0;
  if (!Number.isSafeInteger(rawQty)) throw new Error("Stock quantity cannot be safely reconciled.");
  return { found, rawQty, displayQty: Math.max(rawQty, 0) };
}

export function summarizeOnHand(
  deliveries: Row[], sales: Row[], adjustmentRows: Row[]
): number {
  const totals = new Map<string, number>();
  const add = (key: string, value: number) => totals.set(key, (totals.get(key) || 0) + value);
  for (const row of deliveries.slice(1)) {
    const key = stockKey(row[4], row[5]);
    if (key === "|||") continue;
    add(key, deliveryStockImpact(row).available);
  }
  for (const row of sales.slice(1)) {
    const key = stockKey(row[3], row[4]);
    if (key === "|||") continue;
    if (String(row[20] || "").trim().toLowerCase() === "confirmed") {
      add(key, -(Number(row[5]) || 0));
    }
  }
  for (const [key, delta] of adjustmentDeltas(adjustmentRows)) add(key, delta);
  return Array.from(totals.values()).reduce((sum, qty) => sum + Math.max(0, qty), 0);
}

/** Apply a signed delta or set an absolute physical count. Does not mutate sheets. */
export function calculateAdjustedQty(before: number, mode: "delta" | "set", value: number) {
  if (!Number.isSafeInteger(before) || before < 0) throw new Error("Current stock must be a nonnegative whole number.");
  if (!Number.isSafeInteger(value)) throw new Error("Enter a whole-number quantity.");
  if (mode !== "delta" && mode !== "set") throw new Error("Unsupported quantity adjustment mode.");
  if (mode === "delta" && value === 0) throw new Error("Enter a nonzero signed adjustment.");
  const target = mode === "delta" ? before + value : value;
  if (!Number.isSafeInteger(target) || target < 0 || target > 1000000) {
    throw new Error("Adjustment would result in invalid stock. Final quantity must be between 0 and 1,000,000.");
  }
  if (target === before) throw new Error("The adjustment does not change the current stock quantity.");
  return { targetQty: target, deltaQty: target - before };
}
