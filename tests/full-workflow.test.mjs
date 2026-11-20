import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdjustedQty, currentStockForItem, summarizeOnHand,
  STOCK_ADJUSTMENT_HEADERS,
} from "../lib/stock-adjustments.ts";
import {
  DELIVERY_ACTION_HEADERS, deliveryKey, removedDeliveryKeys,
} from "../lib/delivery-actions.ts";
import {
  INVENTORY_VISIBILITY_HEADERS, archivedInventoryKeys, canArchiveInventory,
} from "../lib/inventory-visibility.ts";

const delivery = (id, qty, status) => [
  id, "2026-11-20", "Vendor", "PO-2026", "Solar Panel", "550W",
  String(qty), "pc", "7500", status, "2026-11-27", "", "",
];
const sale = (qty) => {
  const row = Array(21).fill("");
  row[3] = "Solar Panel";
  row[4] = "550W";
  row[5] = String(qty);
  row[20] = "Confirmed";
  return row;
};
const adjustment = (id, before, delta, after) => [
  id, "2026-11-20T08:00:00Z", "Solar Panel", "550W",
  String(before), String(delta), String(after), "Count discrepancy", "admin@example.com", "",
];

test("stock, sales and dashboard remain reconciled after +5, -4, and canceled-delivery removal", () => {
  const available = delivery("DL-1", 20, "Available");
  const canceled = delivery("DL-2", 8, "Cancelled");
  const incoming = delivery("DL-3", 6, "Incoming");
  const deliveries = [[], available, canceled, incoming];
  const sales = [[], sale(3)];
  let ledger = [[...STOCK_ADJUSTMENT_HEADERS]];
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 17);

  const added = calculateAdjustedQty(17, "delta", 5);
  assert.deepEqual(added, { targetQty: 22, deltaQty: 5 });
  ledger.push(adjustment("ADJ-1", 17, 5, 22));
  const removed = calculateAdjustedQty(22, "delta", -4);
  assert.deepEqual(removed, { targetQty: 18, deltaQty: -4 });
  ledger.push(adjustment("ADJ-2", 22, -4, 18));

  const sourceQty = currentStockForItem(deliveries, sales, ledger, "Solar Panel", "550W");
  assert.equal(sourceQty.displayQty, 18);
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 18);
  const hiddenRows = [
    [...DELIVERY_ACTION_HEADERS],
    ["DEL-ACT-1", "2026-11-20T08:30:00Z", deliveryKey(canceled), "3",
      "REMOVE_CANCELLED", "Cancelled", "Cancelled", "Canceled after supplier cancellation", "admin@example.com"],
  ];
  assert.equal(removedDeliveryKeys(hiddenRows).has(deliveryKey(canceled)), true);
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 18, "Hiding canceled shipment must not change stock");

  const restored = [...hiddenRows, ["DEL-ACT-2", "2026-11-20T09:00:00Z", deliveryKey(canceled), "3",
    "RESTORE_CANCELLED", "Cancelled", "Cancelled", "Restored for documentation", "admin@example.com"]];
  assert.equal(removedDeliveryKeys(restored).has(deliveryKey(canceled)), false);
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 18);
});

test("archiving at zero is non-destructive and a restore never fabricates stock", () => {
  const deliveries = [[], delivery("DL-1", 10, "Available")];
  const sales = [[], sale(4)];
  const corrected = calculateAdjustedQty(6, "set", 0);
  assert.deepEqual(corrected, { targetQty: 0, deltaQty: -6 });
  const ledger = [[...STOCK_ADJUSTMENT_HEADERS], adjustment("ADJ-3", 6, -6, 0)];
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 0);
  assert.equal(canArchiveInventory(0, 0, 0), true);
  const history = [
    [...INVENTORY_VISIBILITY_HEADERS],
    ["VIS-1", "2026-11-20T10:00:00Z", "Solar Panel", "550W", "ARCHIVE",
      "Obsolete stock entry", "admin@example.com"],
  ];
  assert.equal(archivedInventoryKeys(history).has("Solar Panel|||550W"), true);
  history.push(["VIS-2", "2026-11-20T11:00:00Z", "Solar Panel", "550W", "RESTORE",
    "Reactivated product", "admin@example.com"]);
  assert.equal(archivedInventoryKeys(history).size, 0);
  assert.equal(summarizeOnHand(deliveries, sales, ledger), 0, "Restore must not change physical stock");
  assert.equal(deliveries[1][6], "10", "Original supplier delivery preserved");
  assert.equal(sales[1][5], "4", "Confirmed sale preserved");
});
