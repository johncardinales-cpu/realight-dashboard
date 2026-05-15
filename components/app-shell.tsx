"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import AIChatBox from "@/components/ai-chatbox";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) return <>{children}</>;

  return (
    <>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col bg-slate-50">
          <Topbar />
          <main className="min-w-0 flex-1 bg-slate-50 px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
            {children}
          </main>
        </div>
      </div>
      <AIChatBox />
    </>
  );
}
