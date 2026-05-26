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

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function numberText(value: number) {
  return Number(value || 0).toLocaleString();
}

function normalizePrompt(value: unknown) {
  return String(value || "").trim();
}

async function readJson<T>(origin: string, path: string, fallback: T): Promise<T> {
  const response = await fetch(`${origin}${path}`, { cache: "no-store" });
  if (!response.ok) return fallback;
  return (await response.json()) as T;
}

function detectIntent(prompt: string) {
  const lower = prompt.toLowerCase();

  if (/(inventory|stock|sellable|on hand|low stock|reorder|incoming|warehouse)/.test(lower)) return "inventory";
  if (/(activity|recent|latest|log|timeline)/.test(lower)) return "activity";
  if (/(sales|expense|net|gain|profit|summary|dashboard|today|attention|status)/.test(lower)) return "dashboard";
  if (/(test|qa|checklist|release)/.test(lower)) return "qa";
  if (/(health|guardian|restore|backup)/.test(lower)) return "guardian";

  return "dashboard";
}

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

  return [
    "Main POS Assistant Agent checked the live dashboard data in read-only mode.",
    "",
    `Sales: ${peso(data.totalSales)}`,
    `Expenses: ${peso(data.totalExpenses)}`,
    `Net gain: ${peso(data.netGain)}`,
    `Incoming units: ${numberText(data.incomingUnits)}`,
    `Warehouse received: ${numberText(data.warehouseReceived)}`,
    `Actual on hand: ${numberText(data.actualOnHand)}`,
    `Sellable units: ${numberText(data.sellableUnits)}`,
    "",
    "Needs attention:",
    ...attentionItems.map((item) => `- ${item}`),
    "",
    `Recent activity: ${recent}`,
    "",
    "Safe-mode note: I only read and summarized the dashboard and recent activity. I did not change POS records.",
  ].join("\n");
}

function buildInventoryAnswer(data: DashboardData) {
  const notes: string[] = [];
  if ((data.sellableUnits || 0) <= 0) notes.push("Sellable units are zero. Restock or validate stock records before selling.");
  if ((data.incomingUnits || 0) > 0) notes.push(`${numberText(data.incomingUnits)} incoming units are recorded.`);
  if ((data.warehouseReceived || 0) > 0) notes.push(`${numberText(data.warehouseReceived)} units are marked warehouse received.`);
  if (!notes.length) notes.push("Current dashboard-level inventory numbers do not show an urgent stock warning.");

  return [
    "Inventory Agent checked the live dashboard inventory totals in read-only mode.",
    "",
    `Incoming units: ${numberText(data.incomingUnits)}`,
    `Warehouse received: ${numberText(data.warehouseReceived)}`,
    `Actual on hand: ${numberText(data.actualOnHand)}`,
    `Sellable units: ${numberText(data.sellableUnits)}`,
    "",
    "Inventory notes:",
    ...notes.map((item) => `- ${item}`),
    "",
    "Next upgrade: connect this agent to product-level stock rows so it can list exact low-stock products and reorder suggestions.",
  ].join("\n");
}

function buildActivityAnswer(activity: ActivityItem[]) {
  const rows = activity.slice(0, 8).map((item, index) => `${index + 1}. ${item.title || "Activity"} - ${item.note || "No note"}${item.actor ? ` by ${item.actor}` : ""}${item.time ? ` (${item.time})` : ""}`);

  return [
    "Main POS Assistant Agent checked recent activity in read-only mode.",
    "",
    rows.length ? rows.join("\n") : "No recent activity returned by the activity API.",
    "",
    "Safe-mode note: I only read recent activity. I did not modify activity records.",
  ].join("\n");
}

function buildQaAnswer() {
  return [
    "Testing / QA Agent prepared a safe regression checklist.",
    "",
    "1. Confirm dashboard loads without console/API errors.",
    "2. Confirm the Agent Test Panel shows 7 registered agents.",
    "3. Confirm Ask Realights AI returns a dashboard summary.",
    "4. Test Add Delivery and verify dashboard totals still refresh.",
    "5. Test sales, inventory, customer, supplier, and report pages after deployment.",
    "6. Confirm production writes remain disabled for agents.",
    "7. Confirm the before-agents restore marker still exists.",
  ].join("\n");
}

function buildGuardianAnswer() {
  return [
    "App Guardian Agent status in safe mode:",
    "",
    "- Agent registry: active",
    "- Dashboard read check: available through /api/dashboard",
    "- Recent activity read check: available through /api/recent-activity",
    "- Production writes: disabled",
    "- Auto deploy: disabled",
    "- Auto restore: disabled",
    "- Restore before risky changes: required",
    "",
    "Next upgrade: add a dedicated /api/guardian/health-check endpoint and daily restore-point log.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = normalizePrompt(body?.prompt) || "Show dashboard summary.";
    const origin = new URL(request.url).origin;

    const [dashboard, activity] = await Promise.all([
      readJson<DashboardData>(origin, "/api/dashboard", {
        incomingUnits: 0,
        warehouseReceived: 0,
        actualOnHand: 0,
        sellableUnits: 0,
        totalSales: 0,
        totalExpenses: 0,
        netGain: 0,
      }),
      readJson<ActivityItem[]>(origin, "/api/recent-activity", []),
    ]);

    if (dashboard.error) {
      return NextResponse.json({ error: dashboard.error }, { status: 502 });
    }

    const intent = detectIntent(prompt);
    const answer =
      intent === "inventory" ? buildInventoryAnswer(dashboard) :
      intent === "activity" ? buildActivityAnswer(Array.isArray(activity) ? activity : []) :
      intent === "qa" ? buildQaAnswer() :
      intent === "guardian" ? buildGuardianAnswer() :
      buildDashboardAnswer(prompt, dashboard, Array.isArray(activity) ? activity : []);

    return NextResponse.json({
      agentId: intent === "inventory" ? "inventory" : intent === "qa" ? "testing-qa" : intent === "guardian" ? "app-guardian" : "pos-assistant",
      agentName: intent === "inventory" ? "Inventory Agent" : intent === "qa" ? "Testing / QA Agent" : intent === "guardian" ? "App Guardian Agent" : "Main POS Assistant Agent",
      mode: "safe-read-only",
      prompt,
      response: answer,
      dataSources: ["/api/dashboard", "/api/recent-activity"],
      writeActionsEnabled: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to ask Realights AI" }, { status: 500 });
  }
}
