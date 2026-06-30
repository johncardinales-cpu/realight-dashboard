import AccountingAuditPanel from "@/components/ai/AccountingAuditPanel";

export default function AccountingAuditPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-600">Audit Center</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Accounting Reconciliation</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Run this before trusting reports. It checks Sales, Payments, Customer balances, open receivables, inventory movement, expense payables, credits, and double-count risk.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
            Read-only audit
          </div>
        </div>
      </div>

      <AccountingAuditPanel />
    </section>
  );
}
