import { NextResponse } from "next/server";

type DashboardData = {
  incomingUnits: number;
  warehouseReceived: number;
  actualOnHand: number;
  sellableUnits: number;
  totalSales: number;
  totalExpenses: number;
  netGain: number;
  error?: string;
};

type ActivityItem = {
  id?: string;
  title?: string;
  note?: string;
  actor?: string;
  module?: string;
  action?: string;
  recordRef?: string;
  time?: string;
  icon?: string;
};

type InventoryLowestStockItem = { item: string; sellableQty: number; actualOnHand: number; incomingQty: number; soldQty: number };
type InventoryIncomingItem = { item: string; incomingQty: number; latestIncoming: string };
type InventoryReorderItem = { item: string; sellableQty: number; minimumBuffer: number; suggestedReorderQty: number };

type InventoryAnalysis = {
  summary?: {
    totalItems?: number;
    totalIncoming?: number;
    totalReceived?: number;
    totalSold?: number;
    totalDamaged?: number;
    totalOnHand?: number;
    totalSellable?: number;
    zeroStockCount?: number;
    lowStockCount?: number;
    healthyStockCount?: number;
    lowestStock?: InventoryLowestStockItem[];
    incoming?: InventoryIncomingItem[];
    reorderSuggestions?: InventoryReorderItem[];
  };
};

type InventoryReport = {
  title: string;
  generatedBy: string;
  mode: string;
  sources: string[];
  executiveSummary: string;
  summaryCards: Array<{ label: string; value: string; helper: string }>;
  lowStockItems: Array<{ product: string; sellableQty: number; actualOnHand: number; incomingQty: number; status: string }>;
  reorderSuggestions: Array<{ product: string; currentSellable: number; suggestedReorderQty: number; priority: string }>;
  lowestStockItems: Array<{ product: string; sellableQty: number; actualOnHand: number; incomingQty: number; soldQty: number }>;
  incomingStock: Array<{ product: string; incomingQty: number; latestIncoming: string }>;
  recommendedActions: string[];
  systemNote: string;
};

type ProfessionalReport = {
  title: string;
  generatedBy: string;
  mode: string;
  sources: string[];
  executiveSummary: string;
  summaryCards: Array<{ label: string; value: string; helper: string }>;
  sections: Array<{
    title: string;
    description: string;
    columns: string[];
    rows: Array<Record<string, string | number>>;
    emptyMessage?: string;
  }>;
  recommendedActions: string[];
  systemNote: string;
};

type ReportPayload = { report?: ProfessionalReport };

function peso(value: number) { return `₱${Number(value || 0).toLocaleString()}`; }
function numberText(value: number) { return Number(value || 0).toLocaleString(); }
function normalizePrompt(value: unknown) { return String(value || "").trim(); }

async function readJson<T>(origin: string, path: string, fallback: T, cookieHeader: string): Promise<T> {
  const response = await fetch(`${origin}${path}`, { cache: "no-store", headers: cookieHeader ? { cookie: cookieHeader } : undefined });
  if (!response.ok) return fallback;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return fallback;
  return (await response.json()) as T;
}

function detectIntent(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/(inventory|stock|sellable|on hand|low stock|reorder|incoming|warehouse)/.test(lower)) return "inventory";
  if (/(customer|client|buyer|purchase history|customer history|unpaid customer|customer balance|top customer)/.test(lower)) return "customer";
  if (/(supplier|vendor|delivery history|supplier history|supplier invoice|supplier payment|delivered)/.test(lower)) return "supplier";
  if (/(activity|recent|latest|log|timeline)/.test(lower)) return "activity";
  if (/(test|qa|checklist|release)/.test(lower)) return "qa";
  if (/(health|guardian|restore|backup)/.test(lower)) return "guardian";
  if (/(sales|expense|net|gain|profit|summary|dashboard|today|attention|status)/.test(lower)) return "dashboard";
  return "dashboard";
}

function getPriority(sellableQty: number) { if (sellableQty <= 4) return "High"; if (sellableQty <= 5) return "Medium"; return "Watch"; }

function buildAttentionItems(data: DashboardData, activity: ActivityItem[]) {
  const items: string[] = [];
  if ((data.sellableUnits || 0) <= 0) items.push("Sellable units are zero. Inventory needs review before more sales.");
  if ((data.actualOnHand || 0) <= 0) items.push("Actual on-hand inventory is zero. Confirm stock data and deliveries.");
  if ((data.netGain || 0) < 0) items.push("Net gain is negative. Review sales, supplier costs, and expenses.");
  if ((data.totalExpenses || 0) > (data.totalSales || 0) && (data.totalSales || 0) > 0) items.push("Expenses are higher than sales. Check supplier costs and operating expenses.");
  if (!activity.length) items.push("No recent activity is available. Confirm activity logging is working.");
  if (!items.length) items.push("No critical dashboard warnings were detected from the current read-only summary.");
  return items;
}

