import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const SALES_SHEET = "Sales";
const READ_CACHE_MS = 15000;

type TopProduct = { name: string; sold: number };
let readCache: { expiresAt: number; products: TopProduct[] } | null = null;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

function text(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function isQuotaError(error: any) {
  const message = String(error?.message || error?.response?.data?.error?.message || error || "").toLowerCase();
  return message.includes("quota") || message.includes("read requests per minute") || message.includes("rate limit");
}

function isConfirmedSale(row: string[]) {
  return text(row[20]).toLowerCase() === "confirmed";
}

function buildTopProducts(rows: string[][]) {
  const totals = new Map<string, number>();
  rows.slice(1).forEach((row) => {
    if (!isConfirmedSale(row)) return;
    const product = text(row[3] || row[4] || "Unknown Product");
    const qty = toNumber(row[5]) || 1;
    totals.set(product, (totals.get(product) || 0) + qty);
  });

  return Array.from(totals.entries())
    .map(([name, sold]) => ({ name, sold }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);
}

async function readTopProducts() {
  const now = Date.now();
  if (readCache && readCache.expiresAt > now) return readCache.products;
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SALES_SHEET}!A:AJ` });
  const rows = (response.data.values || []) as string[][];
  const products = buildTopProducts(rows);
  readCache = { expiresAt: now + READ_CACHE_MS, products };
  return products;
}

export async function GET() {
  try {
    const products = await readTopProducts();
    const response = NextResponse.json(products);
    response.headers.set("Cache-Control", "private, max-age=10");
    response.headers.set("X-Realights-Read-Cache", readCache && readCache.expiresAt > Date.now() ? "hit" : "miss");
    return response;
  } catch (error: any) {
    console.error("TOP PRODUCTS API ERROR:", error);
    if (isQuotaError(error)) return NextResponse.json({ error: "Google Sheets is temporarily rate-limiting top product reads. Please wait 30 to 60 seconds, then refresh once." }, { status: 429 });
    return NextResponse.json({ error: error?.message || String(error) || "Failed to load top products" }, { status: 500 });
  }
}
