import { NextResponse } from "next/server";

const COOKIE_NAME = "realights_session";
const EMAIL_COOKIE_NAME = "realights_session_email";

function expiredCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", expiredCookieOptions());
  response.cookies.set(EMAIL_COOKIE_NAME, "", expiredCookieOptions());
  return response;
}
