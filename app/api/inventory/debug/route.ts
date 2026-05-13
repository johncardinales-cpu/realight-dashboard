import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Inventory debug endpoint is disabled after validation." },
    { status: 404 }
  );
}
