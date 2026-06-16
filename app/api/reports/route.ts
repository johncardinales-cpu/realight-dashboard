import { NextResponse } from "next/server";
import { getReportPayload } from "./report-service";

let lastPayload: any = null;
let lastAt = 0;

export async function GET(req: Request) {
  try {
    const payload = await getReportPayload(new URL(req.url));
    lastPayload = payload;
    lastAt = Date.now();
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (error: any) {
    if (lastPayload && Date.now() - lastAt < 60000) {
      return NextResponse.json({ ...lastPayload, warning: "Showing cached report because Google Sheets quota was temporarily exceeded." }, { headers: { "Cache-Control": "private, max-age=15" } });
    }
    return NextResponse.json({ error: error?.message || "Failed to load reports" }, { status: 500 });
  }
}
