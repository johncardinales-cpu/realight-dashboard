import { NextResponse } from "next/server";

const COOKIE_NAME = "realights_session";
const SESSION_VALUE = "active";

function text(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = text(body?.email).toLowerCase();
    const code = text(body?.code);
    const allowedEmail = text(process.env.REALIGHTS_ADMIN_EMAIL || process.env.ADMIN_EMAIL).toLowerCase();
    const allowedCode = text(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE);

    if (!allowedEmail || !allowedCode) {
      return NextResponse.json({ error: "Access is not configured. Set REALIGHTS_ADMIN_EMAIL and REALIGHTS_ACCESS_CODE in Vercel." }, { status: 500 });
    }

    if (email !== allowedEmail || code !== allowedCode) {
      return NextResponse.json({ error: "Invalid access details" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, SESSION_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to start session" }, { status: 500 });
  }
}
