import { NextResponse } from "next/server";

/**
 * This legacy endpoint cleared Pricing_Base!A:N and replaced its header
 * with a schema incompatible with the live workbook.
 *
 * It is intentionally permanently disabled. Use audited, non-destructive
 * row edits and an explicit reviewed migration for any future cleanup.
 */
function disabled() {
  return NextResponse.json({
    error: "Unsafe pricing cleanup endpoint is permanently disabled. No pricing data was changed.",
  }, { status: 410 });
}

export async function GET() { return disabled(); }
export async function POST() { return disabled(); }