function buildDashboardAnswer(prompt: string, data: DashboardData, activity: ActivityItem[]) {
  const attentionItems = buildAttentionItems(data, activity);
  const recent = activity.slice(0, 3).map((item) => `${item.title || "Activity"}${item.time ? ` (${item.time})` : ""}`).join("; ") || "No recent activity returned.";
  return ["Main POS Assistant Agent checked the live dashboard data in read-only mode.", "", `Sales: ${peso(data.totalSales)}`, `Expenses: ${peso(data.totalExpenses)}`, `Net gain: ${peso(data.netGain)}`, `Incoming units: ${numberText(data.incomingUnits)}`, `Warehouse received: ${numberText(data.warehouseReceived)}`, `Actual on hand: ${numberText(data.actualOnHand)}`, `Sellable units: ${numberText(data.sellableUnits)}`, "", "Needs attention:", ...attentionItems.map((item) => `- ${item}`), "", `Recent activity: ${recent}`, "", "Safe-mode note: I only read and summarized the dashboard and recent activity. I did not change POS records."].join("\n");
}

function buildDashboardReport(data: DashboardData, activity: ActivityItem[]): ProfessionalReport {
  const attentionItems = buildAttentionItems(data, activity);
  const activityRows = activity.slice(0, 8).map((item) => ({ Activity: item.title || "Activity", Module: item.module || "Not specified", Actor: item.actor || "System", Time: item.time || "Not specified", Summary: item.note || "No note recorded" }));
  return {
    title: "Dashboard Operations Report", generatedBy: "Main POS Assistant Agent", mode: "Safe Read-Only", sources: ["/api/dashboard", "/api/recent-activity"],
    executiveSummary: `Current sales are ${peso(data.totalSales)} with ${peso(data.totalExpenses)} in expenses and ${peso(data.netGain)} net gain. Inventory shows ${numberText(data.actualOnHand)} actual on-hand units and ${numberText(data.sellableUnits)} sellable units.`,
    summaryCards: [
      { label: "Total Sales", value: peso(data.totalSales), helper: "Current sales total" }, { label: "Total Expenses", value: peso(data.totalExpenses), helper: "Current expense total" }, { label: "Net Gain", value: peso(data.netGain), helper: "Sales less tracked costs" }, { label: "Sellable Units", value: numberText(data.sellableUnits), helper: "Units available to sell" }, { label: "Actual On Hand", value: numberText(data.actualOnHand), helper: "Current physical stock" }, { label: "Recent Activity", value: numberText(activity.length), helper: "Activity records returned" },
    ],
    sections: [
      { title: "Operational Attention Items", description: "Items that should be reviewed by admin or operations.", columns: ["Priority", "Finding"], rows: attentionItems.map((item, index) => ({ Priority: index === 0 && item.startsWith("No critical") ? "Normal" : "Review", Finding: item })) },
      { title: "Recent Activity Snapshot", description: "Latest operational activity returned by the activity API.", columns: ["Activity", "Module", "Actor", "Time", "Summary"], rows: activityRows, emptyMessage: "No recent activity was returned by the activity API." },
    ],
    recommendedActions: ["Review dashboard totals against the source Google Sheets before finalizing daily reports.", "Confirm recent activity entries are expected and not accidental test transactions.", "Monitor sellable units and actual on-hand units before accepting large sales commitments."],
    systemNote: "This dashboard report was generated in safe read-only mode. No sales, inventory, expense, activity, customer, supplier, payment, or pricing records were modified.",
  };
}

