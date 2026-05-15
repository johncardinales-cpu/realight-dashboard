import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "App_Deliveries";
const AUDIT_LOG_SHEET = "Audit_Log";
const VALID_STATUSES = ["Incoming", "Available", "Damaged", "Cancelled"];
const AUDIT_HEADERS = ["Audit ID", "Created At", "Module", "Action", "Record ID", "Record Ref", "Actor", "Summary", "Before JSON", "After JSON"];

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function makeId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}_${random}`;
}

function normalizeStatus(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (["available", "received", "ready", "ready to receive"].includes(text)) return "Available";
  if (["damage", "damaged", "defective"].includes(text)) return "Damaged";
  if (["cancel", "cancelled", "canceled"].includes(text)) return "Cancelled";
  return "Incoming";
}

async function ensureAuditLogSheet(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = Boolean((meta.data.sheets || []).find((sheet: any) => sheet.properties?.title === AUDIT_LOG_SHEET));
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: AUDIT_LOG_SHEET } } }] },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A1:J1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [AUDIT_HEADERS] },
  });
}

async function appendAuditLog(sheets: any, entry: { action: string; recordId: string; recordRef: string; actor: string; summary: string; before: unknown; after: unknown }) {
  await ensureAuditLogSheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AUDIT_LOG_SHEET}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        makeId("AUDIT"),
        new Date().toISOString(),
        "Incoming Deliveries",
        entry.action,
        entry.recordId,
        entry.recordRef,
        entry.actor || "Admin",
        entry.summary,
        JSON.stringify(entry.before || {}),
        JSON.stringify(entry.after || {}),
      ]],
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rowNumber = Number(body?.rowNumber);
    const status = normalizeStatus(body?.status);
    const actor = safeText(body?.actor || "Admin");

    if (!rowNumber) {
      return NextResponse.json({ error: "rowNumber is required" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid delivery status" }, { status: 400 });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });

    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`,
    });

    const row = rowResponse.data.values?.[0] || [];
    const currentArrivalDate = safeText(row[1]);
    const previousStatus = normalizeStatus(row[9]);
    const description = safeText(row[4]);
    const specification = safeText(row[5]);
    const qty = safeText(row[6]);
    const batchRef = safeText(row[8]);
    const recordRef = batchRef || `${description} ${specification}`.trim() || `Row ${rowNumber}`;

    const updates: Array<{ range: string; values: string[][] }> = [
      { range: `${SHEET_NAME}!J${rowNumber}`, values: [[status]] },
    ];

    const shouldAutoFillArrivalDate = (status === "Available" || status === "Damaged") && !currentArrivalDate;
    if (shouldAutoFillArrivalDate) {
      updates.push({ range: `${SHEET_NAME}!B${rowNumber}`, values: [[todayIso()]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });

    await appendAuditLog(sheets, {
      action: "UPDATE_DELIVERY_STATUS",
      recordId: `ROW_${rowNumber}`,
      recordRef,
      actor,
      summary: `${description || "Delivery"} ${specification ? `(${specification})` : ""} qty ${qty || "0"}: ${previousStatus} -> ${status}`,
      before: { rowNumber, status: previousStatus, arrivalDate: currentArrivalDate },
      after: { rowNumber, status, arrivalDate: shouldAutoFillArrivalDate ? todayIso() : currentArrivalDate },
    });

    return NextResponse.json({
      ok: true,
      rowNumber,
      status,
      autoFilledArrivalDate: shouldAutoFillArrivalDate,
    });
  } catch (error: any) {
    console.error("INCOMING DELIVERIES STATUS ERROR:", error);
    return NextResponse.json({ error: error?.message || String(error) || "Failed to update delivery status" }, { status: 500 });
  }
}
