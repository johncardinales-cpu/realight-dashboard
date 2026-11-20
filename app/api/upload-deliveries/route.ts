import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { saveNewDeliveries } from "@/lib/delivery-create-service";
import type { DeliveryInput } from "@/lib/delivery-create";

export async function POST(req: NextRequest) {
  try {
    const admin = await readSession(req.cookies.get("realights_session")?.value);
    if (!admin) {
      return NextResponse.json({ error: "Authenticated administrator required." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? body.rows as DeliveryInput[] : [];
    const actionNote = String(body?.note ?? "").trim();
    if (!rows.length || rows.length > 200) {
      return NextResponse.json({ error: "Import between 1 and 200 rows per operation." }, { status: 400 });
    }
    if (actionNote.length < 8 || actionNote.length > 500) {
      return NextResponse.json({ error: "An import note of 8 to 500 characters is required." }, { status: 400 });
    }

    // Delivery rows, action notes, audit events, pricing records, and pricing
    // audits are prepared first, then committed in one Sheets batchUpdate.
    const saved = await saveNewDeliveries(rows, actionNote, admin.email, true);
    return NextResponse.json({
      ok: true, imported: saved.count,
      pricing: saved.pricing,
      message: "Deliveries, stock-source records, and any cost updates were saved with their audit history.",
    });
  } catch (error: unknown) {
    console.error("UPLOAD DELIVERIES ERROR:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to import supplier deliveries.",
    }, { status: 400 });
  }
}
