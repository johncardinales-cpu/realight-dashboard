import { randomUUID } from "node:crypto";
import { PRICING_HEADERS } from "./delivery-pricing.ts";

export const AUDIT_HEADERS = [
  "Audit ID", "Created At", "Module", "Action", "Record ID",
  "Record Ref", "Actor", "Summary", "Before JSON", "After JSON",
] as const;

export function pricingReason(value: unknown): string {
  const result = String(value ?? "").trim();
  if (result.length < 8 || result.length > 500) {
    throw new Error("An action note of 8 to 500 characters is required.");
  }
  return result;
}

export function moneyNumber(value: unknown, label = "Money"): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1_000_000_000) {
    throw new Error(`${label} must be a valid nonnegative number.`);
  }
  return Math.round(result * 100) / 100;
}

export function priceCells(values: Array<string | number>) {
  return { values: values.map(value => ({
    userEnteredValue: typeof value === "number"
      ? { numberValue: value } : { stringValue: value },
  })) };
}

export function pricingCellUpdate(
  pricingSheetId: number, rowNumber: number, columnIndex: number, value: string | number,
) {
  return { updateCells: {
    start: { sheetId: pricingSheetId, rowIndex: rowNumber - 1, columnIndex },
    rows: [priceCells([value])], fields: "userEnteredValue",
  } };
}

export function pricingAuditEvent(
  auditSheetId: number, action: string, recordId: string, reference: string,
  actor: string, reason: string, before: unknown, after: unknown,
  timestamp = new Date().toISOString(),
) {
  return { appendCells: {
    sheetId: auditSheetId, rows: [priceCells([
      `AUDIT_${randomUUID()}`, timestamp, "Pricing", action, recordId,
      reference, actor, reason, JSON.stringify(before), JSON.stringify(after),
    ])], fields: "userEnteredValue",
  } };
}

export async function getPricingSheetIds(sheets: any, spreadsheetId: string) {
  const [metadata, headers] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId, fields: "sheets(properties(title,sheetId))",
    }),
    sheets.spreadsheets.values.batchGet({
      spreadsheetId, ranges: ["Pricing_Base!A1:N1", "Audit_Log!A1:J1"],
    }),
  ]);
  const ids = new Map<string, number>();
  for (const entry of metadata.data.sheets || []) {
    if (entry.properties?.title && typeof entry.properties.sheetId === "number") {
      ids.set(entry.properties.title, entry.properties.sheetId);
    }
  }
  if (ids.get("Pricing_Base") === undefined || ids.get("Audit_Log") === undefined) {
    throw new Error("Pricing_Base or Audit_Log worksheet is missing. No pricing was changed.");
  }
  const first = headers.data.valueRanges?.[0]?.values?.[0] || [];
  const second = headers.data.valueRanges?.[1]?.values?.[0] || [];
  if (PRICING_HEADERS.some((name, index) => String(first[index] || "").trim() !== name) ||
      AUDIT_HEADERS.some((name, index) => String(second[index] || "").trim() !== name)) {
    throw new Error("Pricing or audit columns differ from the verified schema; no pricing was changed.");
  }
  return { pricingId: ids.get("Pricing_Base")!, auditId: ids.get("Audit_Log")! };
}
