/** Canonical stock movements for the 13-column App_Deliveries register.
 * Supplier shipments that are damaged before receipt do not reduce stock.
 * A deliberately-created dashboard damage event reduces existing on-hand stock.
 */
export function deliveryStockImpact(row: unknown[]): { incoming: number; available: number; damaged: number } {
  const qty = Number(row[6]);
  const status = String(row[9] ?? "").trim().toLowerCase();
  const supplier = String(row[2] ?? "").trim().toLowerCase();
  const batch = String(row[3] ?? "").trim().toLowerCase();
  if (!Number.isFinite(qty) || qty < 0) throw new Error("Delivery row has an invalid quantity.");
  const damageAdjustment = supplier === "damage" && batch === "dashboard adjustment";
  const incoming = ["incoming", "in transit"].includes(status) ? qty : 0;
  const available = ["available", "received"].includes(status) ? qty :
    ["damaged", "defective", "damage"].includes(status) && damageAdjustment ? -qty : 0;
  const damaged = ["damaged", "defective", "damage"].includes(status) ? qty : 0;
  return { incoming, available, damaged };
}

/** Signed stock change caused by reclassifying one supplier delivery status. */
export function statusChangeStockDelta(row: unknown[], nextStatus: string): number {
  const before = deliveryStockImpact(row).available;
  const changed = [...row];
  changed[9] = nextStatus;
  return deliveryStockImpact(changed).available - before;
}

export function wouldOversellStock(current: number, signedChange: number): boolean {
  return !Number.isSafeInteger(current) || !Number.isSafeInteger(signedChange) || current + signedChange < 0;
}
