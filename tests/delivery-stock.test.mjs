import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryStockImpact, statusChangeStockDelta, wouldOversellStock } from "../lib/delivery-stock.ts";

const delivery = (status, qty=10, supplier="Supplier", batch="PO-A") => [
  "DL-1", "2026-11-20", supplier, batch, "Panel", "550W", String(qty), "pc", "100", status, "", "", ""
];

test("incoming and cancelled deliveries do not change sellable units", () => {
  assert.deepEqual(deliveryStockImpact(delivery("Incoming")), { incoming: 10, available: 0, damaged: 0 });
  assert.deepEqual(deliveryStockImpact(delivery("Cancelled")), { incoming: 0, available: 0, damaged: 0 });
});

test("availability contributes stock once and dashboard damage subtracts once", () => {
  const before=deliveryStockImpact(delivery("Available"));
  const damage=deliveryStockImpact(delivery("Damaged", 4, "DAMAGE", "Dashboard Adjustment"));
  assert.equal(before.available, 10);
  assert.equal(damage.available, -4);
  assert.equal(before.available+damage.available,6);
});

test("damaged or cancelled supplier arrivals do not create negative stock", () => {
  assert.deepEqual(deliveryStockImpact(delivery("Damaged")), { incoming: 0, available: 0, damaged: 10 });
  assert.equal(deliveryStockImpact(delivery("Available")).available - deliveryStockImpact(delivery("Damaged")).available,10);
});

test("invalid negative and non-numeric delivery quantities fail closed", () => {
  assert.throws(()=>deliveryStockImpact(delivery("Incoming", -1)), /invalid/);
  assert.throws(()=>deliveryStockImpact(delivery("Incoming", "not a number")), /invalid/);
});

test("changing an Available supplier shipment to Canceled or Damaged removes only the original available quantity", () => {
  assert.equal(statusChangeStockDelta(delivery("Available", 10), "Cancelled"), -10);
  assert.equal(statusChangeStockDelta(delivery("Available", 10), "Damaged"), -10);
  assert.equal(statusChangeStockDelta(delivery("Incoming", 10), "Available"), 10);
  assert.equal(statusChangeStockDelta(delivery("Cancelled", 10), "Cancelled"), 0);
});

test("canceling already-sold stock fails without sufficient remaining units", () => {
  assert.equal(wouldOversellStock(5, -10), true);
  assert.equal(wouldOversellStock(15, -10), false);
  assert.equal(wouldOversellStock(0, 5), false);
});
