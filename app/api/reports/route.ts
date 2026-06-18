// @ts-nocheck
import { NextResponse } from "next/server";
import { getReportPayload } from "./report-service";

let lastPayload: any = null;
let lastAt = 0;

const text = (value: unknown) => String(value || "").trim();
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const generic = new Set(["-", "collection", "current sale", "prior receivable", "payment", "payment activity", "unspecified"]);
const useful = (value: unknown) => {
  const clean = text(value);
  return clean && !generic.has(clean.toLowerCase()) ? clean : "";
};
const saleKey = (sale: any) => `${text(sale.saleDate || sale.date)}|${useful(sale.salesRefNo)}|${useful(sale.customerName)}`;
const detailKey = (item: any) => `${text(item.saleDate || item.date)}|${useful(item.salesRefNo)}|${useful(item.customerName)}`;
const paidStatus = (paid: number, total: number) => total > 0 && paid + 0.009 >= total ? "Paid" : paid > 0 ? "Partial" : "Pending";

function groupCollectionDetails(payload: any) {
  const details = Array.isArray(payload?.collectionDetails) ? payload.collectionDetails : [];
  if (!details.length) return payload;

  const grouped = new Map<string, any>();
  details.forEach((item: any) => {
    const type = text(item.collectionType) || "Collection";
    const method = text(item.method) || "Unspecified";
    const source = useful(item.salesRefNo) || useful(item.customerName) || type;
    const customer = useful(item.customerName) || source;
    const reference = useful(item.transactionRef);
    const key = `${text(item.date)}|${source}|${customer}|${method}|${type}|${reference || type}`;
    const current = grouped.get(key) || {
      id: key,
      date: text(item.date),
      saleDate: text(item.saleDate),
      salesRefNo: source,
      customerName: customer,
      method,
      amount: 0,
      transactionRef: reference || type,
      cashierName: text(item.cashierName),
      collectionType: type,
    };
    current.amount = round(current.amount + Number(item.amount || 0));
    grouped.set(key, current);
  });

  return { ...payload, collectionDetails: Array.from(grouped.values()) };
}

