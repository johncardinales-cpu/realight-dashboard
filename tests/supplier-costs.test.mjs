import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isBillableSupplierDelivery } from "../lib/supplier-costs.ts";

const row=(status,qty=10,supplier="Vendor",batch="PO-1") =>
  ["DL-1","2026-11-20",supplier,batch,"Panel","550W",String(qty),"pc","6000",status,"","",""];

test("supplier invoice estimates exclude canceled and internal damage rows", () => {
  assert.equal(isBillableSupplierDelivery(row("Available",10)),true);
  assert.equal(isBillableSupplierDelivery(row("Incoming",10)),true);
  assert.equal(isBillableSupplierDelivery(row("Damaged",10)),true);
  assert.equal(isBillableSupplierDelivery(row("Cancelled",10)),false);
  assert.equal(isBillableSupplierDelivery(row("Canceled",10)),false);
  assert.equal(isBillableSupplierDelivery(row("Damaged",4,"DAMAGE","Dashboard Adjustment")),false);
  assert.equal(isBillableSupplierDelivery(row("Available",-1)),false);
});

test("supplier invoice POST now requires a signed session and paired audit records", () => {
  const source=readFileSync(new URL("../app/api/supplier-invoice-costs/route.ts",import.meta.url),"utf8");
  assert.match(source,/readSession/);
  assert.match(source,/pricingReason/);
  assert.match(source,/Audit_Log/);
  assert.match(source,/batchUpdate/);
  assert.match(source,/isBillableSupplierDelivery/);
});

test("legacy Pricing Base editor routes to the only audited pricing UI", () => {
  const page=readFileSync(new URL("../app/pricing-base/page.tsx",import.meta.url),"utf8");
  assert.match(page,/redirect\("\/pricing"\)/);
});
