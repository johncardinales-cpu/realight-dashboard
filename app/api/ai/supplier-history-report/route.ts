import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const DELIVERIES_SHEET = "App_Deliveries";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

type DeliveryItem = {
  uploadDate: string;
  arrivalDate: string;
  supplier: string;
  batchRef: string;
  description: string;
  specification: string;
  qtyAdded: number;
  unitPriceUsd: number;
  status: string;
  invoiceValid: string;
  notes: string;
  createdAt: string;
};

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function numberText(value: number) {
  return Number(value || 0).toLocaleString();
}

function moneyUsd(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function normalizeInvoiceValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "Unspecified";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, "-");
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) return normalizeDate(raw);
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return normalizeDate(raw);
  }
  return raw;
}

function buildReport(items: DeliveryItem[]) {
  const supplierMap = new Map<string, {
    supplier: string;
    deliveryLines: number;
    totalQty: number;
    totalCostUsd: number;
    latestArrivalDate: string;
    availableQty: number;
    incomingQty: number;
    damagedQty: number;
  }>();

  const statusCounts = new Map<string, number>();
  const invoiceCounts = new Map<string, number>();

  items.forEach((item) => {
    const supplier = item.supplier || "Unspecified Supplier";
    const status = item.status || "Unspecified";
    const current = supplierMap.get(supplier) || {
      supplier,
      deliveryLines: 0,
      totalQty: 0,
      totalCostUsd: 0,
      latestArrivalDate: "",
      availableQty: 0,
      incomingQty: 0,
      damagedQty: 0,
    };
    const lineCost = item.qtyAdded * item.unitPriceUsd;
    current.deliveryLines += 1;
    current.totalQty += item.qtyAdded;
    current.totalCostUsd += lineCost;
    current.latestArrivalDate = !current.latestArrivalDate || item.arrivalDate > current.latestArrivalDate ? item.arrivalDate : current.latestArrivalDate;
    if (status.toLowerCase() === "available") current.availableQty += item.qtyAdded;
    if (status.toLowerCase() === "incoming") current.incomingQty += item.qtyAdded;
    if (["damaged", "defective", "damage"].includes(status.toLowerCase())) current.damagedQty += item.qtyAdded;
    supplierMap.set(supplier, current);

    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    const invoiceValid = normalizeInvoiceValue(item.invoiceValid);
    invoiceCounts.set(invoiceValid, (invoiceCounts.get(invoiceValid) || 0) + 1);
  });

  const suppliers = [...supplierMap.values()];
  const totalQty = items.reduce((sum, item) => sum + item.qtyAdded, 0);
  const totalCostUsd = items.reduce((sum, item) => sum + item.qtyAdded * item.unitPriceUsd, 0);
  const incomingQty = items.filter((item) => item.status.toLowerCase() === "incoming").reduce((sum, item) => sum + item.qtyAdded, 0);
  const availableQty = items.filter((item) => item.status.toLowerCase() === "available").reduce((sum, item) => sum + item.qtyAdded, 0);
  const damagedQty = items.filter((item) => ["damaged", "defective", "damage"].includes(item.status.toLowerCase())).reduce((sum, item) => sum + item.qtyAdded, 0);
  const topSuppliers = suppliers.sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
  const recentDeliveries = [...items].sort((a, b) => String(b.arrivalDate || b.uploadDate).localeCompare(String(a.arrivalDate || a.uploadDate))).slice(0, 12);

  return {
    title: "Supplier History Report",
    generatedBy: "Supplier History Agent",
    mode: "Safe Read-Only",
    sources: ["App_Deliveries sheet via read-only Google Sheets scope"],
    executiveSummary: `The supplier history review found ${numberText(suppliers.length)} supplier(s), ${numberText(items.length)} delivery line(s), ${numberText(totalQty)} total delivered units, and ${moneyUsd(totalCostUsd)} in estimated supplier cost.`,
    summaryCards: [
      { label: "Suppliers", value: numberText(suppliers.length), helper: "Unique supplier names" },
      { label: "Delivery Lines", value: numberText(items.length), helper: "Delivery records" },
      { label: "Total Qty", value: numberText(totalQty), helper: "Delivered/incoming units" },
      { label: "Available Qty", value: numberText(availableQty), helper: "Available delivery units" },
      { label: "Incoming Qty", value: numberText(incomingQty), helper: "Incoming delivery units" },
      { label: "Est. Cost USD", value: moneyUsd(totalCostUsd), helper: "Qty multiplied by unit price" },
    ],
    sections: [
      {
        title: "Top Suppliers by Quantity",
        description: "Suppliers ranked by delivered/incoming quantity.",
        columns: ["Supplier", "Lines", "Total Qty", "Available", "Incoming", "Damaged", "Est. Cost", "Latest Arrival"],
        rows: topSuppliers.map((item) => ({ Supplier: item.supplier, Lines: item.deliveryLines, "Total Qty": item.totalQty, Available: item.availableQty, Incoming: item.incomingQty, Damaged: item.damagedQty, "Est. Cost": moneyUsd(item.totalCostUsd), "Latest Arrival": item.latestArrivalDate || "Not specified" })),
        emptyMessage: "No supplier delivery records were found.",
      },
      {
        title: "Delivery Status Summary",
        description: "Delivery rows grouped by inventory status.",
        columns: ["Status", "Records"],
        rows: [...statusCounts.entries()].map(([status, count]) => ({ Status: status, Records: count })),
        emptyMessage: "No delivery statuses were found.",
      },
      {
        title: "Invoice Validity Summary",
        description: "Delivery rows grouped by normalized invoice-valid field.",
        columns: ["Invoice Valid", "Records"],
        rows: [...invoiceCounts.entries()].map(([status, count]) => ({ "Invoice Valid": status, Records: count })),
        emptyMessage: "No invoice validity data was found.",
      },
      {
        title: "Recent Supplier Deliveries",
        description: "Latest supplier delivery rows returned from App_Deliveries.",
        columns: ["Arrival", "Supplier", "Batch Ref", "Product", "Qty", "Unit USD", "Status"],
        rows: recentDeliveries.map((item) => ({ Arrival: item.arrivalDate || item.uploadDate || "Not specified", Supplier: item.supplier, "Batch Ref": item.batchRef || "Not specified", Product: `${item.description} - ${item.specification}`, Qty: item.qtyAdded, "Unit USD": moneyUsd(item.unitPriceUsd), Status: item.status || "Not specified" })),
        emptyMessage: "No recent supplier delivery records were found.",
      },
    ],
    recommendedActions: [
      topSuppliers.length ? `Review supplier performance for ${topSuppliers[0].supplier}, currently the highest supplier by quantity at ${numberText(topSuppliers[0].totalQty)} units.` : "No supplier follow-up is required from the current read-only review.",
      damagedQty > 0 ? `Investigate ${numberText(damagedQty)} damaged/defective unit(s) before supplier settlement or reorder decisions.` : "No damaged supplier delivery quantity was detected in the current review.",
      incomingQty > 0 ? `Monitor ${numberText(incomingQty)} incoming unit(s) until they are received and marked available.` : "No incoming supplier quantity is currently recorded.",
    ],
    systemNote: "This supplier history report was generated in safe read-only mode. Invoice-valid serial dates are normalized for readability. No delivery, supplier, inventory, payment, sales, customer, or pricing records were modified.",
  };
}

export async function GET() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client as any });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${DELIVERIES_SHEET}!A:L` });
    const rows = (response.data.values || []) as string[][];
    const items = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim() !== "")).map((row) => ({
      uploadDate: normalizeDate(row[0]),
      arrivalDate: normalizeDate(row[1]),
      supplier: String(row[2] || "").trim(),
      batchRef: String(row[3] || "").trim(),
      description: String(row[4] || "").trim(),
      specification: String(row[5] || "").trim(),
      qtyAdded: toNumber(row[6]),
      unitPriceUsd: toNumber(row[7]),
      invoiceValid: normalizeInvoiceValue(row[8]),
      status: String(row[9] || "").trim(),
      notes: String(row[10] || "").trim(),
      createdAt: normalizeDate(row[11]),
    }));

    return NextResponse.json({ mode: "safe-read-only", source: DELIVERIES_SHEET, report: buildReport(items), writeActionsEnabled: false, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to build supplier history report" }, { status: 500 });
  }
}
