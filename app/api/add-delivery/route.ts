import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { saveNewDeliveries } from "@/lib/delivery-create-service";

export async function POST(req: NextRequest) {
  try {
    const admin = await readSession(req.cookies.get("realights_session")?.value);
    if (!admin) return NextResponse.json({ error: "Authenticated administrator required." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const note = String(body?.notes ?? "").trim();
    const saved = await saveNewDeliveries([body], note, admin.email, false);
    return NextResponse.json({ ok: true, created: saved.count });
  } catch (error) {
    console.error("ADD DELIVERY ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create delivery." }, { status: 400 });
  }
}
