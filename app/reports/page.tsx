import AuditTrustBanner from "@/components/ai/AuditTrustBanner";
import ReportsPageClient from "./ReportsPageClient";
import ReportPrintHelper from "./ReportPrintHelper";

export default function ReportsPage() {
  return (
    <section className="space-y-6">
      <AuditTrustBanner />
      <ReportsPageClient />
      <ReportPrintHelper />
    </section>
  );
}
