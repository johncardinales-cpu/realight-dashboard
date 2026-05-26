import { NextResponse } from "next/server";

type InventoryItem = {
  Description?: string;
  Specification?: string;
  "Incoming Qty"?: number;
  "Received Qty"?: number;
  "Sold Qty"?: number;
  "Damaged Qty"?: number;
  "Actual On Hand"?: number;
  "Minimum Buffer"?: number;
  "Sellable Qty"?: number;
  "Latest Received"?: string;
  "Latest Incoming"?: string;
};

function toNumber(value: unknown) {
  return Number(value || 0) || 0;
}

function itemName(item: InventoryItem) {
  const description = String(item.Description || "").trim();
  const specification = String(item.Specification || "").trim();
  if (description && specification) return `${description} - ${specification}`;
  return description || specification || "Unnamed item";
}

function sortBySellableAsc(a: InventoryItem, b: InventoryItem) {
  return toNumber(a["Sellable Qty"]) - toNumber(b["Sellable Qty"]);
}

function sortByIncomingDesc(a: InventoryItem, b: InventoryItem) {
  return toNumber(b["Incoming Qty"]) - toNumber(a["Incoming Qty"]);
}

function summarizeItems(items: InventoryItem[]) {
  const totalItems = items.length;
  const totalIncoming = items.reduce((sum, item) => sum + toNumber(item["Incoming Qty"]), 0);
  const totalReceived = items.reduce((sum, item) => sum + toNumber(item["Received Qty"]), 0);
  const totalSold = items.reduce((sum, item) => sum + toNumber(item["Sold Qty"]), 0);
  const totalDamaged = items.reduce((sum, item) => sum + toNumber(item["Damaged Qty"]), 0);
  const totalOnHand = items.reduce((sum, item) => sum + toNumber(item["Actual On Hand"]), 0);
  const totalSellable = items.reduce((sum, item) => sum + toNumber(item["Sellable Qty"]), 0);

  const zeroStock = items.filter((item) => toNumber(item["Sellable Qty"]) <= 0);
  const lowStock = items.filter((item) => {
    const sellable = toNumber(item["Sellable Qty"]);
    const buffer = toNumber(item["Minimum Buffer"]);
    if (buffer > 0) return sellable <= buffer;
    return sellable > 0 && sellable <= 5;
  });
  const healthyStock = items.filter((item) => toNumber(item["Sellable Qty"]) > 5);
  const incoming = items.filter((item) => toNumber(item["Incoming Qty"]) > 0).sort(sortByIncomingDesc).slice(0, 8);
  const lowestStock = [...items].sort(sortBySellableAsc).slice(0, 10);

  const reorderSuggestions = [...new Map([...zeroStock, ...lowStock].map((item) => [itemName(item), item])).values()]
    .slice(0, 10)
    .map((item) => {
      const sellable = toNumber(item["Sellable Qty"]);
      const buffer = toNumber(item["Minimum Buffer"]);
      const suggestedQty = Math.max(buffer > 0 ? buffer * 2 - sellable : 10 - sellable, 1);
      return {
        item: itemName(item),
        sellableQty: sellable,
        minimumBuffer: buffer,
        suggestedReorderQty: Math.ceil(suggestedQty),
      };
    });

  return {
    totalItems,
    totalIncoming,
    totalReceived,
    totalSold,
    totalDamaged,
    totalOnHand,
    totalSellable,
    zeroStockCount: zeroStock.length,
    lowStockCount: lowStock.length,
    healthyStockCount: healthyStock.length,
    lowestStock: lowestStock.map((item) => ({
      item: itemName(item),
      sellableQty: toNumber(item["Sellable Qty"]),
      actualOnHand: toNumber(item["Actual On Hand"]),
      incomingQty: toNumber(item["Incoming Qty"]),
      soldQty: toNumber(item["Sold Qty"]),
    })),
    incoming: incoming.map((item) => ({
      item: itemName(item),
      incomingQty: toNumber(item["Incoming Qty"]),
      latestIncoming: String(item["Latest Incoming"] || ""),
    })),
    reorderSuggestions,
  };
}

async function readInventory(origin: string, cookieHeader: string) {
  const response = await fetch(`${origin}/api/inventory`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!response.ok) {
    return [] as InventoryItem[];
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return [] as InventoryItem[];
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload as InventoryItem[] : [] as InventoryItem[];
}

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const cookieHeader = request.headers.get("cookie") || "";
    const inventory = await readInventory(origin, cookieHeader);
    const summary = summarizeItems(inventory);

    return NextResponse.json({
      mode: "safe-read-only",
      source: "/api/inventory",
      generatedAt: new Date().toISOString(),
      summary,
      writeActionsEnabled: false,
      destructiveActionsEnabled: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to analyze inventory" }, { status: 500 });
  }
}
