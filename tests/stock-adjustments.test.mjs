import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustmentDeltas, currentStockForItem, summarizeOnHand, calculateAdjustedQty } from "../lib/stock-adjustments.ts";

const header = ["Adjustment ID", "Created At", "Description", "Specification", "Before Qty", "Delta Qty", "After Qty", "Reason", "Actor", "Reference"];
const delivery = ["", "", "", "", "Panel", "550W", "50", "", "", "Available", "", ""];
const sale = ["", "", "", "Panel", "550W", "5", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Confirmed"];

test("normal stock uses deliveries less confirmed sales", () => {
  const result = currentStockForItem([[], delivery], [[], sale], [], "Panel", "550W");
  assert.equal(result.displayQty, 45);
  assert.equal(result.found, true);
});

test("correction changes quantity without mutating delivery or sales", () => {
  const adjustments = [header, ["ADJ-1", "2026-11-20T00:00:00Z", "Panel", "550W", "45", "-3", "42", "Physical count", "admin", ""]];
  assert.equal(currentStockForItem([[], delivery], [[], sale], adjustments, "Panel", "550W").displayQty, 42);
  assert.equal(summarizeOnHand([[], delivery], [[], sale], adjustments), 42);
  assert.equal(delivery[6], "50");
  assert.equal(sale[5], "5");
});

test("multiple adjustments accumulate with positive and negative deltas", () => {
  const adjustments = [header,
    ["ADJ-1", "", "Panel", "550W", "45", "-3", "42", "Physical count", "admin", ""],
    ["ADJ-2", "", "Panel", "550W", "42", "2", "44", "Stock located", "admin", ""],
  ];
  assert.equal(adjustmentDeltas(adjustments).get("Panel|||550W"), -1);
  assert.equal(currentStockForItem([[], delivery], [[], sale], adjustments, "Panel", "550W").displayQty, 44);
});

test("invalid ledger rows fail closed rather than silently showing wrong stock", () => {
  assert.throws(() => adjustmentDeltas([header, ["ADJ-INVALID", "", "Panel", "550W", "45", "oops", "45"]]), /invalid row/);
});

test("new unrecognized product cannot be adjusted", () => {
  const value = currentStockForItem([[], delivery], [[], sale], [], "Inverter", "5kW");
  assert.equal(value.found, false);
  assert.equal(value.displayQty, 0);
});

test("signed -4 removes four units and +5 adds five", () => {
  assert.deepEqual(calculateAdjustedQty(20, "delta", -4), { targetQty: 16, deltaQty: -4 });
  assert.deepEqual(calculateAdjustedQty(20, "delta", 5), { targetQty: 25, deltaQty: 5 });
});

test("absolute mode preserves the physical-count workflow", () => {
  assert.deepEqual(calculateAdjustedQty(20, "set", 17), { targetQty: 17, deltaQty: -3 });
});

test("quantity correction cannot make stock negative or zero-out by accident", () => {
  assert.throws(() => calculateAdjustedQty(3, "delta", -4), /invalid stock/);
  assert.throws(() => calculateAdjustedQty(5, "delta", 0), /nonzero/);
  assert.throws(() => calculateAdjustedQty(5, "set", 5), /does not change/);
  assert.throws(() => calculateAdjustedQty(2, "delta", 1.5), /whole-number/);
});
