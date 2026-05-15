const businessRules = [
  {
    title: "Inventory Deduction",
    value: "Confirmed sales only",
    detail: "Draft, pending, and unpaid sales do not deduct stock. Inventory is deducted only when a sale is confirmed.",
  },
  {
    title: "Customer-Billed Charges",
    value: "Sales / Cashiering",
    detail: "Delivery fee, installation fee, other charges, discounts, and tax belong inside the sales transaction if billed to the customer.",
  },
  {
    title: "Company-Paid Costs",
    value: "Expenses",
    detail: "Courier cost, bank fees, payment processing fees, staff allowance, permits, utilities, and other company-paid costs belong in Expenses.",
  },
  {
    title: "Linked Expenses",
    value: "Related Sales Ref No.",
    detail: "Sale-related expenses should be linked to an existing Sales Ref No., Group Ref, or Sale ID for profit review.",
  },
  {
    title: "Receiving Stock",
    value: "Incoming Deliveries",
    detail: "Available means received and ready to sell. Damaged means received but not sellable. Replacement items should be new delivery records.",
  },
  {
    title: "Audit Trail",
    value: "Audit_Log",
    detail: "Sales, payments, expenses, delivery status changes, confirmations, undo actions, and resets should appear in Recent Activity / Activity Log.",
  },
];

const readiness = [
  { label: "Login gate", status: "Added", tone: "green" },
  { label: "Sales charges", status: "Added", tone: "green" },
  { label: "Tax in cashiering", status: "Added", tone: "green" },
  { label: "Expenses module", status: "Added", tone: "green" },
  { label: "Expense to sale linking", status: "Validated", tone: "green" },
  { label: "Recent Activity", status: "Audit synced", tone: "green" },
  { label: "Migration readiness", status: "Ready", tone: "green" },
  { label: "Payments/Reports tax check", status: "Needs final verification", tone: "amber" },
];

const envItems = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "REALIGHTS_ADMIN_EMAIL",
  "REALIGHTS_ACCESS_CODE",
];

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const className = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{children}</span>;
}

export default function SettingsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">System Configuration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review the current operating rules for Realights POS. This page is intentionally read-only for the trial build so critical settings are not accidentally changed during testing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {readiness.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{item.label}</p>
            <div className="mt-3"><StatusBadge tone={item.tone}>{item.status}</StatusBadge></div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Business Rules</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {businessRules.map((rule) => (
            <div key={rule.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-slate-950">{rule.title}</h3>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{rule.value}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{rule.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Required Environment Variables</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">These must be configured in Vercel. Secret values are never displayed inside the app.</p>
          <div className="mt-4 space-y-3">
            {envItems.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <code className="text-sm font-bold text-slate-800">{item}</code>
                <StatusBadge tone="green">Configured externally</StatusBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Current Accounting Formula</h2>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-white">
            <p>Product Subtotal</p>
            <p>+ Delivery Fee billed to customer</p>
            <p>+ Installation Fee billed to customer</p>
            <p>+ Other Charge billed to customer</p>
            <p>- Discount</p>
            <p>= Taxable Base</p>
            <p>+ Tax</p>
            <p className="mt-2 font-bold text-emerald-300">= Grand Total</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Payments and balances should be checked against Grand Total during final testing.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-amber-950">Before Calling the Project Complete</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Complete final end-to-end testing after Vercel deploys: login, create sale with charges/tax, record payment, add linked expense, confirm sale, check inventory, check reports, and verify Recent Activity / Activity Log.
        </p>
      </div>
    </section>
  );
}