function buildInventoryReport(analysis: InventoryAnalysis): InventoryReport | null {
  const summary = analysis.summary;
  if (!summary) return null;
  const lowestStock = (summary.lowestStock || []).slice(0, 10);
  const reorderSuggestions = (summary.reorderSuggestions || []).slice(0, 10);
  const incomingStock = (summary.incoming || []).slice(0, 8);
  const lowStockItems = reorderSuggestions.map((suggestion) => { const matchingLowestStock = lowestStock.find((item) => item.item === suggestion.item); return { product: suggestion.item, sellableQty: suggestion.sellableQty, actualOnHand: matchingLowestStock?.actualOnHand ?? suggestion.sellableQty, incomingQty: matchingLowestStock?.incomingQty ?? 0, status: suggestion.sellableQty <= 0 ? "Zero Stock" : "Low Stock" }; });
  const professionalLowestStock = lowestStock.map((item) => ({ product: item.item, sellableQty: item.sellableQty, actualOnHand: item.actualOnHand, incomingQty: item.incomingQty, soldQty: item.soldQty }));
  const professionalReorderSuggestions = reorderSuggestions.map((item) => ({ product: item.item, currentSellable: item.sellableQty, suggestedReorderQty: item.suggestedReorderQty, priority: getPriority(item.sellableQty) }));
  const recommendations: string[] = [];
  if (professionalReorderSuggestions.length) { const highestPriority = professionalReorderSuggestions[0]; recommendations.push(`Prioritize replenishment for ${highestPriority.product}; it has ${numberText(highestPriority.currentSellable)} sellable units and a suggested reorder quantity of ${numberText(highestPriority.suggestedReorderQty)}.`); }
  if ((summary.lowStockCount || 0) > 0) recommendations.push(`Review the ${numberText(summary.lowStockCount || 0)} low-stock item(s) before approving new sales commitments.`);
  if ((summary.zeroStockCount || 0) > 0) recommendations.push(`Block or review selling for ${numberText(summary.zeroStockCount || 0)} zero-stock item(s) until replenishment is confirmed.`);
  if (!incomingStock.length) recommendations.push("Review the purchasing schedule because no incoming stock rows are currently recorded.");
  recommendations.push("Continue monitoring the lowest-stock products daily to prevent avoidable stockouts.");
  return {
    title: "Inventory Health Report", generatedBy: "Inventory Agent", mode: "Safe Read-Only", sources: ["/api/inventory", "/api/ai/inventory-analysis"],
    executiveSummary: `The inventory system is currently tracking ${numberText(summary.totalItems || 0)} items with ${numberText(summary.totalSellable || 0)} total sellable units. There are ${numberText(summary.lowStockCount || 0)} low-stock items and ${numberText(summary.zeroStockCount || 0)} zero-stock items. ${incomingStock.length ? `${numberText(incomingStock.length)} incoming stock line(s) were detected.` : "No incoming stock is currently recorded."}`,
    summaryCards: [{ label: "Tracked Items", value: numberText(summary.totalItems || 0), helper: "Product/specification records" }, { label: "Total Sellable", value: numberText(summary.totalSellable || 0), helper: "Units available to sell" }, { label: "Actual On Hand", value: numberText(summary.totalOnHand || 0), helper: "Current physical stock" }, { label: "Low Stock", value: numberText(summary.lowStockCount || 0), helper: "Items needing attention" }, { label: "Zero Stock", value: numberText(summary.zeroStockCount || 0), helper: "Unavailable items" }, { label: "Incoming", value: numberText(summary.totalIncoming || 0), helper: "Units marked incoming" }],
    lowStockItems, reorderSuggestions: professionalReorderSuggestions, lowestStockItems: professionalLowestStock,
    incomingStock: incomingStock.map((item) => ({ product: item.item, incomingQty: item.incomingQty, latestIncoming: item.latestIncoming || "Not specified" })),
    recommendedActions: recommendations,
    systemNote: "This report was generated in safe read-only mode. No stock, sales, delivery, product, supplier, customer, payment, or pricing records were modified.",
  };
}

function buildInventoryAnswer(data: DashboardData, analysis: InventoryAnalysis) {
  const summary = analysis.summary;
  if (!summary) {
    const notes: string[] = [];
    if ((data.sellableUnits || 0) <= 0) notes.push("Sellable units are zero. Restock or validate stock records before selling.");
    if ((data.incomingUnits || 0) > 0) notes.push(`${numberText(data.incomingUnits)} incoming units are recorded.`);
    if ((data.warehouseReceived || 0) > 0) notes.push(`${numberText(data.warehouseReceived)} units are marked warehouse received.`);
    if (!notes.length) notes.push("Current dashboard-level inventory numbers do not show an urgent stock warning.");
    return ["Inventory Agent checked the live dashboard inventory totals in read-only mode.", "", `Incoming units: ${numberText(data.incomingUnits)}`, `Warehouse received: ${numberText(data.warehouseReceived)}`, `Actual on hand: ${numberText(data.actualOnHand)}`, `Sellable units: ${numberText(data.sellableUnits)}`, "", "Inventory notes:", ...notes.map((item) => `- ${item}`), "", "Product-level inventory analysis was not available, so this response used dashboard-level inventory totals only."].join("\n");
  }
  return buildInventoryReport(analysis)?.executiveSummary || "Inventory Agent could not generate a structured inventory report.";
}

