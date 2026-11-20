/** Exclude canceled shipments and synthetic warehouse damage from supplier invoice estimates. */
export function isBillableSupplierDelivery(row: unknown[]): boolean {
  const status = String(row[9] ?? "").trim().toLowerCase();
  const supplier = String(row[2] ?? "").trim();
  const batch = String(row[3] ?? "").trim();
  const description = String(row[4] ?? "").trim();
  const specification = String(row[5] ?? "").trim();
  const qty = Number(row[6]);
  if (!supplier || !description || !specification || !Number.isFinite(qty) || qty <= 0) return false;
  if (status === "canceled" || status === "cancelled") return false;
  if (supplier.toLowerCase() === "damage" && batch.toLowerCase() === "dashboard adjustment") return false;
  return true;
}