function recalcByMethod(details: any[]) {
  const map = new Map<string, number>();
  details.forEach((d) => map.set(text(d.method) || "Unspecified", round((map.get(text(d.method) || "Unspecified") || 0) + Number(d.amount || 0))));
  return Array.from(map.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

function correctedFromRows(sale: any) {
  const total = round(Number(sale.totalSalePhp || sale.grandTotalPhp || 0));
  const byBalance = round(Math.max(total - Math.max(Number(sale.salesBalance || 0), 0), 0));
  const byPaid = round(Number(sale.salesPaid || sale.totalPaidPhp || 0));
  const paid = round(Math.min(Math.max(byBalance, byPaid), total));
  const follow = round(Number(sale.followUpPaidPhp || 0));
  const initial = round(Math.max(paid - follow, 0));
  return {
    ...sale,
    initialPaidPhp: initial,
    initialTenderedPhp: initial,
    totalPaidPhp: paid,
    tenderedAmountPhp: round(initial + follow),
    totalTenderedPhp: round(initial + follow),
    balancePhp: round(Math.max(total - paid, 0)),
    paymentStatus: paidStatus(paid, total),
  };
}

function mergeOpenReceivables(existing: any[], sales: any[]) {
  const merged = new Map(existing.map((r: any) => [saleKey(r), r]));
  sales.forEach((sale: any) => {
    if (Number(sale.balancePhp || 0) <= 0) return;
    merged.set(saleKey(sale), {
      saleDate: sale.saleDate,
      salesRefNo: sale.salesRefNo,
      customerName: sale.customerName,
      totalSalePhp: sale.totalSalePhp,
      totalPaidPhp: sale.totalPaidPhp,
      tenderedAmountPhp: sale.totalTenderedPhp,
      changeDuePhp: sale.changeDuePhp,
      balancePhp: sale.balancePhp,
      paymentStatus: sale.paymentStatus,
      saleStatus: sale.saleStatus,
    });
  });
  return Array.from(merged.values()).filter((r: any) => Number(r.balancePhp || 0) > 0);
}

function reconcileTrend(payload: any, sales: any[], details: any[]) {
  const collectionsByDate = new Map<string, number>();
  details.forEach((d: any) => {
    const date = text(d.date);
    if (!date) return;
    collectionsByDate.set(date, round((collectionsByDate.get(date) || 0) + Number(d.amount || 0)));
  });

  const receivablesByDate = new Map<string, number>();
  sales.forEach((sale: any) => {
    const date = text(sale.saleDate);
    if (!date) return;
    receivablesByDate.set(date, round((receivablesByDate.get(date) || 0) + Number(sale.balancePhp || 0)));
  });

  const rows = Array.isArray(payload.dailyTrend) ? payload.dailyTrend : [];
  return rows.map((row: any) => {
    const date = text(row.date);
    const collections = round(collectionsByDate.get(date) || 0);
    return { ...row, collections, cashReceived: collections, receivables: round(receivablesByDate.get(date) || 0) };
  });
}

function reconcileToOpenBalances(payload: any) {
  const dailySales = Array.isArray(payload?.dailySales) ? payload.dailySales : [];
  const openReceivables = Array.isArray(payload?.openReceivables) ? payload.openReceivables : [];
  if (!dailySales.length) return payload;

  const correctedSales = dailySales.map(correctedFromRows);
  const correctedOpenReceivables = mergeOpenReceivables(openReceivables, correctedSales);
  const details = (Array.isArray(payload?.collectionDetails) ? payload.collectionDetails : []).map((d: any) => ({ ...d }));
  correctedSales.forEach((sale: any) => {
    const key = saleKey(sale);
    const followPaid = details
      .filter((d) => detailKey(d) === key && text(d.collectionType).toLowerCase() === "current sale" && text(d.transactionRef).toLowerCase() !== "current sale")
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const expectedInitial = round(Math.max(Number(sale.totalPaidPhp || 0) - followPaid, 0));
    details.forEach((d) => {
      if (detailKey(d) === key && text(d.collectionType).toLowerCase() === "current sale" && text(d.transactionRef).toLowerCase() === "current sale") {
        d.amount = expectedInitial;
      }
    });
  });

  const filteredDetails = details.filter((d) => Number(d.amount || 0) > 0);
  const currentCollections = round(filteredDetails.filter((d) => text(d.collectionType).toLowerCase() === "current sale").reduce((sum, d) => sum + Number(d.amount || 0), 0));
  const priorCollections = round(filteredDetails.filter((d) => text(d.collectionType).toLowerCase() === "prior receivable").reduce((sum, d) => sum + Number(d.amount || 0), 0));
  const totalCollections = round(currentCollections + priorCollections);
  const balanceToday = round(correctedSales.reduce((sum: number, sale: any) => sum + Number(sale.balancePhp || 0), 0));
  const endingReceivables = round(correctedOpenReceivables.reduce((sum: number, sale: any) => sum + Number(sale.balancePhp || 0), 0));

  const summary = {
    ...(payload.summary || {}),
    currentPeriodSaleCollectionsToday: currentCollections,
    priorReceivableCollectionsToday: priorCollections,
    collectionsToday: totalCollections,
    cashReceivedToday: totalCollections,
    netCashAfterChangeToday: round(totalCollections - Number(payload.summary?.changeGivenToday || 0)),
    newReceivablesToday: balanceToday,
    endingReceivables,
  };

  return {
    ...payload,
    dailySales: correctedSales,
    openReceivables: correctedOpenReceivables,
    collectionDetails: filteredDetails,
    collectionsByMethod: recalcByMethod(filteredDetails),
    cashByMethod: recalcByMethod(filteredDetails),
    summary,
    collectionTiming: {
      ...(payload.collectionTiming || {}),
      currentPeriodSaleCollectionsPhp: currentCollections,
      priorReceivableCollectionsPhp: priorCollections,
    },
    dailyTrend: reconcileTrend(payload, correctedSales, filteredDetails),
  };
}

export async function GET(req: Request) {
  try {
    const payload = reconcileToOpenBalances(groupCollectionDetails(await getReportPayload(new URL(req.url))));
    lastPayload = payload;
    lastAt = Date.now();
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (e: any) {
    if (lastPayload && Date.now() - lastAt < 60000) {
      return NextResponse.json({ ...lastPayload, warning: "Showing cached report because Google Sheets quota was temporarily exceeded." }, { headers: { "Cache-Control": "private, max-age=15" } });
    }
    return NextResponse.json({ error: e?.message || "Failed to load reports" }, { status: 500 });
  }
}
