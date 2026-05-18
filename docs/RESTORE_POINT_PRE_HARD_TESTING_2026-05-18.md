# Realights POS Restore Point - Pre Hard Testing

Date created: 2026-05-18
Purpose: Safe restore marker before final hard testing, reset, supplier CSV import testing, customer/sales/payment/expenses testing, reports testing, and user familiarization.

## Restore Command Phrase

If the owner says any of the following, restore to this point:

- restore pre-hard-testing
- restore before hard testing
- rollback to pre hard testing
- restore the system before testing
- return to the restore point

## Code Restore Point

Repository: johncardinales-cpu/realight-dashboard
Backup branch: backup/pre-hard-testing-2026-05-18
Restore commit SHA: 5a7458c7fd77ed0cc52013580e9ddaba15c56eb2
Commit message: Make expense form fields full width

This branch preserves the app/code state immediately before hard testing.

## What this code restore point includes

- Sales UI cleanup with minimal helper text
- Customer auto-suggest inside Sales
- Customer ID saved in Sales records
- Sales charges/tax/discount/grand total support
- Payments using Grand Total balance logic
- Reports detailed accounting backend
- Reports linked expenses logic
- Expenses Base Amount, Tax/VAT/Fee, and Total Amount fields
- Expenses full-width form fields
- Admin navigation grouping/protection work
- AI assistant scope limited to receipts/expenses/customer documents
- Migration readiness improvements

## Data Restore Reminder

GitHub restore protects source code only. It does not restore live Google Sheets data.

Before hard testing, export or copy these sheets/files:

- Sales
- Payments
- Expenses
- Incoming Deliveries / App_Deliveries
- Pricing / Pricing_Base
- Customers
- Audit_Log
- Migration Manifest

Hard testing data pack files created in chat:

- Realights_POS_Pre_Hard_Testing_Backup_and_QA_Pack.xlsx
- Supplier_A_BlueSun_Import_Deliveries_Test.csv
- Supplier_B_SolarPro_Import_Deliveries_Test.csv

## Manual Code Restore Steps

Option A - GitHub branch restore:
1. Open GitHub repository.
2. Switch to branch: backup/pre-hard-testing-2026-05-18.
3. Create a new branch from it or compare it against main.
4. Restore/merge the required files back to main.
5. Redeploy Vercel.

Option B - Commit restore:
1. Restore the project to commit: 5a7458c7fd77ed0cc52013580e9ddaba15c56eb2.
2. Redeploy Vercel.

## Data Restore Steps

1. Open the saved Google Sheets backup/export files.
2. Restore each needed tab back to the live sheet.
3. Confirm headers remain correct.
4. Refresh the app.
5. Verify Migration Readiness, Inventory, Sales, Payments, Expenses, Reports, and Audit_Log.

## Important Warning

Do not rely on code restore alone if hard testing changed live spreadsheet rows. Code restore and data restore are separate.

## Hard Testing Start Point

Begin hard testing only after:

- This code restore point exists
- Google Sheets data backup/export is complete
- Supplier A and Supplier B CSV test files are saved
- QA workbook is downloaded and available
