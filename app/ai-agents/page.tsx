import AccountingAuditPanel from "@/components/ai/AccountingAuditPanel";
import AgentTestPanel from "@/components/ai/AgentTestPanel";

const safeguards = [
  { label: "System Mode", value: "SAFE", helper: "Agents can observe, report, and recommend only." },
  { label: "Write Actions", value: "Disabled", helper: "No automatic edits to sales, inventory, payments, or reports." },
  { label: "Auto Deploy", value: "Disabled", helper: "Deployment requires manual admin approval." },
  { label: "Auto Restore", value: "Disabled", helper: "Restore and reset actions require manual approval and checkpoint." },
];

const quickActions = [
  "Run accounting audit",
  "Check app health",
  "Create restore point plan",
  "Run data audit review",
  "Prepare deployment readiness report",
];

export default function AIAgentsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">AI Operations Center</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">AI Agents</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage and test Realights AI agents in safe mode. Agents are active for monitoring, audit, QA, and recommendations. Production write actions remain disabled.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
            Safe Mode Active
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {safeguards.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-5 text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>

      <AccountingAuditPanel />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Recommended Admin Actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <AgentTestPanel />
    </section>
  );
}
