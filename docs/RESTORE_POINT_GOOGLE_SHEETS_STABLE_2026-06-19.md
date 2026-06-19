# Realights POS Restore Point - Google Sheets Stable Version

Date created: 2026-06-19
Purpose: Safe restore marker for the current Google Sheets production-ready version before any future Supabase migration, domain/security changes, or large feature changes.

## Restore Command Phrase

If the owner says any of the following, restore to this point:

- restore google sheets stable
- restore sheets stable version
- rollback to sheets production ready
- restore before supabase
- return to the google sheets restore point

## Code Restore Point

Repository: johncardinales-cpu/realight-dashboard
Restore commit SHA: ffc3a5ef42b108f16a3696fdacd7fae0ca0a23e7
Commit message: align users page with admin role plan

Deployment status at checkpoint:

- realight-dashboard-ffzb: success
- realight-dashboard: success
- realight-corp-dashboard: success

This restore point preserves the app/code state after the Google Sheets version was stabilized and before Supabase migration is resumed.

## What this code restore point includes

- Dashboard aligned to Reports and Payments open balances
- Reports daily, weekly, monthly, and selected-date filtering
- Reports PDF, Excel, and CSV export helper
- Reports collections timing audit
- Reports collections breakdown with linked order/customer details in a scroll box
- Reports customer charges subtotal wording
- Reports product movement separated from customer-billed delivery/installation/other charges
- Sales payment summary with reconciled paid and balance totals
- Invoice preview with partial payment and balance support
- Confirm Sales preserving partial balances and deducting inventory only on confirmation
- Payments page open balances and installment/final payment flow
- Payment/installment history with initial sale payment and payment activity records
- Void sale/payment control restored for draft/blocked orders
- Users and Settings pages prepared for future Admin, Accounting, and Cashier role setup
- Current access model: single Admin only until Supabase Auth is connected

## Current Production Rule

This is the stable Google Sheets version. Keep using Google Sheets as the live data source for now:

- Sales
- Payments
- Reports
- Dashboard
- Inventory
- Incoming deliveries
- Customers
- Expenses
- Audit log

Do not add large new modules to this version. Keep changes limited to small bug fixes, wording, print/export cleanup, and backup improvements.

## Data Restore Reminder

GitHub restore protects source code only. It does not restore live Google Sheets data.

Before any major change, make a copy/export of these live Google Sheets tabs:

- Sales
- Payments
- Expenses
- Incoming Deliveries / App_Deliveries
- Inventory
- Pricing / Pricing_Base
- Customers
- Audit_Log
- Settings or migration-related tabs, if present

## Recommended Backup Routine

Daily, during active testing:

1. Export Reports as PDF, Excel, and CSV for the selected day.
2. Avoid unnecessary repeated refreshes to reduce Google Sheets quota pressure.
3. Keep screenshot proof for important final payment and receivable-zero tests.

Weekly, before closing the week:

1. Make a duplicate copy of the full Google Sheet workbook.
2. Name it using this format: `Realights_Backup_YYYY-MM-DD`.
3. Export Reports weekly and monthly summaries as Excel and PDF.
4. Confirm Dashboard totals match Reports before relying on the backup.

## Manual Code Restore Steps

Option A - Commit restore:

1. Restore the project to commit: ffc3a5ef42b108f16a3696fdacd7fae0ca0a23e7.
2. Redeploy Vercel.
3. Open the app and verify Dashboard, Sales, Confirm Sales, Payments, Reports, Users, and Settings.

Option B - File restore:

1. Use GitHub history to restore files from this checkpoint.
2. Redeploy Vercel.
3. Verify that Reports exports, Payments, Receivables, and Dashboard totals are still aligned.

## Data Restore Steps

1. Open the saved Google Sheets backup copy.
2. Restore only the needed tab or rows to the live sheet.
3. Confirm headers remain unchanged.
4. Refresh the app once.
5. Verify these totals:
   - Dashboard Sales
   - Dashboard Collections
   - Dashboard Receivables
   - Reports Sales Detail
   - Reports Open Receivables
   - Payments Open Balances

## Important Warning

Do not rely on code restore alone if live spreadsheet rows were changed. Code restore and data restore are separate.

Supabase migration can still happen later, but this checkpoint should remain the clean fallback version while Google Sheets is the live database.
