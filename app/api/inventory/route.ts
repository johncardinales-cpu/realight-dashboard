import { NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";

export async function GET() {
  try {
    const rows = await getSheetValues("Inventory_Report!A1:Z200");
    const header = rows[0] || [];
    const data = rows.slice(1);

    const items = data
      .filter((row) => row.length > 0)
      .map((row) => {
        const obj: Record<string, string> = {};
        header.forEach((col, i) => {
          obj[String(col)] = row[i] || "";
        });
        return obj;
      });

    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load inventory data" },
      { status: 500 }
    );
  }
}
