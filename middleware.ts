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
    pathname.startsWith("/api/session/me") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function toNumber(value: unknown) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function errorResponse(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function auditPaymentProcedure(body: any) {
  const status = String(body?.paymentStatus || "Pending").trim().toLowerCase();
  const method = String(body?.paymentMethod || "").trim().toLowerCase();
  const amountPaid = roundMoney(toNumber(body?.amountPaidPhp));
  const productSubtotal = Array.isArray(body?.items)
    ? body.items.reduce((sum: number, item: any) => sum + toNumber(item?.qty) * toNumber(item?.unitPricePhp), 0)
    : toNumber(body?.grandTotalPhp || body?.totalSalePhp);
  const charges = toNumber(body?.deliveryFeePhp) + toNumber(body?.installationFeePhp) + toNumber(body?.otherChargePhp);
  const discount = toNumber(body?.discountPhp);
  const taxableBase = roundMoney(Math.max(productSubtotal + charges - discount, 0));
  const taxAmount = body?.taxAmountPhp !== undefined ? toNumber(body?.taxAmountPhp) : roundMoney(taxableBase * (toNumber(body?.taxRatePct) / 100));
  const grandTotal = roundMoney(toNumber(body?.grandTotalPhp || body?.totalSalePhp) || taxableBase + taxAmount);
  const appliedPaid = roundMoney(Math.min(amountPaid, grandTotal));
  const balance = roundMoney(Math.max(grandTotal - appliedPaid, 0));

  if (grandTotal <= 0) return "Payment procedure review: Grand total must be greater than zero before saving.";
  if (status === "pending" && appliedPaid > 0) return "Payment procedure review: Payment Status is Pending but a paid amount was entered. Use Partial or Paid, or set paid amount to zero.";
  if (status === "partial") {
    if (appliedPaid <= 0) return "Payment procedure review: Payment Status is Partial but no paid amount was entered. Enter the partial amount or use Pending.";
    if (appliedPaid + 0.009 >= grandTotal) return "Payment procedure review: Payment Status is Partial but the paid amount covers the full total. Use Paid instead.";
    if (method === "cash") return `Payment procedure review: Partial sale cannot use plain Cash as payment method. Use Installment, Mixed Payment, Bank Transfer, GCash, Maya, Check, or Credit so the remaining balance is tracked. Remaining balance: PHP ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
  }
  if (status === "paid" && appliedPaid + 0.009 < grandTotal) return `Payment procedure review: Payment Status is Paid but paid amount is less than the grand total. Use Partial or collect the remaining PHP ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
  return "";
}

async function auditRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shouldAuditSaleCreate = pathname === "/api/sales" && request.method === "POST";
  const shouldAuditPaymentEdit = pathname === "/api/sales/confirm" && request.method === "PATCH";
  if (!shouldAuditSaleCreate && !shouldAuditPaymentEdit) return null;

  try {
    const body = await request.clone().json();
    if (shouldAuditPaymentEdit && String(body?.action || "").toLowerCase() !== "update-payment") return null;
    const issue = auditPaymentProcedure(body);
    return issue ? errorResponse(issue) : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = session === SESSION_VALUE;
  const adminEmailConfigured = Boolean(process.env.REALIGHTS_ADMIN_EMAILS || process.env.REALIGHTS_ADMIN_EMAIL || process.env.ADMIN_EMAIL);

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

  const auditBlock = await auditRequest(request);
  if (auditBlock) return auditBlock;

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
