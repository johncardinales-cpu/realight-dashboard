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
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
          <Sidebar />

          <div className="flex min-h-screen min-w-0 flex-col bg-slate-50">
            <Topbar />
            <main className="flex-1 bg-slate-50 p-5 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
