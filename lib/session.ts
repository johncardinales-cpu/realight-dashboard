// Verified, short-lived session tokens. Legacy 'active' cookie is intentionally invalidated.
const MAX_AGE_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

export const SESSION_COOKIE = "realights_session";

export function allowedAdmins(): Set<string> {
  return new Set(
    [process.env.REALIGHTS_ADMIN_EMAILS, process.env.REALIGHTS_ADMIN_EMAIL, process.env.ADMIN_EMAIL]
      .filter(Boolean).join(",").toLowerCase().split(/[\s,;]+/).filter(Boolean)
  );
}

function signingSecret() {
  // Google private key is already configured in the same server runtime.
  // This high-entropy secret is combined with the login code; neither is sent to the browser.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const accessCode = process.env.REALIGHTS_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE || "";
  if (!privateKey || !accessCode) throw new Error("Session signing configuration is missing.");
  return privateKey + "::realights-session::" + accessCode;
}

async function key() {
  return crypto.subtle.importKey("raw", encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function encode(bytes: Uint8Array): string {
  let result = "";
  for (const value of bytes) result += String.fromCharCode(value);
  return btoa(result).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid session");
  const data = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(data, c => c.charCodeAt(0));
}

export async function createSession(email: string): Promise<string> {
  const payload = encoder.encode(JSON.stringify({
    email: email.toLowerCase(),
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
    nonce: crypto.randomUUID(),
  }));
  const sig = await crypto.subtle.sign("HMAC", await key(), payload);
  return encode(payload) + "." + encode(new Uint8Array(sig));
}

export async function readSession(token?: string): Promise<{ email: string } | null> {
  if (!token || token.length > 2048) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const payload = decode(parts[0]);
    const valid = await crypto.subtle.verify("HMAC", await key(), decode(parts[1]), payload);
    if (!valid) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (typeof parsed !== "object" || !parsed) return null;
    const value = parsed as { email?: unknown; exp?: unknown };
    const email = String(value.email || "").toLowerCase();
    if (!email || !allowedAdmins().has(email) || typeof value.exp !== "number"
      || value.exp <= Date.now() || value.exp > Date.now() + MAX_AGE_SECONDS * 1000 + 60000) return null;
    return { email };
  } catch {
    return null;
  }
}

export const sessionDurationSeconds = MAX_AGE_SECONDS;
