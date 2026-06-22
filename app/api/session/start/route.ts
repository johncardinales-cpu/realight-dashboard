import { NextResponse } from "next/server";

const COOKIE_NAME = "realights_session";
const EMAIL_COOKIE_NAME = "realights_session_email";
const SESSION_VALUE = "active";
const SESSION_MAX_AGE = 60 * 60 * 12;
const EXTRA_ADMIN_EMAILS = ["fuenteseiche@gmail.com"];

function text(value: unknown) {
  return String(value || "").trim();
}

function parseEmails(value: unknown) {
  return text(value)
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = text(body?.email).toLowerCase();
    const code = text(body?.code);
    const allowedEmails = new Set([
      ...parseEmails(process.env.REALIGHTS_ADMIN_EMAILS),
      ...parseEmails(process.env.REALIGHTS_ADMIN_EMAIL || process.env.ADMIN_EMAIL),
      ...EXTRA_ADMIN_EMAILS,
    ]);
    const allowedCode = text(process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE);

    if (!allowedEmails.size || !allowedCode) {
      return NextResponse.json({ error: "Access is not configured. Set REALIGHTS_ADMIN_EMAILS/REALIGHTS_ADMIN_EMAIL and REALIGHTS_ACCESS_CODE in Vercel." }, { status: 500 });
    }

    if (!allowedEmails.has(email) || code !== allowedCode) {
      return NextResponse.json({ error: "Invalid access details" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, email });
    response.cookies.set(COOKIE_NAME, SESSION_VALUE, sessionCookieOptions());
    response.cookies.set(EMAIL_COOKIE_NAME, email, sessionCookieOptions());
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to start session" }, { status: 500 });
  }
}
