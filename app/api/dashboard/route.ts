import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

function toNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

export async function GET() {
  try {
    const inventoryRows = await getSheetValues("Inventory_Report!A1:Z200");
    const salesRows = await getSheetValues("Sales!A1:Z500");
    const expenseRows = await getSheetValues("Expenses!A1:Z500");

    const inventoryHeader = inventoryRows[0] || [];
    const inventoryData = inventoryRows.slice(1);

    const salesHeader = salesRows[0] || [];
    const salesData = salesRows.slice(1);

    const expenseHeader = expenseRows[0] || [];
    const expenseData = expenseRows.slice(1);

    const onHandIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("on hand")
    );
    const sellableIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("sellable")
    );
    const incomingIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("incoming")
    );
    const receivedIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("received")
    );

    const totalIncoming = inventoryData.reduce(
      (sum, row) => sum + toNumber(row[incomingIndex]),
      0
    );
    const totalReceived = inventoryData.reduce(
      (sum, row) => sum + toNumber(row[receivedIndex]),
      0
    );
    const totalOnHand = inventoryData.reduce(
      (sum, row) => sum + toNumber(row[onHandIndex]),
      0
    );
    const totalSellable = inventoryData.reduce(
      (sum, row) => sum + toNumber(row[sellableIndex]),
      0
    );

    const salesTotalIndex = salesHeader.findIndex((h) =>
      String(h).toLowerCase().includes("total sales")
    );
    const totalSales = salesData.reduce(
      (sum, row) => sum + toNumber(row[salesTotalIndex]),
      0
    );

    const totalExpenseIndex = expenseHeader.findIndex((h) =>
      String(h).toLowerCase().includes("total expenses")
    );
    const totalExpenses = expenseData.reduce(
      (sum, row) => sum + toNumber(row[totalExpenseIndex]),
      0
    );

    const netGain = totalSales - totalExpenses;

    return NextResponse.json({
      incomingUnits: totalIncoming,
      warehouseReceived: totalReceived,
      actualOnHand: totalOnHand,
      sellableUnits: totalSellable,
      totalSales,
      totalExpenses,
      netGain,
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
