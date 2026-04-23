import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

export async function GET() {
  try {
    const rows = await getSheetValues("Inventory_Report!A1:Z200");

    const headerRowIndex = rows.findIndex((row) =>
      row.some((cell) => String(cell).toLowerCase().includes("description")) &&
      row.some((cell) => String(cell).toLowerCase().includes("specification"))
    );

    if (headerRowIndex === -1) {
      throw new Error("Could not find inventory table header row");
    }

    const header = rows[headerRowIndex];
    const data = rows.slice(headerRowIndex + 1).filter(
      (row) => row.some((cell) => String(cell).trim() !== "")
    );

    const items = data.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((col, i) => {
        obj[String(col).trim()] = row[i] || "";
      });
      return obj;
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("INVENTORY API ERROR:", error);
    return NextResponse.json(
      {
        error: error?.message || String(error) || "Failed to load inventory data",
      },
      { status: 500 }
    );
  }
}
