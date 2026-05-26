# Restore Point: Before AI Agents

Created for: Realights POS AI Agents rollout
Date: 2026-05-26
Time zone: Asia/Manila
Purpose: Safe recovery marker before adding the Realights POS agent layer.

## Protected baseline

This restore point was created before adding the following agents:

1. Main POS Assistant Agent
2. Inventory Agent
3. Customer History Agent
4. Supplier History Agent
5. App Guardian Agent
6. Data Audit Agent
7. Testing / QA Agent

## Known baseline files checked

- `package.json`
  - Project: `realight-dashboard`
  - Framework: Next.js `16.2.4`
  - React: `19.2.4`
  - Build command: `next build`
  - Lint command: `eslint`

- `app/page.tsx`
  - Dashboard loads `/api/dashboard`
  - Recent activity loads `/api/recent-activity`
  - No AI agent test panel connected before this restore point

- `app/api/dashboard/route.ts`
  - Uses Google Sheets read-only scope
  - Reads dashboard data from deliveries, sales, expenses, and supplier cost sheets

## Rollback guidance

If the agent rollout causes problems, revert the commits after this restore point and redeploy the previous stable version on Vercel.

The agent rollout must stay safe-mode first:

- No automatic database writes
- No automatic inventory mutation
- No automatic sales/payment changes
- No automatic supplier/customer record mutation
- No automatic deployment, rollback, or restore
- No secret exposure
- All agent output is advisory unless explicitly approved by admin

## Recovery note

This markdown file is not a full database or Google Sheets backup. It is a codebase restore marker and rollout checkpoint. Google Sheet / database backups must be handled separately through the production data backup process.
