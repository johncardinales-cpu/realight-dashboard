import { randomUUID } from "node:crypto";

/** The live Pricing_Base schema. Never reorder or overwrite unrelated columns. */
export const PRICING_HEADERS = [
  "Item ID", "Description", "Specification", "Category", "Unit", "Cost Price USD",
  "FX Rate", "Cost Price PHP", "Selling Price PHP", "Dealer Price PHP",
  "Minimum Price PHP", "Gross Margin", "Status", "Notes",
] as const;

type DeliveryPriceInput = {
  description?: unknown; specification?: unknown; unitPriceUsd?: unknown;
  status?: unknown; batchReference?: unknown;
};

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown): number {
  if (value === "" || value === undefined || value === null) return 0;
  const parsed = Number(text(value).replace(/[,₱$\s]/g, ""));
  if (!Number.isFinite(parsed)) throw new Error("Pricing data contains an invalid numeric value.");
  return parsed;
}
function key(description: unknown, specification: unknown) {
  return `${text(description).toLowerCase()}|||${text(specification).toLowerCase()}`;
}
function itemId(description: string, specification: string) {
  const identifier = `${description}-${specification}`
    .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ITEM-${identifier.slice(0, 32)}`;
}
function category(description: string) {
  const name = description.toLowerCase();
  if (name.includes("panel")) return "Solar Panel";
  if (name.includes("inverter")) return "Inverter";
  if (name.includes("battery")) return "Battery";
  if (name.includes("cable") || name.includes("connector")) return "Electrical Accessories";
  return "Imported Product";
}
function rowCells(values: unknown[]) {
  return { values: values.map(value => ({
    userEnteredValue: typeof value === "number"
      ? { numberValue: value }
      : { stringValue: text(value) },
  })) };
}
function setValue(sheetId: number, rowNumber: number, columnIndex: number, value: unknown) {
  return { updateCells: {
    start: { sheetId, rowIndex: rowNumber - 1, columnIndex },
    rows: [rowCells([value])], fields: "userEnteredValue",
  } };
}

export function prepareDeliveryPricing(
  deliveries: DeliveryPriceInput[],
  rates: Array<number | undefined>,
  existingRows: unknown[][],
  pricingSheetId: number,
  auditSheetId: number,
  actor: string,
  actionNote: string,
  timestamp: string,
  makeId: () => string = randomUUID,
) {
  const headers = existingRows[0] || [];
  if (PRICING_HEADERS.some((header, index) => text(headers[index]) !== header)) {
    throw new Error("Pricing_Base columns differ from the verified layout. No delivery will be imported.");
  }
  if (deliveries.length !== rates.length) throw new Error("Pricing rate count does not match import rows.");
  if (!actor || actionNote.trim().length < 8) throw new Error("Actor and action note are required for pricing updates.");

  const existing = new Map<string, { rowNumber: number; row: unknown[] }>();
  for (let i = 1; i < existingRows.length; i++) {
    const row = existingRows[i] || [];
    const sku = key(row[1], row[2]);
    if (sku === "|||") continue;
    if (existing.has(sku)) throw new Error("Pricing_Base contains duplicate products; pricing sync stopped.");
    existing.set(sku, { rowNumber: i + 1, row });
  }

  // One pricing update per product for a batch containing multiple deliveries.
  const latest = new Map<string, { item: DeliveryPriceInput; rate?: number }>();
  deliveries.forEach((item, index) => {
    const sku = key(item.description, item.specification);
    const status = text(item.status).toLowerCase();
    if (!sku || sku === "|||" || ["cancelled", "canceled"].includes(status)) return;
    const previous = latest.get(sku);
    // Prefer the latest row supplying actual supplier cost.
    if (!previous || number(item.unitPriceUsd) > 0 || number(previous.item.unitPriceUsd) <= 0) {
      latest.set(sku, { item, rate: rates[index] });
    }
  });

  const requests: object[] = [];
  let created = 0, updated = 0;
  for (const [sku, { item, rate }] of latest) {
    const description = text(item.description), specification = text(item.specification);
    const found = existing.get(sku);
    const suppliedCostUsd = number(item.unitPriceUsd);
    if (suppliedCostUsd < 0) throw new Error("Supplier USD cost cannot be negative.");

    if (found && suppliedCostUsd <= 0) continue; // No cost change; preserve existing pricing.
    if (suppliedCostUsd > 0 && (!Number.isFinite(rate) || !rate || rate <= 0 || rate > 1000)) {
      throw new Error("A positive per-product FX rate is required for a supplier cost.");
    }
    const old = found?.row || [];
    const costUsd = suppliedCostUsd > 0 ? suppliedCostUsd : 0;
    const fxRate = suppliedCostUsd > 0 ? rate! : 0;
    const costPhp = Math.round(costUsd * fxRate * 100) / 100;
    const existingSale = number(old[8]);
    const grossMargin = existingSale > 0 ? (existingSale - costPhp) / existingSale : (found ? number(old[11]) : 0);
    const before = found ? {
      costUsd: number(old[5]), fxRate: number(old[6]), costPhp: number(old[7]), grossMargin: number(old[11]),
    } : {};
    const notes = `${timestamp} [${actor}] Delivery pricing sync: ${actionNote}; ${text(item.batchReference)}`;
    const existingNotes = text(old[13]);
    const combinedNotes = existingNotes ? `${existingNotes} | ${notes}` : notes;
    if (combinedNotes.length > 40000) throw new Error("Pricing notes have reached the maximum length.");

    const id = found ? text(old[0]) || itemId(description, specification) : itemId(description, specification);
    if (found) {
      const modifications: Array<[number, string | number]> = [
        [5, costUsd], [6, fxRate], [7, costPhp], [11, grossMargin], [13, combinedNotes],
      ];
      for (const [column, value] of modifications) {
        requests.push(setValue(pricingSheetId, found.rowNumber, column, value));
      }
      updated++;
    } else {
      requests.push({ appendCells: {
        sheetId: pricingSheetId,
        rows: [rowCells([
          id, description, specification, category(description), "pc",
          costUsd, fxRate, costPhp, "", "", "", grossMargin, "Pending Pricing", combinedNotes,
        ])], fields: "userEnteredValue",
      } });
      created++;
    }
    const after = { costUsd, fxRate, costPhp, grossMargin };
    requests.push({ appendCells: {
      sheetId: auditSheetId, rows: [rowCells([
        `AUDIT_${makeId()}`, timestamp, "Pricing", "PRICING_FROM_DELIVERY",
        id, text(item.batchReference) || id, actor, notes,
        JSON.stringify(before), JSON.stringify(after),
      ])], fields: "userEnteredValue",
    } });
  }
  return { requests, created, updated, audited: created + updated };
}
