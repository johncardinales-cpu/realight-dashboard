import { randomUUID } from "node:crypto";
import {
  deliveryKey, normalizeDeliveryStatus, validDeliveryNote,
  type DeliveryStatus, type SheetRow,
} from "./delivery-actions.ts";

// Incoming-delivery costs must use the selected or recorded Pricing_Base FX rate.
// Never silently convert costs using a single hard-coded global rate.

export type DeliveryInput = {
  uploadDate?: unknown; arrivalDate?: unknown; supplier?: unknown;
  batchReference?: unknown; description?: unknown; specification?: unknown;
  qtyAdded?: unknown; unitPriceUsd?: unknown; invoiceValid?: unknown;
  status?: unknown; notes?: unknown; unit?: unknown; fxRate?: unknown;
};

function text(v: unknown) { return String(v ?? "").trim(); }

export function buildNewDelivery(input: DeliveryInput, actionNote: string, fxRate?: number): {
  row: SheetRow; key: string; status: DeliveryStatus;
} {
  if (!validDeliveryNote(actionNote)) throw new Error("Delivery action note must contain 8 to 500 characters.");
  const uploadDate = text(input.uploadDate);
  const supplier = text(input.supplier);
  const description = text(input.description);
  const specification = text(input.specification);
  const qty = Number(input.qtyAdded);
  const usd = text(input.unitPriceUsd);
  const unitCostUsd = usd ? Number(usd) : 0;
  const receivedDate = new Date().toISOString().slice(0, 10);
  if (unitCostUsd > 0 && (!fxRate || !Number.isFinite(fxRate) || fxRate <= 0 || fxRate > 1000)) {
    throw new Error("FX rate is required to convert the USD supplier cost to PHP. Use the product pricing rate or enter an explicit FX rate.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(uploadDate) || !supplier || !description || !specification ||
      !Number.isSafeInteger(qty) || qty <= 0 || qty > 1000000 || !Number.isFinite(unitCostUsd) || unitCostUsd < 0) {
    throw new Error("Delivery must include date, supplier, product, a positive whole-number quantity and a valid cost.");
  }
  const status = normalizeDeliveryStatus(input.status || "Incoming");
  const recordNote = text(input.notes);
  if (recordNote.length > 500) throw new Error("Delivery row note is too long.");
  const extendedNote = [
    `Action note: ${actionNote}`,
    recordNote && recordNote !== actionNote ? `Row note: ${recordNote}` : "",
    text(input.invoiceValid) ? `Invoice valid: ${text(input.invoiceValid)}` : "",
    usd && unitCostUsd > 0 ? `Entered cost: USD ${unitCostUsd}; converted at PHP ${fxRate} per USD.` : "",
  ].filter(Boolean).join("\n");
  const row: SheetRow = [
    `DEL_${randomUUID()}`, uploadDate, supplier, text(input.batchReference),
    description, specification, qty, text(input.unit) || "pc",
    usd && unitCostUsd > 0 ? Math.round(unitCostUsd * (fxRate || 0) * 100) / 100 : "",
    status, text(input.arrivalDate),
    ["Available", "Damaged"].includes(status) ? receivedDate : "",
    extendedNote,
  ];
  return { row, status, key: deliveryKey(row) };
}
