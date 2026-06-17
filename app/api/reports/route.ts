import { NextResponse } from "next/server";
import { getReportPayload } from "./report-service";

let lastPayload: any = null;
let lastAt = 0;

const text = (value: unknown) => String(value || "").trim();
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function groupCollectionDetails(payload: any) {
  const details = Array.isArray(payload?.collectionDetails) ? payload.collectionDetails : [];
  if (!details.length) return payload;

  const grouped = new Map<string, any>();
  details.forEach((item: any) => {
    const source = text(item.salesRefNo) && text(item.salesRefNo) !== "-"
      ? text(item.salesRefNo)
      : text(item.customerName) && text(item.customerName) !== "-"
        ? text(item.customerName)
        : text(item.collectionType) || "Collection";
    const method = text(item.method) || "Unspecified";
    const type = text(item.collectionType) || "Collection";
    const key = `${source}|${method}|${type}`;
    const current = grouped.get(key) || {
      id: key,
      date: text(item.date),
      saleDate: text(item.saleDate),
      salesRefNo: source,
      customerName: type,
      method,
      amount: 0,
      transactionRef: type,
      cashierName: text(item.cashierName),
      collectionType: type,
    };
    current.amount = round(current.amount + Number(item.amount || 0));
    grouped.set(key, current);
  });

  return { ...payload, collectionDetails: Array.from(grouped.values()) };
}

export async function GET(req: Request) {
  try {
    const payload = groupCollectionDetails(await getReportPayload(new URL(req.url)));
    lastPayload = payload;
    lastAt = Date.now();
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (error: any) {
    if (lastPayload && Date.now() - lastAt < 60000) {
      return NextResponse.json({ ...lastPayload, warning: "Showing cached report because Google Sheets quota was temporarily exceeded." }, { headers: { "Cache-Control": "private, max-age=15" } });
    }
    return NextResponse.json({ error: error?.message || "Failed to load reports" }, { status: 500 });
  }
}
