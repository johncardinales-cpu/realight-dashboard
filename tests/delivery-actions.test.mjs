import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_HEADERS, DELIVERY_ACTION_HEADERS, deliveryKey, removedDeliveryKeys,
  normalizeDeliveryStatus, verifyDeliveryHeaders, isDeliveryRow,
  validDeliveryNote, validDeliveryTransition,
} from "../lib/delivery-actions.ts";

const headers = [...DELIVERY_HEADERS];
const actionHeaders = [...DELIVERY_ACTION_HEADERS];
const one = ["DL-001", "2026-11-20", "Supplier", "PO-A", "Panel", "550W", "10", "unit", "5000", "Cancelled", "2026-12-01", "", "Supplier cancellation"];
const two = ["DL-001", "2026-11-20", "Supplier", "PO-A", "Inverter", "5kW", "2", "unit", "5000", "Cancelled", "2026-12-01", "", ""];
const row = (eventId, key, action, note = "Customer canceled order") => [eventId, "", key, "2", action, "Cancelled", "Cancelled", note, "admin@example.com"];

test("delivery header mapping matches the verified 13-column live sheet", () => {
  assert.doesNotThrow(() => verifyDeliveryHeaders(headers));
  assert.throws(() => verifyDeliveryHeaders(["Upload Date", ...headers.slice(1)]), /columns differ/);
  assert.equal(one[9], "Cancelled");
  assert.equal(one[10], "2026-12-01");
  assert.equal(one[12], "Supplier cancellation");
});

test("row keys separate supplier items even with duplicated delivery IDs", () => {
  assert.equal(deliveryKey(one).length, 64);
  assert.notEqual(deliveryKey(one), deliveryKey(two));
  assert.equal(deliveryKey([...one]), deliveryKey(one));
  assert.equal(isDeliveryRow([]), false);
});

test("removed canceled deliveries can always be restored without deleting historical events", () => {
  const k = deliveryKey(one);
  const events = [actionHeaders, row("A1", k, "STATUS_CHANGE"),
    row("A2", k, "REMOVE_CANCELLED")];
  assert.equal(removedDeliveryKeys(events).has(k), true);
  events.push(row("A3", k, "RESTORE_CANCELLED"));
  assert.equal(removedDeliveryKeys(events).size, 0);
  assert.equal(events.length, 4);
});

test("a duplicate event or missing required note fails closed", () => {
  const k = deliveryKey(one);
  assert.throws(() => removedDeliveryKeys([actionHeaders, row("X", k, "REMOVE_CANCELLED"), row("X", k, "RESTORE_CANCELLED")]), /Invalid delivery action/);
  assert.throws(() => removedDeliveryKeys([actionHeaders, row("X", k, "REMOVE_CANCELLED", "short")]), /Invalid delivery action/);
  assert.equal(validDeliveryNote("Reason for cancellation"), true);
  assert.equal(validDeliveryNote("x"), false);
  assert.equal(validDeliveryNote("x".repeat(501)), false);
});

test("notes-required status actions, canceled-only remove and safe restore", () => {
  assert.equal(normalizeDeliveryStatus("received"), "Available");
  assert.equal(normalizeDeliveryStatus("cancelled"), "Cancelled");
  assert.throws(() => normalizeDeliveryStatus("invalid-status"), /Unknown/);
  assert.equal(validDeliveryTransition("STATUS_CHANGE", "Incoming", "Cancelled", false), true);
  assert.equal(validDeliveryTransition("STATUS_CHANGE", "Incoming", "Incoming", false), false);
  assert.equal(validDeliveryTransition("REMOVE_CANCELLED", "Available", "Available", false), false);
  assert.equal(validDeliveryTransition("REMOVE_CANCELLED", "Cancelled", "Cancelled", false), true);
  assert.equal(validDeliveryTransition("RESTORE_CANCELLED", "Cancelled", "Cancelled", true), true);
  assert.equal(validDeliveryTransition("RESTORE_CANCELLED", "Cancelled", "Cancelled", false), false);
});
