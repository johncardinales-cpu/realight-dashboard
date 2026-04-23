import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

function toNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

function isZeroDate(value: string) {
  return value === "1899-12-30" || value === "12/30/1899";
}

export async function GET() {
  try {
    const rows = await getSheetValues("Inventory_Report!A1:Z200");

    const headerRowIndex = rows.findIndex((row) =>
      row.some((cell) => String(cell).toLowerCase().includes("description")) &&
      row.some((cell) => String(cell).toLowerCase().includes("specification")) &&
      row.some((cell) => String(cell).toLowerCase().includes("incoming")) &&
      row.some((cell) => String(cell).toLowerCase().includes("actual on hand"))
    );

    if (headerRowIndex === -1) {
      throw new Error("Could not find inventory header row");
    }

    const header = rows[headerRowIndex].map((h) => String(h).trim());
    const dataRows = rows.slice(headerRowIndex + 1);

    const incomingIndex = header.findIndex((h) => h.toLowerCase().includes("incoming"));
    const receivedIndex = header.findIndex((h) => h.toLowerCase().includes("received"));
    const onHandIndex = header.findIndex((h) => h.toLowerCase().includes("actual on hand"));
    const sellableIndex = header.findIndex((h) => h.toLowerCase().includes("sellable"));

    let totalIncoming = 0;
    let totalReceived = 0;
    let totalOnHand = 0;
    let totalSellable = 0;

    for (const row of dataRows) {
      const description = String(row[0] || "").trim();
      const specification = String(row[1] || "").trim();

      if (!description && !specification) continue;

      const lowerDescription = description.toLowerCase();

      if (
        lowerDescription.includes("stock movement") ||
        lowerDescription.includes("upload date") ||
        /^\d{4}-\d{2}-\d{2}$/.test(description)
      ) {
        break;
      }

      totalIncoming += toNumber(String(row[incomingIndex] || ""));
      totalReceived += toNumber(String(row[receivedIndex] || ""));
      totalOnHand += toNumber(String(row[onHandIndex] || ""));
      totalSellable += toNumber(String(row[sellableIndex] || ""));
    }

    return NextResponse.json({
      incomingUnits: totalIncoming,
      warehouseReceived: totalReceived,
      actualOnHand: totalOnHand,
      sellableUnits: totalSellable,
      totalSales: 0,
      totalExpenses: 0,
      netGain: 0,
    });
  } catch (error: any) {
    console.error("DASHBOARD API ERROR:", error);
    return NextResponse.json(
      {
        error: error?.message || String(error) || "Failed to load dashboard data",
      },
      { status: 500 }
    );
  }
}
