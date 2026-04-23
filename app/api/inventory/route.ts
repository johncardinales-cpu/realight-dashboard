import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

function isZeroDate(value: string) {
  return value === "1899-12-30" || value === "12/30/1899";
}

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

    const header = rows[headerRowIndex].map((h) => String(h).trim());

    const dataRows = rows.slice(headerRowIndex + 1);

    const items: Record<string, string>[] = [];

    for (const row of dataRows) {
      const description = String(row[0] || "").trim();
      const specification = String(row[1] || "").trim();

      if (!description && !specification) continue;

      const lowerDescription = description.toLowerCase();

      // Stop when the inventory product block ends and report/meta rows begin
      if (
        lowerDescription.includes("stock movement") ||
        lowerDescription.includes("upload date") ||
        /^\d{4}-\d{2}-\d{2}$/.test(description)
      ) {
        break;
      }

      const obj: Record<string, string> = {};

      header.forEach((col, i) => {
        let value = String(row[i] || "").trim();

        if (isZeroDate(value)) value = "";

        obj[col] = value;
      });

      items.push(obj);
    }

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