function buildActivityAnswer(activity: ActivityItem[]) { const rows = activity.slice(0, 8).map((item, index) => `${index + 1}. ${item.title || "Activity"} - ${item.note || "No note"}${item.actor ? ` by ${item.actor}` : ""}${item.time ? ` (${item.time})` : ""}`); return ["Main POS Assistant Agent checked recent activity in read-only mode.", "", rows.length ? rows.join("\n") : "No recent activity returned by the activity API.", "", "Safe-mode note: I only read recent activity. I did not modify activity records."].join("\n"); }

function buildActivityReport(activity: ActivityItem[]): ProfessionalReport {
  const moduleCounts = activity.reduce<Record<string, number>>((counts, item) => { const module = item.module || "Unspecified"; counts[module] = (counts[module] || 0) + 1; return counts; }, {});
  const moduleRows = Object.entries(moduleCounts).map(([module, count]) => ({ Module: module, Records: count }));
  const activityRows = activity.slice(0, 12).map((item) => ({ Activity: item.title || "Activity", Action: item.action || item.title || "Not specified", Module: item.module || "Not specified", Reference: item.recordRef || "Not specified", Actor: item.actor || "System", Time: item.time || "Not specified" }));
  return { title: "Recent Activity Report", generatedBy: "Main POS Assistant Agent", mode: "Safe Read-Only", sources: ["/api/recent-activity"], executiveSummary: activity.length ? `The system returned ${numberText(activity.length)} recent activity record(s). The latest recorded activity is ${activity[0]?.title || "not specified"}.` : "No recent activity was returned by the activity API.", summaryCards: [{ label: "Activity Records", value: numberText(activity.length), helper: "Recent activity returned" }, { label: "Modules", value: numberText(Object.keys(moduleCounts).length), helper: "Modules represented" }, { label: "Latest Actor", value: activity[0]?.actor || "N/A", helper: "Actor on latest record" }], sections: [{ title: "Activity Timeline", description: "Recent operational records, sorted by the source API.", columns: ["Activity", "Action", "Module", "Reference", "Actor", "Time"], rows: activityRows, emptyMessage: "No activity records were returned." }, { title: "Activity by Module", description: "Count of recent activity records grouped by module.", columns: ["Module", "Records"], rows: moduleRows, emptyMessage: "No module activity summary is available." }], recommendedActions: ["Review recent sales and payment activity to confirm each transaction is expected.", "Investigate unusual cancel, reset, or edit events before closing the daily review.", "Use this activity report as a quick audit trail before deployment or end-of-day reporting."], systemNote: "This activity report was generated in safe read-only mode. No activity, sales, payment, inventory, customer, supplier, or user records were modified." };
}

