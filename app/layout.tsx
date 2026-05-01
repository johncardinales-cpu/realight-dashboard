import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";

export const metadata: Metadata = {
  title: "Realight Dashboard",
  description: "Realight Corporation Report",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Sidebar />

          <div className="flex min-h-screen min-w-0 flex-col bg-slate-50">
            <Topbar />
            <main className="min-w-0 flex-1 bg-slate-50 px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
