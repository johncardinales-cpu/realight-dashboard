# REALIGHTS SOLAR — Inventory and Delivery Operating Controls

**Scope:** Inventory, Incoming Deliveries, supplier receiving, sales stock checks, supplier cost synchronization, audit logs, and the two read-only integrity agents.

## 1. Inventory count correction
- Open **Inventory → Adjust Qty** on the correct product and specification.
- Select **Change by (+/−)** to remove units with `-4` or add units with `+5`, or **Set Final Qty** after a physical count.
- Verify the displayed before/delta/after values, record a specific reason, and re-enter the admin access code.
- A successful save adds an entry to `Stock_Adjustments` and a matching `Audit_Log` record in one Sheets batch.
- The formula is: **available delivery stock − confirmed sales − recorded stock damage + signed adjustments**.
- This does not change supplier delivery quantities or historical sales. Never use stock corrections to conceal a sales reversal or unauthorized disposal.

## 2. Archive or restore an inventory product
- Archive only when on-hand/sellable and incoming quantities are all zero.
- Archive hides the product from the normal list; it never deletes the supplier, customer, sales, payment, or audit records.
- Use **Archived → Restore** to make it visible again. Restoring does **not** fabricate stock.
- The action requires an admin code and reason, with events in `Inventory_Visibility` and `Audit_Log`.
- If the visibility sheet does not exist, it is created on the first authorized archive event.

## 3. Canceled incoming delivery
- **Cancel status** is a stock status and removes previously available supplier units only if sufficient stock exists for confirmed sales.
- **Remove canceled** only hides an already-canceled delivery from the active list. Stock does not change at removal time.
- Under the **Removed** filter, use **Restore** to show the canceled delivery again. Restoring list visibility does not receive new stock.
- All status changes (single/bulk), remove and restore require a note. Admin re-authorization is required to remove or restore.
- Delivery source rows remain in `App_Deliveries`. The action is recorded in `Delivery_Actions`, `Audit_Log` and the delivery's Notes column M.
- Multiple rows changed in a batch record a corresponding action event for each row.

## 4. Receiving, damage and supplier costs
- **Incoming** is not sellable. **Available** adds received stock; **Cancelled** adds none.
- Supplier-damaged arrivals add no sellable stock. Explicit, authorized dashboard damage events subtract damaged units from available stock.
- Date edits update only expected arrival (K) or received date (L); notes are appended to M and action/audit rows.
- Add Delivery and CSV Import use the verified 13-column `App_Deliveries` schema.
- When a supplier cost is provided in USD, the importer uses the product's verified `Pricing_Base` FX rate or an explicitly entered positive PHP-per-USD rate. No single hard-coded rate is assumed.
- New imported products remain **Pending Pricing** until selling/dealer/minimum prices are reviewed. Existing selling/dealer/minimum prices are not overwritten by supplier cost changes.
- Starting with the full-workflow integrity release, delivery rows, corresponding delivery action/audit entries, pricing cost updates and pricing audit entries are committed in **one Google Sheets batch**. If preparing the pricing update fails, none of those business rows is appended by the import request.

## 5. Required audit fields
For all **new actions in this workflow**, logs must preserve an event ID, timestamp, action type, product/delivery reference, actor, reason/note, and before/after information where applicable.

| Event | Append-only source | Audit action |
| --- | --- | --- |
| Adjust quantity | Stock_Adjustments | Inventory / ADJUST_QTY |
| Archive or restore SKU | Inventory_Visibility | Inventory / ARCHIVE or RESTORE |
| Change delivery status | Delivery_Actions; App_Deliveries M | Incoming Deliveries / STATUS_CHANGE |
| Remove or restore canceled delivery | Delivery_Actions; App_Deliveries M | Incoming Deliveries / REMOVE_CANCELLED or RESTORE_CANCELLED |
| Add or import delivery | App_Deliveries; Delivery_Actions | Incoming Deliveries / CREATE_DELIVERY or IMPORT_DELIVERY |
| Mark damaged or adjust dates | App_Deliveries; Delivery_Actions | Incoming Deliveries / MARK_DAMAGED or UPDATE_DATES |
| Supplier price sync | Pricing_Base | Pricing / PRICING_FROM_DELIVERY |

Older actions may be logged under different action names; they are historical evidence, not rewritten to look like new-format entries.

## 6. Reconciliation and monitoring
- **Inventory** and **Dashboard** use the same delivery stock movement rules as the **Sales** stock validation and **Accounting Audit**.
- The inventory-history view includes quantity adjustments and delivery-action events.
- **Inventory Error Watch** and **Delivery Error Watch** are read-only. They detect missing notes/actors/audit matches and malformed event records; they do not repair source data.
- The separate scheduled REALIGHTS error watch reviews Vercel runtime failures and ledger health. It does not act as a distributed lock or replace an accounting review.
- A healthy ledger or no runtime errors cannot verify a physical warehouse count.

## 7. Release and incident response
1. Copy and verify the entire source Google Sheets workbook before consequential deployment or data migration.
2. Run `npm run test:stock`, `npx tsc --noEmit` and a Vercel preview build on the reviewed commit.
3. Never create fake stock, sales or payments in the production workbook as an acceptance test.
4. Confirm the exact Vercel team, project, environment and commit before deployment.
5. After deployment, check Vercel is READY, no new inventory/delivery runtime errors, ledger headers, and summary counts.
6. If an API responds 409, refresh and reconcile instead of blindly retrying.
7. To reverse a mistaken recorded adjustment, enter a **new offsetting adjustment** with a reason; never erase its historical ledger row.
8. For unintended bulk updates or monetary discrepancies, stop further writes and consult the backup plus the original audit events before applying a correction.

## Known limitations and deferred safeguards
- Google Sheets does not implement compare-and-swap on the inventory/delivery ledgers. Two administrators changing the same SKU or row concurrently may race. **Avoid concurrent edits** until server-side serializable transactions or a reliable locking mechanism is introduced.
- Whole-system audit coverage **beyond** these inventory/delivery/pricing workflows is not certified; maintain separate checks for Sales, Payments, Expenses, Users, and Settings.
- Do not permanently delete canceled deliveries or archived products. The original financial and inventory history remains the system of record.
