export const INVENTORY_VISIBILITY_SHEET = "Inventory_Visibility";
export const INVENTORY_VISIBILITY_HEADERS = [
  "Event ID", "Created At", "Description", "Specification", "Action", "Reason", "Actor",
] as const;

export function inventoryKey(description: unknown, specification: unknown) {
  return `${String(description || "").trim()}|||${String(specification || "").trim()}`;
}

export function archivedInventoryKeys(rows: unknown[][]): Set<string> {
  if (!rows.length) return new Set<string>();
  const actual = (rows[0] || []).map(value => String(value || "").trim());
  if (INVENTORY_VISIBILITY_HEADERS.some((name, index) => actual[index] !== name)) {
    throw new Error("Inventory visibility ledger headers are invalid.");
  }
  const latest = new Map<string, boolean>();
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    if (!row.some(value => String(value ?? "").trim())) continue;
    const id = String(row[0] || "").trim();
    const key = inventoryKey(row[2], row[3]);
    const action = String(row[4] || "").trim().toUpperCase();
    if (!id || seen.has(id) || key === "|||" || !["ARCHIVE", "RESTORE"].includes(action)) {
      throw new Error("Inventory visibility ledger contains invalid or duplicate entries.");
    }
    seen.add(id);
    latest.set(key, action === "ARCHIVE");
  }
  return new Set([...latest].filter(([, archived]) => archived).map(([key]) => key));
}

export async function readInventoryVisibilityRows(sheets: any, spreadsheetId: string): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${INVENTORY_VISIBILITY_SHEET}!A:G`,
    });
    return (response.data.values || []) as string[][];
  } catch (error: any) {
    const status = Number(error?.response?.status || error?.code);
    const message = String(error?.response?.data?.error?.message || error?.message || "");
    if ((status === 400 || status === 404) &&
      message.includes(INVENTORY_VISIBILITY_SHEET) &&
      /unable to parse range|not found|does not exist/i.test(message)) {
      return [];
    }
    throw error;
  }
}

export function canArchiveInventory(onHand: number, sellable: number, incoming: number) {
  return [onHand, sellable, incoming].every(q => Number.isSafeInteger(q) && q === 0);
}
