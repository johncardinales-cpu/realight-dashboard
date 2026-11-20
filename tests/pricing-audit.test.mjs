import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUDIT_HEADERS, pricingReason, moneyNumber, priceCells,
  pricingCellUpdate, pricingAuditEvent,
} from "../lib/audited-pricing.ts";

test("pricing writes require specific action notes and valid money inputs", () => {
  assert.equal(pricingReason("Confirmed supplier invoice"), "Confirmed supplier invoice");
  assert.throws(() => pricingReason("short"), /action note/);
  assert.throws(() => pricingReason("x".repeat(501)), /action note/);
  assert.equal(moneyNumber("125.456"), 125.46);
  assert.throws(() => moneyNumber("-1"), /nonnegative/);
  assert.throws(() => moneyNumber("broken"), /nonnegative/);
});

test("pricing Sheets mutation targets only the intended cell", () => {
  const req = pricingCellUpdate(42, 12, 6, 59.5).updateCells;
  assert.deepEqual(req.start, {sheetId: 42,rowIndex:11,columnIndex:6});
  assert.equal(req.rows[0].values[0].userEnteredValue.numberValue, 59.5);
  assert.equal(req.fields, "userEnteredValue");
});

test("pricing values are plain text or numeric values, never executed as formulas", () => {
  const r = priceCells(["=IMPORTRANGE(\"x\",\"y\")", 12.5]);
  assert.ok(r.values[0].userEnteredValue.stringValue.startsWith("="));
  assert.equal(r.values[1].userEnteredValue.numberValue, 12.5);
  assert.ok(!("formulaValue" in r.values[0].userEnteredValue));
});

test("each pricing change carries actor, reason and before/after in audit row", () => {
  assert.equal(AUDIT_HEADERS.length, 10);
  const event = pricingAuditEvent(75, "BULK_FX", "ITEM-5", "Solar Panel / 550W",
    "admin@example.com", "FX update from bank notice",
    {fxRate:58}, {fxRate:60}, "2026-11-20T00:00:00Z");
  const values = event.appendCells.rows[0].values.map(v=>v.userEnteredValue.stringValue);
  assert.equal(event.appendCells.sheetId, 75);
  assert.equal(values[2], "Pricing");
  assert.equal(values[3], "BULK_FX");
  assert.equal(values[6], "admin@example.com");
  assert.equal(values[7], "FX update from bank notice");
  assert.deepEqual(JSON.parse(values[8]),{fxRate:58});
  assert.deepEqual(JSON.parse(values[9]),{fxRate:60});
});

test("dangerous pricing cleanup endpoint has no destructive calls", () => {
  const code = readFileSync(new URL("../app/api/pricing-base/cleanup/route.ts", import.meta.url),"utf8");
  assert.match(code, /status: 410/);
  assert.doesNotMatch(code,/spreadsheets\.values\.(clear|update)/);
  assert.doesNotMatch(code,/spreadsheets\.batchUpdate/);
});

test("manual and bulk pricing routes require audit and action notes", () => {
  for (const path of [
    "../app/api/pricing-base/route.ts",
    "../app/api/pricing-base/bulk-fx/route.ts",
    "../app/api/pricing-base/bulk-margin/route.ts",
  ]) {
    const source=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.match(source,/pricingAuditEvent/);
    assert.match(source,/pricingReason/);
    assert.match(source,/batchUpdate/);
    assert.match(source,/readSession/);
  }
});
