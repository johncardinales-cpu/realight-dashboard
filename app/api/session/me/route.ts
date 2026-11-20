import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";

const COOKIE_NAME = "realights_session";

type AdminProfile = {
  name: string;
  email: string;
  role: "Admin";
  initials: string;
};

const ADMIN_PROFILES: Record<string, AdminProfile> = {
  "john.cardinales@gmail.com": {
    name: "John Cardinales",
    email: "john.cardinales@gmail.com",
    role: "Admin",
    initials: "JC",
  },
  "fuenteseiche@gmail.com": {
    name: "Richelle Lou Fuentes",
    email: "fuenteseiche@gmail.com",
    role: "Admin",
    initials: "RF",
  },
};

function readCookie(cookieHeader: string, name: string) {
  const entry = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!entry) return "";
  return decodeURIComponent(entry.slice(name.length + 1));
}

function titleFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Admin";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Admin User";
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "A";
}

function profileForEmail(email: string): AdminProfile {
  const normalizedEmail = email.toLowerCase();
  const knownProfile = ADMIN_PROFILES[normalizedEmail];
  if (knownProfile) return knownProfile;

  const name = normalizedEmail ? titleFromEmail(normalizedEmail) : "Admin User";
  return {
    name,
    email: normalizedEmail || "Signed in admin",
    role: "Admin",
    initials: initialsFromName(name),
  };
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const session = await readSession(readCookie(cookieHeader, COOKIE_NAME));

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const email = session.email;
  return NextResponse.json({ profile: profileForEmail(email) });
}
