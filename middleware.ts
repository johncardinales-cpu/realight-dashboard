import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "realights_session";
const SESSION_VALUE = "active";

const ADMIN_ONLY_PATHS = [
  "/migration",
  "/testing-reset",
  "/users",
  "/settings",
];

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/admin-only" ||
    pathname.startsWith("/api/session/start") ||
    pathname.startsWith("/api/session/end") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = session === SESSION_VALUE;
  const adminEmailConfigured = Boolean(process.env.REALIGHTS_ADMIN_EMAIL || process.env.ADMIN_EMAIL);

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isPublicPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAdminOnlyPath(pathname) && !adminEmailConfigured) {
    return NextResponse.redirect(new URL("/admin-only", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
