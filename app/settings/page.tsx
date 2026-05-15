"use client";

import { useEffect, useMemo, useState } from "react";

type ThemeMode = "Light" | "Dark" | "System";
type AccentColor = "Emerald" | "Amber" | "Blue" | "Violet" | "Slate";
type FontSize = "Compact" | "Comfortable" | "Large";
type Density = "Compact" | "Comfortable" | "Spacious";

type StoredSettings = {
  theme: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  density: Density;
  defaultTaxRate: number;
  lowStockThreshold: number;
  companyName: string;
  enableDeliveryFee: boolean;
  enableInstallationFee: boolean;
  enableDiscount: boolean;
  enableTax: boolean;
};

const STORAGE_KEY = "realights_system_settings";

const defaultSettings: StoredSettings = {
  theme: "Light",
  accent: "Emerald",
  fontSize: "Comfortable",
  density: "Comfortable",
  defaultTaxRate: 0,
  lowStockThreshold: 10,
  companyName: "Reallights Solar",
  enableDeliveryFee: true,
  enableInstallationFee: true,
  enableDiscount: true,
  enableTax: true,
};

const businessRules = [
  { title: "Inventory Deduction", value: "Confirmed sales only", detail: "Draft, pending, and unpaid sales do not deduct stock. Inventory is deducted only when a sale is confirmed." },
  { title: "Customer-Billed Charges", value: "Sales / Cashiering", detail: "Delivery fee, installation fee, other charges, discounts, and tax belong inside the sales transaction if billed to the customer." },
  { title: "Company-Paid Costs", value: "Expenses", detail: "Courier cost, bank fees, payment processing fees, staff allowance, permits, utilities, and other company-paid costs belong in Expenses." },
  { title: "Linked Expenses", value: "Related Sales Ref No.", detail: "Sale-related expenses should be linked to an existing Sales Ref No., Group Ref, or Sale ID for profit review." },
  { title: "Receiving Stock", value: "Incoming Deliveries", detail: "Available means received and ready to sell. Damaged means received but not sellable. Replacement items should be new delivery records." },
  { title: "Audit Trail", value: "Audit_Log", detail: "Sales, payments, expenses, delivery status changes, confirmations, undo actions, and resets should appear in Recent Activity / Activity Log." },
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

const envItems = ["GOOGLE_SHEET_ID", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "REALIGHTS_ADMIN_EMAIL", "REALIGHTS_ACCESS_CODE"];

const accentClasses: Record<AccentColor, string> = {
  Emerald: "bg-emerald-600 text-white ring-emerald-100",
  Amber: "bg-amber-500 text-white ring-amber-100",
  Blue: "bg-blue-600 text-white ring-blue-100",
  Violet: "bg-violet-600 text-white ring-violet-100",
  Slate: "bg-slate-700 text-white ring-slate-100",
};

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const className = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{children}</span>;
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
      {helper ? <span className="block text-[11px] leading-4 text-slate-500">{helper}</span> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label, helper }: { checked: boolean; onChange: (value: boolean) => void; label: string; helper: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
      <span>
        <span className="block text-sm font-bold text-slate-950">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{helper}</span>
      </span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? "bg-emerald-600" : "bg-slate-300"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoredSettings>(defaultSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...defaultSettings, ...JSON.parse(stored) });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  const fontPreviewClass = useMemo(() => {
    if (settings.fontSize === "Compact") return "text-sm";
    if (settings.fontSize === "Large") return "text-lg";
    return "text-base";
  }, [settings.fontSize]);

  const densityPreviewClass = useMemo(() => {
    if (settings.density === "Compact") return "p-3";
    if (settings.density === "Spacious") return "p-6";
    return "p-4";
  }, [settings.density]);

  function update<K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function saveSettings() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme.toLowerCase();
    document.documentElement.dataset.accent = settings.accent.toLowerCase();
    document.documentElement.dataset.fontSize = settings.fontSize.toLowerCase();
    document.documentElement.style.fontSize = settings.fontSize === "Compact" ? "14px" : settings.fontSize === "Large" ? "17px" : "16px";
    setMessage("Settings saved on this browser. Full company-wide settings can be connected to the database/settings sheet later.");
  }

  function resetSettings() {
    setSettings(defaultSettings);
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.style.fontSize = "16px";
    setMessage("Settings reset to default on this browser.");
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">System Configuration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Control appearance preferences, business defaults, cashiering rules, and readiness settings for Realights POS.</p>
        {message ? <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {readiness.map((item) => <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{item.label}</p><div className="mt-3"><StatusBadge tone={item.tone}>{item.status}</StatusBadge></div></div>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Appearance</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">These preferences help users adjust readability during training and daily use.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Theme" helper="Light is safest for the current dashboard. Dark/System are prepared preferences.">
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={settings.theme} onChange={(e) => update("theme", e.target.value as ThemeMode)}><option>Light</option><option>Dark</option><option>System</option></select>
            </Field>
            <Field label="Accent Color" helper="Main highlight color preference.">
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={settings.accent} onChange={(e) => update("accent", e.target.value as AccentColor)}><option>Emerald</option><option>Amber</option><option>Blue</option><option>Violet</option><option>Slate</option></select>
            </Field>
            <Field label="Font Size" helper="Adjust readability for different screens.">
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={settings.fontSize} onChange={(e) => update("fontSize", e.target.value as FontSize)}><option>Compact</option><option>Comfortable</option><option>Large</option></select>
            </Field>
            <Field label="Display Density" helper="Controls how much spacing users prefer.">
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={settings.density} onChange={(e) => update("density", e.target.value as Density)}><option>Compact</option><option>Comfortable</option><option>Spacious</option></select>
            </Field>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Preview</h2>
          <div className={`mt-4 rounded-2xl border border-slate-200 bg-slate-50 ${densityPreviewClass}`}>
            <div className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-4 ${accentClasses[settings.accent]}`}>{settings.accent} Accent</div>
            <p className={`font-semibold text-slate-950 ${fontPreviewClass}`}>Sample dashboard text size</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Theme preference: {settings.theme}. Density: {settings.density}.</p>
          </div>
          <div className="mt-4 flex gap-3"><button type="button" onClick={saveSettings} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Save Settings</button><button type="button" onClick={resetSettings} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Reset</button></div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Business Defaults</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Company Name" helper="Used in future receipts/exports."><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={settings.companyName} onChange={(e) => update("companyName", e.target.value)} /></Field>
          <Field label="Default Tax Rate (%)" helper="Suggested rate for future cashiering default."><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={settings.defaultTaxRate} onChange={(e) => update("defaultTaxRate", Number(e.target.value))} /></Field>
          <Field label="Low Stock Threshold" helper="Suggested warning level for stock review."><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" value={settings.lowStockThreshold} onChange={(e) => update("lowStockThreshold", Number(e.target.value))} /></Field>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Sales & Cashiering Controls</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Toggle checked={settings.enableDeliveryFee} onChange={(value) => update("enableDeliveryFee", value)} label="Delivery Fee" helper="Customer-billed delivery charge inside Sales/Cashiering." />
          <Toggle checked={settings.enableInstallationFee} onChange={(value) => update("enableInstallationFee", value)} label="Installation Fee" helper="Customer-billed installation charge inside Sales/Cashiering." />
          <Toggle checked={settings.enableDiscount} onChange={(value) => update("enableDiscount", value)} label="Discount" helper="Allows discount to reduce the customer bill." />
          <Toggle checked={settings.enableTax} onChange={(value) => update("enableTax", value)} label="Tax" helper="Allows tax calculation in cashiering." />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Other Settings Recommended Later</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {["Receipt logo and footer", "Invoice numbering format", "Default payment methods", "Default report period", "Backup schedule", "Notification rules", "Per-role page access", "Audit export retention", "Database migration target"].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">{item}</div>)}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Business Rules</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {businessRules.map((rule) => <div key={rule.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-bold text-slate-950">{rule.title}</h3><span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{rule.value}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{rule.detail}</p></div>)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Required Environment Variables</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">These must be configured in Vercel. Secret values are never displayed inside the app.</p>
          <div className="mt-4 space-y-3">{envItems.map((item) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><code className="text-sm font-bold text-slate-800">{item}</code><StatusBadge tone="green">Configured externally</StatusBadge></div>)}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Current Accounting Formula</h2>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-white"><p>Product Subtotal</p><p>+ Delivery Fee billed to customer</p><p>+ Installation Fee billed to customer</p><p>+ Other Charge billed to customer</p><p>- Discount</p><p>= Taxable Base</p><p>+ Tax</p><p className="mt-2 font-bold text-emerald-300">= Grand Total</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Payments and balances should be checked against Grand Total during final testing.</p>
        </div>
      </div>
    </section>
  );
}
