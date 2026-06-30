import AuditTrustBanner from "@/components/ai/AuditTrustBanner";
import DashboardClient from "./dashboard-client";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <AuditTrustBanner />
      <DashboardClient />
    </section>
  );
}
