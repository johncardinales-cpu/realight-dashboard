import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewDelivery } from "../lib/delivery-create.ts";
import { DELIVERY_HEADERS, deliveryKey } from "../lib/delivery-actions.ts";

const input = {
  uploadDate: "2026-11-20", arrivalDate: "2026-11-27", supplier: "Sample Supplier",
  batchReference: "PO-123", description: "Solar Panel", specification: "550W",
  qtyAdded: "5", unitPriceUsd: "100", invoiceValid: "2026-12-31",
  status: "Incoming", notes: "Initial supplier note",
};

test("new delivery follows the verified 13-column live workbook layout", () => {
  const item = buildNewDelivery(input, "Ordered after warehouse recount", 61);
  assert.equal(DELIVERY_HEADERS.length, 13);
  assert.equal(item.row.length, 13);
  assert.match(String(item.row[0]), /^DEL_/);
  assert.equal(item.row[1], "2026-11-20");
  assert.equal(item.row[2], "Sample Supplier");
  assert.equal(item.row[3], "PO-123");
  assert.equal(item.row[4], "Solar Panel");
  assert.equal(item.row[5], "550W");
  assert.equal(item.row[6], 5);
  assert.equal(item.row[7], "pc");
  assert.equal(item.row[8], 100 * 61);
  assert.equal(item.row[9], "Incoming");
  assert.equal(item.row[10], "2026-11-27");
  assert.equal(item.row[11], "");
  assert.match(String(item.row[12]), /Ordered after warehouse recount/);
  assert.match(String(item.row[12]), /Invoice valid: 2026-12-31/);
  assert.equal(deliveryKey(item.row), item.key);
});

test("received deliveries populate received date and are sellable as Available", () => {
  const item = buildNewDelivery({ ...input, status: "Received" }, "Received stock at warehouse", 61);
  assert.equal(item.status, "Available");
  assert.match(String(item.row[11]), /^\d{4}-\d{2}-\d{2}$/);
});

test("all new deliveries require an action note and validated quantity", () => {
  assert.throws(() => buildNewDelivery(input, "short", 61), /note/);
  assert.throws(() => buildNewDelivery({ ...input, qtyAdded: "-2" }, "Supplier entry correction", 61), /positive/);
  assert.throws(() => buildNewDelivery({ ...input, qtyAdded: "2.5" }, "Supplier entry correction", 61), /positive/);
  assert.throws(() => buildNewDelivery({ ...input, status: "Mystery" }, "Supplier entry correction", 61), /Unknown/);
});

test("FX conversion is explicit and supports per-product pricing rates", () => {
  assert.throws(() => buildNewDelivery(input, "Product cost update"), /FX rate is required/);
  assert.equal(buildNewDelivery(input, "Product cost update", 58.16).row[8], 5816);
  assert.equal(buildNewDelivery(input, "Product cost update", 91).row[8], 9100);
  assert.equal(buildNewDelivery(input, "Product cost update", 61).row[8], 6100);
});
