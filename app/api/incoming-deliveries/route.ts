import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

function normalize(value: string) {
  if (value === "1899-12-30" || value === "12/30/1899") return "";
  return value.trim();
}

export async function GET() {
  try {
    const rows = await getSheetValues("Inventory_Report!A1:Z300");

    const startIndex = rows.findIndex((row) =>
      row.some((cell) =>
        String(cell).toLowerCase().includes("stock movement list")
      )
    );

    if (startIndex === -1) {
      throw new Error("Could not find Stock Movement List section");
    }

    const headerIndex = startIndex + 1;
    const header = (rows[headerIndex] || []).map((h) => normalize(String(h || "")));

    const dataRows = rows.slice(headerIndex + 1);
    const items: Record<string, string>[] = [];

    for (const row of dataRows) {
      const firstCell = normalize(String(row[0] || ""));
      const secondCell = normalize(String(row[1] || ""));

      if (!firstCell && !secondCell) continue;

      if (
        firstCell.toLowerCase().includes("product summary") ||
        firstCell.toLowerCase().includes("easy view") ||
        firstCell.toLowerCase().includes("description")
      ) {
        break;
      }

      const obj: Record<string, string> = {};
      header.forEach((col, i) => {
        const key = col || `Column ${i + 1}`;
        obj[key] = normalize(String(row[i] || ""));
      });

      items.push(obj);
    }

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("INCOMING DELIVERIES API ERROR:", error);
    return NextResponse.json(
      {
        error:
          error?.message || String(error) || "Failed to load incoming deliveries data",
      },
      { status: 500 }
    );
  }
}
