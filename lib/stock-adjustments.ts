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
    const qty = Number(row[6]) || 0;
    const status = String(row[9] || "").trim().toLowerCase();
    if (status === "available") rawQty += qty;
    else if (["damaged", "damage", "defective"].includes(status)) rawQty -= qty;
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
