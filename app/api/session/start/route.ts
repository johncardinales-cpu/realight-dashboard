import { NextResponse } from "next/server";
import { allowedAdmins, createSession, SESSION_COOKIE, sessionDurationSeconds } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const allowedCode = String(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE || "").trim();
    if (!allowedAdmins().size || !allowedCode || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({ error: "Admin sign-in is not configured." }, { status: 503 });
    }
    if (!allowedAdmins().has(email) || !code || code !== allowedCode) {
      return NextResponse.json({ error: "Invalid access details" }, { status: 401 });
    }
    const token = await createSession(email);
    const response = NextResponse.json({ ok: true, email });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: sessionDurationSeconds,
    });
    response.cookies.set("realights_session_email", "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to start session" }, { status: 500 });
  }
}
