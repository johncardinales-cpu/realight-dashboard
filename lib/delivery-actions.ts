import { createHash } from "node:crypto";

export const DELIVERY_ACTIONS_SHEET = "Delivery_Actions";
export const DELIVERY_ACTION_HEADERS = [
  "Event ID", "Created At", "Delivery Key", "Sheet Row", "Action",
  "Before Status", "After Status", "Note", "Actor",
] as const;

export const DELIVERY_HEADERS = [
  "Delivery ID", "Upload Date", "Supplier", "Batch / PO Ref",
  "Description", "Specification", "Qty", "Unit", "Unit Cost PHP",
  "Status", "Expected Arrival", "Received Date", "Notes",
] as const;

export type DeliveryAction = "STATUS_CHANGE" | "REMOVE_CANCELLED" | "RESTORE_CANCELLED";
export type DeliveryStatus = "Incoming" | "Available" | "Damaged" | "Cancelled";
export type SheetRow = Array<unknown>;

const statusAliases: Record<string, DeliveryStatus> = {
  incoming: "Incoming", "in transit": "Incoming", received: "Available", ready: "Available",
  available: "Available", "ready to receive": "Available", damaged: "Damaged",
  defective: "Damaged", damage: "Damaged", canceled: "Cancelled", cancelled: "Cancelled",
};

export function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  const result = statusAliases[String(value ?? "").trim().toLowerCase()];
  if (!result) throw new Error("Unknown delivery status; action refused.");
  return result;
}

export function verifyDeliveryHeaders(row: SheetRow): void {
  if (DELIVERY_HEADERS.some((name, index) => String(row[index] || "").trim() !== name)) {
    throw new Error("App_Deliveries columns differ from the verified layout. No delivery changes were made.");
  }
}

export function verifyDeliveryActionHeaders(row: SheetRow): void {
  if (DELIVERY_ACTION_HEADERS.some((name, index) => String(row[index] || "").trim() !== name)) {
    throw new Error("Delivery_Actions columns differ from the expected layout.");
  }
}

export function deliveryKey(row: SheetRow): string {
  const fields = [0, 1, 2, 3, 4, 5, 6].map(index => String(row[index] ?? "").trim());
  if (!fields[0] || !fields[4] || !fields[5] || !fields[6]) {
    throw new Error("Delivery row is missing a required identifier, product or quantity.");
  }
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

export function isDeliveryRow(row: SheetRow): boolean {
  return row.some(value => String(value ?? "").trim() !== "");
}

/** Only the latest REMOVE/RESTORE event for a delivery determines list visibility. */
export function removedDeliveryKeys(rows: SheetRow[]): Set<string> {
  if (!rows.length) return new Set();
  verifyDeliveryActionHeaders(rows[0]);
  const removed = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    if (!isDeliveryRow(row)) continue;
    const id = String(row[0] || "").trim();
    const key = String(row[2] || "").trim();
    const action = String(row[4] || "").trim();
    const note = String(row[7] || "").trim();
    const actor = String(row[8] || "").trim();
    if (!id || seen.has(id) || !/^[0-9a-f]{64}$/.test(key) ||
        !["STATUS_CHANGE","REMOVE_CANCELLED","RESTORE_CANCELLED"].includes(action) ||
        !actor || note.length < 8) {
      throw new Error("Invalid delivery action history; review the ledger before making further changes.");
    }
    seen.add(id);
    if (action === "REMOVE_CANCELLED") removed.add(key);
    if (action === "RESTORE_CANCELLED") removed.delete(key);
  }
  return removed;
}

export async function readDeliveryActions(sheets: any, spreadsheetId: string): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${DELIVERY_ACTIONS_SHEET}!A:I`,
    });
    return (response.data.values || []) as string[][];
  } catch (error: any) {
    const status = Number(error?.response?.status || error?.code);
    const message = String(error?.response?.data?.error?.message || error?.message || "");
    if ((status === 400 || status === 404) && message.includes(DELIVERY_ACTIONS_SHEET) &&
      /unable to parse range|not found|does not exist/i.test(message)) return [];
    throw error;
  }
}

export function validDeliveryNote(note: unknown): boolean {
  const value = String(note ?? "").trim();
  return value.length >= 8 && value.length <= 500;
}

export function validDeliveryTransition(
  action: DeliveryAction, before: DeliveryStatus, after: DeliveryStatus, removed: boolean
): boolean {
  if (action === "STATUS_CHANGE") return !removed && before !== after;
  if (action === "REMOVE_CANCELLED") return !removed && before === "Cancelled" && after === "Cancelled";
  return action === "RESTORE_CANCELLED" && removed && before === "Cancelled" && after === "Cancelled";
}
