import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Realight Dashboard",
  description: "Realight Corporation Report",
};

const settingsScript = `
(function () {
  try {
    var raw = window.localStorage.getItem("realights_system_settings");
    if (!raw) return;
    var settings = JSON.parse(raw);
    var root = document.documentElement;
    var theme = settings.theme || "Light";
    if (theme === "System") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
    }
    root.dataset.theme = String(theme).toLowerCase();
    root.dataset.accent = String(settings.accent || "Emerald").toLowerCase();
    root.dataset.fontSize = String(settings.fontSize || "Comfortable").toLowerCase();
    root.dataset.density = String(settings.density || "Comfortable").toLowerCase();
    root.style.fontSize = settings.fontSize === "Compact" ? "14px" : settings.fontSize === "Large" ? "17px" : "16px";
  } catch (error) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
        <Script id="realights-settings" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: settingsScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
