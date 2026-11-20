import { test } from "node:test";
import assert from "node:assert/strict";
import { archivedInventoryKeys, canArchiveInventory, INVENTORY_VISIBILITY_HEADERS } from "../lib/inventory-visibility.ts";

const hdr = [...INVENTORY_VISIBILITY_HEADERS];
test("archive is reversible and original records remain independent", () => {
  const events = [hdr,
    ["ev1", "", "Panel", "550W", "ARCHIVE", "Discontinued", "admin"],
    ["ev2", "", "Panel", "550W", "RESTORE", "Relisted panel", "admin"],
  ];
  assert.equal(archivedInventoryKeys(events).size, 0);
  assert.deepEqual(events[1][4], "ARCHIVE");
});

test("archived products stay archived until a valid restore event", () => {
  const rows = [hdr,
    ["ev1", "", "Panel", "550W", "ARCHIVE", "Duplicate product", "admin"],
    ["ev2", "", "Cable", "5m", "RESTORE", "Restored cable", "admin"],
  ];
  assert.equal(archivedInventoryKeys(rows).has("Panel|||550W"), true);
  assert.equal(archivedInventoryKeys(rows).has("Cable|||5m"), false);
});

test("archiving requires zero on-hand, sellable and incoming stock", () => {
  assert.equal(canArchiveInventory(0, 0, 0), true);
  assert.equal(canArchiveInventory(2, 2, 0), false);
  assert.equal(canArchiveInventory(0, 0, 1), false);
  assert.equal(canArchiveInventory(-1, -1, 0), false);
});

test("invalid visibility ledger and duplicate IDs fail closed", () => {
  assert.throws(() => archivedInventoryKeys([["wrong", ...hdr.slice(1)]]), /headers/);
  assert.throws(() => archivedInventoryKeys([hdr,
    ["id", "", "Panel", "550W", "ARCHIVE", "", ""],
    ["id", "", "Panel", "550W", "RESTORE", "", ""],
  ]), /invalid or duplicate/);
});
