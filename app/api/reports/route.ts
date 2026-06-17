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

function reconcileToOpenBalances(payload: any) {
  const dailySales = Array.isArray(payload?.dailySales) ? payload.dailySales : [];
  const openReceivables = Array.isArray(payload?.openReceivables) ? payload.openReceivables : [];
  if (!dailySales.length) return payload;

  const openByKey = new Map(openReceivables.map((r: any) => [saleKey(r), r]));
  const correctedSales = dailySales.map((sale: any) => {
    const open = openByKey.get(saleKey(sale));
    if (!open) return sale;
    return {
      ...sale,
      totalPaidPhp: round(Number(open.totalPaidPhp || 0)),
      tenderedAmountPhp: round(Number(open.tenderedAmountPhp || open.totalPaidPhp || 0)),
      totalTenderedPhp: round(Number(open.tenderedAmountPhp || open.totalPaidPhp || 0)),
      balancePhp: round(Number(open.balancePhp || 0)),
      paymentStatus: text(open.paymentStatus) || sale.paymentStatus,
    };
  });

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
  const endingReceivables = round(openReceivables.reduce((sum: number, sale: any) => sum + Number(sale.balancePhp || 0), 0));

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
    collectionDetails: filteredDetails,
    collectionsByMethod: recalcByMethod(filteredDetails),
    cashByMethod: recalcByMethod(filteredDetails),
    summary,
    collectionTiming: {
      ...(payload.collectionTiming || {}),
      currentPeriodSaleCollectionsPhp: currentCollections,
      priorReceivableCollectionsPhp: priorCollections,
    },
    dailyTrend: Array.isArray(payload.dailyTrend) ? payload.dailyTrend.map((row: any) => ({ ...row, collections: totalCollections, cashReceived: totalCollections, receivables: balanceToday })) : payload.dailyTrend,
  };
}

export async function GET(req: Request) {
  try {
    const payload = reconcileToOpenBalances(groupCollectionDetails(await getReportPayload(new URL(req.url))));
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
