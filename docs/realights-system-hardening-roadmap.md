# Realights System Hardening Roadmap

Status date: 2026-06-30

## Production rule

Realights is already being used with live data. All future work must be done in safe, incremental steps:

1. Protect live Google Sheets data first.
2. Do not change accounting data through code migrations unless explicitly approved.
3. Prefer read-only audit and warning systems before automatic correction.
4. Every accounting change must be checked against Dashboard, Customers, Payments, and Reports totals.
5. Maintain restore point and rollback notes before major changes.

## Current operating classification

Live Beta / Controlled Production

Estimated overall completion: 82%

The system is usable for operations, but still requires stability hardening, full audit visibility, restore discipline, security roles, and QA polish before it should be considered fully production-grade.

## Completion matrix

| Area | Current status | Estimate | Target | Priority |
|---|---:|---:|---:|---:|
| Dashboard | Working | 85% | 95% | High |
| Sales entry | Working | 85% | 95% | High |
| Inventory deduction / stock guard | Working | 80% | 95% | High |
| Customers page | Working | 85% | 95% | High |
| Customer charges | Working | 85% | 95% | High |
| Customer group payments | Recently improved | 85% | 95% | Critical |
| Payment history per customer | Improved, needs cleaner UI | 80% | 95% | Critical |
| Reports | Working after sync fixes, needs audit testing | 78% | 95% | Critical |
| Price fluctuation protection | Logic protected, audit endpoint added | 80% | 95% | High |
| Accounting Audit Agent | Backend added, UI/process needs polish | 70% | 95% | Critical |
| Restore points / rollback | Started | 70% | 95% | Critical |
| Security / user roles / permissions | Basic | 55% | 90% | High |
| Overall polish / QA | Ongoing | 70% | 95% | High |

## Phase 1: live-data protection and stability

Target: raise system from 82% to 88%.

Tasks:

- Reduce Google Sheets read pressure and quota errors.
- Add practical cache or request consolidation for read-heavy pages.
- Add clearer loading and error messages when Google quota is reached.
- Confirm latest Vercel deployment remains READY after each change.
- Add clear audit warning if Dashboard, Customers, Payments, and Reports do not match.

Acceptance checks:

- No new live data write behavior is introduced.
- Payments, Customers, Reports, and Dashboard still reconcile.
- System remains usable during live entry.

## Phase 2: accounting audit and reports hardening

Target: raise Reports and Audit Agent to 90%+.

Tasks:

- Finish visible Accounting Audit Agent panel.
- Add one-click reconciliation status.
- Add customer-level reconciliation: total purchased + charges - payments - credits = balance.
- Add sales-level reconciliation: grand total - paid = balance.
- Add double-count guard for Sales paid vs Payments ledger.
- Add price/cost snapshot audit warnings.
- Improve Reports labels so visible mode always matches loaded data mode.

Acceptance checks:

- Rudy Sulit case reconciles correctly.
- Historical sales remain unaffected by price changes.
- Audit flags mismatch before reports are trusted.

## Phase 3: customer payment UX polish

Target: raise Customer Payments and Payment History to 95%.

Tasks:

- One row per actual payment transaction.
- Expand/collapse allocations inside each transaction.
- Show exact amount paid, applied amount, credit amount, and remaining customer balance.
- Add transaction reference and deposit note clearly.
- Add customer payment printable/exportable view later.

Acceptance checks:

- A group payment of PHP 100,000 appears as one transaction with allocation details.
- Allocations are understandable without duplicated-looking rows.

## Phase 4: inventory and price protection

Target: raise Inventory and Price Protection to 95%.

Tasks:

- Confirm product sale deducts inventory only when sale is confirmed.
- Confirm customer charges do not deduct inventory.
- Add warning if confirmed sold quantity exceeds available stock.
- Keep Pricing_Base as current quote guide only.
- Keep Sales rows as frozen historical transaction snapshots.

Acceptance checks:

- Changing product price affects new sales only.
- Old gross profit and net profit remain stable.
- Audit warns on missing or inconsistent saved cost/price snapshots.

## Phase 5: restore and rollback discipline

Target: raise restore capability to 95%.

Tasks:

- Keep daily restore/checkpoint process.
- Add restore point documents for major changes.
- Add Google Sheet snapshot/export strategy.
- Document rollback target deployment and commit.
- Create manual restore checklist.

Acceptance checks:

- Every major change has a restore note.
- A known good deployment can be identified quickly.

## Phase 6: security and access control

Target: raise security from 55% to 90%.

Tasks:

- Add user roles: Admin, Encoder, Viewer, Auditor.
- Restrict destructive or financial write actions.
- Add approval flow for voiding/cancelling payments.
- Show actor/cashier consistently in audit logs.
- Consider proper authentication provider.

Acceptance checks:

- Not every user can edit payments, sales, or prices.
- Audit log clearly shows who changed what.

## Safe working order

1. Stability/cache/read quota.
2. Accounting audit visible UI.
3. Reports reconciliation hardening.
4. Payment history UX polish.
5. Restore and rollback improvements.
6. User roles and permissions.
7. Full QA pass.

## Current known risk

Google Sheets API read quota can be exceeded when many pages refresh or request full sheets in a short period. This is a stability concern and should be prioritized before heavy data entry volume increases.
