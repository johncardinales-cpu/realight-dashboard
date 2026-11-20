import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING_HEADERS, prepareDeliveryPricing } from "../lib/delivery-pricing.ts";

const headers = [...PRICING_HEADERS];
const old = ["ITEM-OLD", "Solar Panel", "550W", "Solar Panel", "pc", "100", "58", "5800", "9000", "8000", "7600", "0.35", "Active", "Old note"];
const panel = { description: "Solar Panel", specification: "550W", unitPriceUsd: "110", batchReference: "PO-1", status: "Incoming" };
const battery = { description: "Battery", specification: "48V", unitPriceUsd: "200", batchReference: "PO-2", status: "Available" };
const actor = "test-admin@example.com";
const stamp = "2026-11-20T07:00:00.000Z";

function prepared(deliveries, rates, existing=[headers,old]) {
  let counter=0;
  return prepareDeliveryPricing(deliveries, rates, existing, 15, 16, actor,
    "Supplier invoice cost reconciliation", stamp, () => "TEST"+(++counter));
}

test("import prepares pricing changes and audit in the same batch, preserving selling prices", () => {
  const out = prepared([panel,battery],[61,59]);
  assert.deepEqual({created:out.created,updated:out.updated,audited:out.audited},{created:1,updated:1,audited:2});
  const updatedColumns = out.requests.filter(r => "updateCells" in r)
    .map(r => r.updateCells.start.columnIndex).sort((a,b)=>a-b);
  assert.deepEqual(updatedColumns,[5,6,7,11,13]);
  const price = out.requests.find(r => "updateCells" in r && r.updateCells.start.columnIndex===7);
  assert.equal(price.updateCells.rows[0].values[0].userEnteredValue.numberValue,6710);
  const appended = out.requests.filter(r => "appendCells" in r);
  assert.equal(appended.filter(r=>r.appendCells.sheetId===15).length,1);
  assert.equal(appended.filter(r=>r.appendCells.sheetId===16).length,2);
  assert.equal(appended.find(r=>r.appendCells.sheetId===15).appendCells.rows[0].values[12].userEnteredValue.stringValue,"Pending Pricing");
});

test("canceled deliveries never change supplier pricing", () => {
  const out=prepared([{...panel,status:"Cancelled"}],[61]);
  assert.equal(out.requests.length,0);
  assert.equal(out.updated,0);
});

test("a delivery without new cost preserves existing price and FX rate", () => {
  const out=prepared([{...panel,unitPriceUsd:""}],[58]);
  assert.equal(out.requests.length,0);
});

test("repeated SKU in a batch updates pricing once, using latest supplied cost", () => {
  const out=prepared([panel,{...panel,unitPriceUsd:"115",batchReference:"PO-2"}],[61,62]);
  assert.equal(out.updated,1);
  const price=out.requests.find(r=>"updateCells" in r && r.updateCells.start.columnIndex===7);
  assert.equal(price.updateCells.rows[0].values[0].userEnteredValue.numberValue,7130);
  assert.equal(out.requests.filter(r=>"appendCells" in r && r.appendCells.sheetId===16).length,1);
});

test("wrong pricing headers, duplicate SKU records and missing actor fail before writes", () => {
  assert.throws(() => prepared([panel],[61],[["Wrong",...headers.slice(1)],old]), /columns differ/);
  assert.throws(() => prepared([panel],[61],[headers,old,old]), /duplicate products/);
  assert.throws(() => prepareDeliveryPricing([panel],[61],[headers,old],15,16,"","A note that is sufficient",stamp), /Actor/);
});

test("no FX fallback may be guessed and financial values remain numeric", () => {
  assert.throws(() => prepared([panel],[undefined]),/FX rate/);
  const out=prepared([panel],[59.5]);
  const price=out.requests.find(r=>"updateCells" in r && r.updateCells.start.columnIndex===7);
  assert.equal(price.updateCells.rows[0].values[0].userEnteredValue.numberValue,6545);
});

test("user-entered action notes are always plain strings, never Sheet formulas", () => {
  const out=prepareDeliveryPricing([panel],[61],[headers,old],15,16,actor,
    "=SUM(1,1) supplier invoice issue",stamp,()=> "TESTID");
  const notes=out.requests.find(r=>"updateCells" in r && r.updateCells.start.columnIndex===13);
  assert.ok(notes.updateCells.rows[0].values[0].userEnteredValue.stringValue.includes("=SUM(1,1)"));
  assert.ok(!("formulaValue" in notes.updateCells.rows[0].values[0].userEnteredValue));
});
