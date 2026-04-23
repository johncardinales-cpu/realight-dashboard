import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

function toNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

function findHeaderRow(rows: string[][], required: string[]) {
  return rows.findIndex((row) =>
    required.every((term) =>
      row.some((cell) => String(cell).toLowerCase().includes(term))
    )
  );
}

export async function GET() {
  try {
    const inventoryRows = await getSheetValues("Inventory_Report!A1:Z200");
    const salesRows = await getSheetValues("Sales!A1:Z500");
    const expenseRows = await getSheetValues("Expenses!A1:Z500");

    const inventoryHeaderRowIndex = findHeaderRow(inventoryRows, [
      "description",
      "specification",
      "incoming",
      "received",
    ]);

    if (inventoryHeaderRowIndex === -1) {
      throw new Error("Could not find inventory header row");
    }

    const inventoryHeader = inventoryRows[inventoryHeaderRowIndex];
    const inventoryData = inventoryRows
      .slice(inventoryHeaderRowIndex + 1)
      .filter((row) => row.some((cell) => String(cell).trim() !== ""));

    const incomingIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("incoming")
    );
    const receivedIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("received")
    );
    const onHandIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("on hand")
    );
    const sellableIndex = inventoryHeader.findIndex((h) =>
      String(h).toLowerCase().includes("sellable")
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

    const salesHeaderRowIndex = findHeaderRow(salesRows, ["sales"]);
    const expenseHeaderRowIndex = findHeaderRow(expenseRows, ["expense"]);

    let totalSales = 0;
    let totalExpenses = 0;

    if (salesHeaderRowIndex !== -1) {
      const salesHeader = salesRows[salesHeaderRowIndex];
      const salesData = salesRows
        .slice(salesHeaderRowIndex + 1)
        .filter((row) => row.some((cell) => String(cell).trim() !== ""));

      const salesTotalIndex = salesHeader.findIndex((h) =>
        String(h).toLowerCase().includes("sales")
      );

      if (salesTotalIndex !== -1) {
        totalSales = salesData.reduce(
          (sum, row) => sum + toNumber(row[salesTotalIndex]),
          0
        );
      }
    }

    if (expenseHeaderRowIndex !== -1) {
      const expenseHeader = expenseRows[expenseHeaderRowIndex];
      const expenseData = expenseRows
        .slice(expenseHeaderRowIndex + 1)
        .filter((row) => row.some((cell) => String(cell).trim() !== ""));

      const expenseTotalIndex = expenseHeader.findIndex((h) =>
        String(h).toLowerCase().includes("expense")
      );

      if (expenseTotalIndex !== -1) {
        totalExpenses = expenseData.reduce(
          (sum, row) => sum + toNumber(row[expenseTotalIndex]),
          0
        );
      }
    }

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
}
