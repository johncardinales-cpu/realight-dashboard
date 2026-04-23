REALIGHT GOOGLE SHEETS CONNECTION BUNDLE

FILES INCLUDED
- lib/sheets.ts
- app/api/dashboard/route.ts
- app/api/inventory/route.ts
- app/page.tsx
- app/inventory/page.tsx

HOW TO USE

1. Extract this zip.
2. Open your project folder:
   C:\Users\Admin\realight\realight-dashboard
3. Copy these files into the matching folders inside your project.
4. Overwrite existing files if prompted.

5. In your project terminal, run:
   npm install googleapis

6. Make sure these Vercel environment variables already exist:
   GOOGLE_CLIENT_EMAIL
   GOOGLE_PRIVATE_KEY
   GOOGLE_SHEET_ID
   GOOGLE_PROJECT_ID

7. Then push the update:
   git add .
   git commit -m "Connect dashboard to Google Sheets"
   git push origin main

8. Vercel will auto-deploy.

WHAT THIS DOES
- Dashboard page reads live totals from Google Sheets
- Inventory page reads live Inventory_Report rows from Google Sheets
- Uses your workbook:
  1cSjaGLeyGsS_0QWwxQ-ayttozgk-rM69pP_hvta4n10
