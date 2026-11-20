import { NextResponse } from "next/server";

// This old maintenance operation rewrote a wider sales schema into 15 columns.
// It must never be used on live production sales data.
export async function GET() {
  return NextResponse.json({ error: "Unsafe maintenance endpoint permanently disabled." }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "Unsafe maintenance endpoint permanently disabled." }, { status: 410 });
}