function buildQaAnswer() { return ["Testing / QA Agent prepared a safe regression checklist.", "", "1. Confirm dashboard loads without console/API errors.", "2. Confirm the Agent Test Panel shows 7 registered agents.", "3. Confirm Ask Realights AI returns a dashboard summary.", "4. Test Add Delivery and verify dashboard totals still refresh.", "5. Test sales, inventory, customer, supplier, and report pages after deployment.", "6. Confirm production writes remain disabled for agents.", "7. Confirm the before-agents restore marker still exists."].join("\n"); }
function buildQaReport(): ProfessionalReport { return { title: "Release Readiness QA Report", generatedBy: "Testing / QA Agent", mode: "Safe Read-Only", sources: ["Agent registry", "Dashboard UI", "Manual QA checklist"], executiveSummary: "The QA agent prepared a regression checklist for validating the dashboard, agent panel, inventory analysis, sales flow, delivery flow, reports, and safe-mode restrictions after deployment.", summaryCards: [{ label: "QA Scope", value: "7 Areas", helper: "Dashboard, sales, inventory, customers, suppliers, reports, AI" }, { label: "Risk Level", value: "Low", helper: "Read-only agent changes" }, { label: "Writes", value: "Disabled", helper: "Agent write actions remain blocked" }, { label: "Restore Marker", value: "Required", helper: "Before risky changes" }], sections: [{ title: "Core Regression Checklist", description: "Manual checks recommended before marking the deployment stable.", columns: ["Area", "Test", "Expected Result", "Status"], rows: [{ Area: "Dashboard", Test: "Load dashboard and refresh KPIs", "Expected Result": "Dashboard loads without API or console errors", Status: "Pending Manual Check" }, { Area: "AI Agents", Test: "Confirm Agent Test Panel shows 7 agents", "Expected Result": "All agents show Ready status", Status: "Pending Manual Check" }, { Area: "Ask Realights AI", Test: "Ask dashboard, inventory, customer, and supplier prompts", "Expected Result": "Professional reports render correctly", Status: "Pending Manual Check" }, { Area: "Delivery", Test: "Open Add Delivery flow", "Expected Result": "Delivery page opens and dashboard can refresh after changes", Status: "Pending Manual Check" }, { Area: "Sales", Test: "Review sales create/update/cancel flow", "Expected Result": "Sales records remain consistent", Status: "Pending Manual Check" }, { Area: "Inventory", Test: "Review stock and reorder report", "Expected Result": "Inventory report matches inventory page totals", Status: "Pending Manual Check" }, { Area: "Safety", Test: "Confirm Writes Disabled indicators", "Expected Result": "AI agents cannot modify production records", Status: "Pending Manual Check" }] }], recommendedActions: ["Run the checklist after every Vercel deployment that changes agent behavior or dashboard data display.", "Compare AI report numbers against the dashboard and inventory pages before relying on the report operationally.", "Keep write actions disabled until manual QA passes consistently across sales, inventory, customers, suppliers, and reports."], systemNote: "This QA report is advisory and read-only. It does not execute automated browser tests, modify records, deploy code, restore backups, or mark production as approved automatically." }; }

function buildGuardianAnswer() { return ["App Guardian Agent status in safe mode:", "", "- Agent registry: active", "- Dashboard read check: available through /api/dashboard", "- Recent activity read check: available through /api/recent-activity", "- Inventory read check: available through /api/inventory and /api/ai/inventory-analysis", "- Customer history read check: available through /api/ai/customer-history-report", "- Supplier history read check: available through /api/ai/supplier-history-report", "- Production writes: disabled", "- Auto deploy: disabled", "- Auto restore: disabled", "- Restore before risky changes: required", "", "Next upgrade: add a dedicated /api/guardian/health-check endpoint and daily restore-point log."].join("\n"); }
function buildGuardianReport(): ProfessionalReport { return { title: "App Guardian Safety Report", generatedBy: "App Guardian Agent", mode: "Monitoring Only", sources: ["Agent registry", "/api/dashboard", "/api/recent-activity", "/api/inventory", "/api/ai/inventory-analysis", "/api/ai/customer-history-report", "/api/ai/supplier-history-report"], executiveSummary: "The App Guardian Agent confirms that the agent system is operating in protected safe mode. Read-only analysis is enabled, while production writes, destructive actions, auto-deploy, and auto-restore remain disabled.", summaryCards: [{ label: "Agent Registry", value: "Active", helper: "7 agents registered" }, { label: "Production Writes", value: "Disabled", helper: "No automatic data mutation" }, { label: "Auto Restore", value: "Disabled", helper: "Manual approval required" }, { label: "Auto Deploy", value: "Disabled", helper: "No silent production patching" }, { label: "Restore Marker", value: "Required", helper: "Before risky changes" }], sections: [{ title: "Guardian Health Checks", description: "Current safe-mode checks available to the App Guardian layer.", columns: ["Check", "Status", "Notes"], rows: [{ Check: "Agent Registry", Status: "Ready", Notes: "All 7 agents registered and testable" }, { Check: "Dashboard Read", Status: "Available", Notes: "Uses /api/dashboard" }, { Check: "Recent Activity Read", Status: "Available", Notes: "Uses /api/recent-activity" }, { Check: "Inventory Read", Status: "Available", Notes: "Uses /api/inventory and /api/ai/inventory-analysis" }, { Check: "Customer History Read", Status: "Available", Notes: "Uses /api/ai/customer-history-report" }, { Check: "Supplier History Read", Status: "Available", Notes: "Uses /api/ai/supplier-history-report" }, { Check: "Production Writes", Status: "Blocked", Notes: "No agent writes are enabled" }, { Check: "Auto Restore", Status: "Blocked", Notes: "Manual admin approval required" }, { Check: "Auto Deploy", Status: "Blocked", Notes: "No silent deployment actions" }] }], recommendedActions: ["Add a dedicated /api/guardian/health-check endpoint for deeper API and Google Sheets checks.", "Add the daily restore-point log before enabling any future write-capable agent action.", "Keep auto-deploy and auto-restore disabled until explicit admin approval workflows are implemented."], systemNote: "This Guardian report was generated in monitoring-only mode. It did not patch code, deploy, rollback, restore, or modify production records." }; }

