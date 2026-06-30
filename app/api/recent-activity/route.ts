import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const AUDIT_LOG_SHEET = "Audit_Log";
const READ_CACHE_MS = 15000;

type ActivityItem = {
  id: string;
  createdAt: string;
  title: string;
  note: string;
  actor: string;
  module: string;
  action: string;
  recordRef: string;
  time: string;
  icon: string;
};

let readCache: { expiresAt: number; activities: ActivityItem[] } | null = null;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function safeText(value: unknown) {
  return String(value || "").trim();
}

function isQuotaError(error: any) {
  const message = String(error?.message || error?.response?.data?.error?.message || error || "").toLowerCase();
  return message.includes("quota") || message.includes("read requests per minute") || message.includes("rate limit");
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function iconForAction(action: string) {
  const text = action.toLowerCase();
  if (text.includes("sale")) return "sales";
  if (text.includes("payment")) return "payment";
  if (text.includes("delivery") || text.includes("inventory")) return "inventory";
  if (text.includes("expense")) return "expense";
  if (text.includes("reset")) return "reset";
  return "activity";
}

function titleForAction(action: string) {
  const normalized = action.replace(/_/g, " ").toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseActivities(rows: string[][]) {
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => safeText(cell)))
    .map((row) => {
      const createdAt = safeText(row[1]);
      const moduleName = safeText(row[2]);
      const action = safeText(row[3]);
      const recordRef = safeText(row[5]);
      const actor = safeText(row[6]);
      const summary = safeText(row[7]);
      return {
        id: safeText(row[0]),
        createdAt,
        title: action ? titleForAction(action) : moduleName || "Activity",
        note: summary || [moduleName, recordRef].filter(Boolean).join(" - ") || "System activity recorded",
        actor: actor || "System",
        module: moduleName,
        action,
        recordRef,
        time: relativeTime(createdAt),
        icon: iconForAction(action || moduleName),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

async function readActivities() {
  const now = Date.now();
  if (readCache && readCache.expiresAt > now) return readCache.activities.map((item) => ({ ...item, time: relativeTime(item.createdAt) }));
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${AUDIT_LOG_SHEET}!A:J` });
  const rows = (response.data.values || []) as string[][];
  const activities = parseActivities(rows);
  readCache = { expiresAt: now + READ_CACHE_MS, activities };
  return activities;
}

export async function GET() {
  try {
    const activities = await readActivities();
    const response = NextResponse.json(activities);
    response.headers.set("Cache-Control", "private, max-age=10");
    response.headers.set("X-Realights-Read-Cache", readCache && readCache.expiresAt > Date.now() ? "hit" : "miss");
    return response;
  } catch (error: any) {
    console.error("RECENT ACTIVITY API ERROR:", error);
    if (isQuotaError(error)) return NextResponse.json({ error: "Google Sheets is temporarily rate-limiting activity reads. Please wait 30 to 60 seconds, then refresh once." }, { status: 429 });
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load recent activity" }, { status: 500 });
  }
}