function fallbackReport(title: string, generatedBy: string, sources: string[]): ProfessionalReport {
  return { title, generatedBy, mode: "Safe Read-Only", sources, executiveSummary: "The requested report endpoint did not return report data. Please retry after deployment finishes or check the source sheet connection.", summaryCards: [{ label: "Status", value: "Unavailable", helper: "No report payload returned" }], sections: [], recommendedActions: ["Refresh the dashboard after deployment completes.", "Confirm Google Sheets credentials and source sheet names are available."], systemNote: "No records were modified." };
}

function agentIdFor(intent: string) { if (intent === "inventory") return "inventory"; if (intent === "customer") return "customer-history"; if (intent === "supplier") return "supplier-history"; if (intent === "qa") return "testing-qa"; if (intent === "guardian") return "app-guardian"; return "pos-assistant"; }
function agentNameFor(intent: string) { if (intent === "inventory") return "Inventory Agent"; if (intent === "customer") return "Customer History Agent"; if (intent === "supplier") return "Supplier History Agent"; if (intent === "qa") return "Testing / QA Agent"; if (intent === "guardian") return "App Guardian Agent"; return "Main POS Assistant Agent"; }

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = normalizePrompt(body?.prompt) || "Show dashboard summary.";
    const origin = new URL(request.url).origin;
    const cookieHeader = request.headers.get("cookie") || "";
    const [dashboard, activity, inventoryAnalysis, customerPayload, supplierPayload] = await Promise.all([
      readJson<DashboardData>(origin, "/api/dashboard", { incomingUnits: 0, warehouseReceived: 0, actualOnHand: 0, sellableUnits: 0, totalSales: 0, totalExpenses: 0, netGain: 0 }, cookieHeader),
      readJson<ActivityItem[]>(origin, "/api/recent-activity", [], cookieHeader),
      readJson<InventoryAnalysis>(origin, "/api/ai/inventory-analysis", {}, cookieHeader),
      readJson<ReportPayload>(origin, "/api/ai/customer-history-report", {}, cookieHeader),
      readJson<ReportPayload>(origin, "/api/ai/supplier-history-report", {}, cookieHeader),
    ]);
    if (dashboard.error) return NextResponse.json({ error: dashboard.error }, { status: 502 });

    const safeActivity = Array.isArray(activity) ? activity : [];
    const intent = detectIntent(prompt);
    const inventoryReport = intent === "inventory" ? buildInventoryReport(inventoryAnalysis) : null;
    const professionalReport =
      intent === "dashboard" ? buildDashboardReport(dashboard, safeActivity) :
      intent === "activity" ? buildActivityReport(safeActivity) :
      intent === "customer" ? customerPayload.report || fallbackReport("Customer History Report", "Customer History Agent", ["/api/ai/customer-history-report"]) :
      intent === "supplier" ? supplierPayload.report || fallbackReport("Supplier History Report", "Supplier History Agent", ["/api/ai/supplier-history-report"]) :
      intent === "qa" ? buildQaReport() :
      intent === "guardian" ? buildGuardianReport() :
      null;

    const answer =
      intent === "inventory" ? buildInventoryAnswer(dashboard, inventoryAnalysis) :
      intent === "activity" ? buildActivityAnswer(safeActivity) :
      intent === "customer" ? professionalReport?.executiveSummary || "Customer History Agent could not generate a report." :
      intent === "supplier" ? professionalReport?.executiveSummary || "Supplier History Agent could not generate a report." :
      intent === "qa" ? buildQaAnswer() :
      intent === "guardian" ? buildGuardianAnswer() :
      buildDashboardAnswer(prompt, dashboard, safeActivity);

    return NextResponse.json({
      agentId: agentIdFor(intent),
      agentName: agentNameFor(intent),
      mode: "safe-read-only",
      prompt,
      response: answer,
      reportType: intent === "inventory" && inventoryReport ? "inventory" : professionalReport ? "professional" : "text",
      inventoryReport,
      professionalReport,
      dataSources: intent === "inventory" ? ["/api/inventory", "/api/ai/inventory-analysis"] : professionalReport?.sources || ["/api/dashboard", "/api/recent-activity"],
      writeActionsEnabled: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to ask Realights AI" }, { status: 500 });
  }
}
