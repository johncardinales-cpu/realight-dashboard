export type AgentMode = "read-only" | "monitoring-only" | "audit-only" | "qa-only" | "manual-approval-only";

export type AgentDefinition = {
  id: string;
  name: string;
  title: string;
  mode: AgentMode;
  status: "ready";
  summary: string;
  responsibilities: string[];
  restrictions: string[];
  samplePrompts: string[];
};

const defaultRestrictions = [
  "Cannot create, update, or delete production records automatically.",
  "Cannot change inventory, sales, payments, customer balances, supplier balances, pricing, or reports without explicit admin approval.",
  "Cannot run cleanup, resets, restores, patches, deployments, or migrations without an admin-approved restore point first.",
];

export const agentRegistry: AgentDefinition[] = [
  {
    id: "pos-assistant",
    name: "Main POS Assistant Agent",
    title: "Dashboard AI Router",
    mode: "read-only",
    status: "ready",
    summary: "Main Realights POS assistant that routes questions to the correct specialist agent and summarizes live dashboard information in safe mode.",
    responsibilities: [
      "Answer general dashboard questions.",
      "Route inventory, customer, supplier, audit, QA, health, restore, patch, and deployment questions to specialist agents.",
      "Summarize available POS insights in safe mode.",
    ],
    restrictions: defaultRestrictions,
    samplePrompts: ["What can you help me with in Realights POS?", "What needs attention today?", "Route this question to the correct agent."],
  },
  {
    id: "inventory",
    name: "Inventory Agent",
    title: "Stock and Product Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles products, stock levels, low-stock alerts, inventory movement, and reorder suggestions without modifying stock records.",
    responsibilities: ["Review product and stock information.", "Detect low-stock and zero-stock situations.", "Suggest reorder quantities without changing records.", "Help verify supplier upload to incoming stock and available stock flow."],
    restrictions: defaultRestrictions,
    samplePrompts: ["Check low stock products.", "What should I reorder?", "Show inventory movement summary."],
  },
  {
    id: "customer-history",
    name: "Customer History Agent",
    title: "Customer Records Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles customer purchase history, balances, payment behavior, filters, and customer activity in read-only mode.",
    responsibilities: ["Review customer purchase history.", "Summarize customer balances and payment behavior.", "Support date, product, and customer filters.", "Flag customer receivable records that need admin review."],
    restrictions: defaultRestrictions,
    samplePrompts: ["Show customer purchase history.", "Which customers have unpaid balances?", "Filter customer history this month."],
  },
  {
    id: "supplier-history",
    name: "Supplier History Agent",
    title: "Supplier Records Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles supplier records, deliveries, invoices, payments, supplier costs, and supplier filters in read-only mode.",
    responsibilities: ["Review supplier deliveries and transaction history.", "Summarize supplier invoices and payment status.", "Support supplier filters by date, product, and status.", "Help validate real supplier upload files before real-data import."],
    restrictions: defaultRestrictions,
    samplePrompts: ["Show supplier transaction history.", "Which supplier delivered this product?", "Show unpaid supplier invoices."],
  },
  {
    id: "restore-point",
    name: "Restore Point Agent",
    title: "Backup and Rollback Readiness Specialist",
    mode: "monitoring-only",
    status: "ready",
    summary: "Tracks restore-point readiness and tells admins what to back up before real uploads, resets, deployments, patches, or database migration.",
    responsibilities: ["Confirm a restore point is required before risky work.", "Prepare restore-point checklists for app data, GitHub commit, and Vercel deployment.", "Remind admins to create the daily 6:00 PM Manila restore point."],
    restrictions: [...defaultRestrictions, "Cannot create, delete, rollback, or restore production data automatically.", "Cannot reset app records without explicit admin approval."],
    samplePrompts: ["Create today's restore point plan.", "What should be backed up before real data upload?", "Check restore readiness before reset."],
  },
  {
    id: "app-health-observer",
    name: "App Health Observer Agent",
    title: "App Health and Deployment Observer",
    mode: "monitoring-only",
    status: "ready",
    summary: "Reviews app health, deployment status, recent activity, and operational warnings without changing production data or deployments.",
    responsibilities: ["Check dashboard and API health signals.", "Review deployment status when available.", "Flag app health, login, dashboard, inventory, sales, payment, or report issues for admin review."],
    restrictions: [...defaultRestrictions, "Cannot auto-deploy, auto-rollback, auto-restore, or patch production without explicit admin approval."],
    samplePrompts: ["Check app health.", "What maintenance issues should we watch?", "Is the app ready for real data upload?"],
  },
  {
    id: "data-audit",
    name: "Data Audit Agent",
    title: "Data Accuracy Specialist",
    mode: "audit-only",
    status: "ready",
    summary: "Checks duplicates, missing fields, suspicious values, mismatched totals, and inventory-data inconsistencies without cleaning data automatically.",
    responsibilities: ["Find duplicate or incomplete records.", "Flag suspicious totals, negative values, missing required fields, and mismatched references.", "Compare sales, inventory, supplier costs, payments, receivables, and expense consistency.", "Prepare cleanup recommendations before the final real-data reset."],
    restrictions: [...defaultRestrictions, "Cannot delete, merge, rewrite, void, restore, or clean data automatically."],
    samplePrompts: ["Audit possible data issues.", "Check for duplicate sales records.", "Find missing customer or supplier fields."],
  },
  {
    id: "testing-qa",
    name: "Testing / QA Agent",
    title: "Testing and Release Specialist",
    mode: "qa-only",
    status: "ready",
    summary: "Creates test plans, regression checks, release-readiness reports, and deployment verification checklists for Realights POS.",
    responsibilities: ["Create test checklists for POS flows.", "Identify regression risks before deployment.", "Verify dashboard, sales, inventory, customer, supplier, report, payment, and agent features after updates.", "Track whether the app is ready for real business data upload."],
    restrictions: [...defaultRestrictions, "Cannot modify production data while testing."],
    samplePrompts: ["Create a test checklist for Realights POS.", "What should we test after this update?", "Check release readiness."],
  },
  {
    id: "patch-update",
    name: "Patch / Update Agent",
    title: "Manual Patch Recommendation Specialist",
    mode: "manual-approval-only",
    status: "ready",
    summary: "Reviews issues and recommends code or configuration patches, but cannot apply them unless the admin explicitly approves the exact change.",
    responsibilities: ["Recommend fixes for UI, report, payment, inventory, and data issues.", "Explain patch risk before implementation.", "Require restore point confirmation before risky changes."],
    restrictions: [...defaultRestrictions, "Cannot commit code, edit files, patch settings, or change UI without explicit admin approval.", "Cannot hide or remove UI elements unless the admin confirms the exact elements to hide."],
    samplePrompts: ["Recommend a safe patch for this issue.", "What UI items should be hidden before launch?", "Review this bug before patching."],
  },
  {
    id: "deployment",
    name: "Deployment Agent",
    title: "Manual Deployment Readiness Specialist",
    mode: "manual-approval-only",
    status: "ready",
    summary: "Prepares deployment checks and release notes, but cannot deploy, rollback, or switch domains without explicit admin approval.",
    responsibilities: ["Check deployment readiness after patches.", "Prepare release notes and post-deploy verification steps.", "Confirm restore point and QA status before production deployment.", "Support permanent-domain and database-migration readiness planning."],
    restrictions: [...defaultRestrictions, "Cannot deploy, rollback, promote domains, migrate databases, or trigger production releases without explicit admin approval."],
    samplePrompts: ["Check deployment readiness.", "Prepare final release notes.", "What must be verified before permanent domain launch?"],
  },
];

export function getAgentsEnabled() {
  return process.env.REALIGHTS_AI_AGENTS_ENABLED !== "false";
}

export function getAgentModeLabel() {
  return "safe";
}

export function getAgentById(agentId: string) {
  return agentRegistry.find((agent) => agent.id === agentId);
}

export function getAgentStatusPayload() {
  return {
    enabled: getAgentsEnabled(),
    mode: getAgentModeLabel(),
    writeActionsEnabled: false,
    destructiveActionsEnabled: false,
    autoDeployEnabled: false,
    autoRestoreEnabled: false,
    restorePointRequiredBeforeRiskyChanges: true,
    agents: agentRegistry,
  };
}

export function createAgentTestResponse(agentId: string, prompt?: string) {
  const agent = getAgentById(agentId) ?? agentRegistry[0];
  const cleanedPrompt = String(prompt || "").trim();

  return {
    agentId: agent.id,
    agentName: agent.name,
    mode: agent.mode,
    status: agent.status,
    prompt: cleanedPrompt || agent.samplePrompts[0],
    response: `${agent.name} is online in ${agent.mode} safe mode. ${agent.summary} I can help with: ${agent.responsibilities.join(" ")} Current restriction: I cannot perform production writes, destructive actions, auto-deploys, auto-restores, patches, resets, real-data imports, or database migrations without explicit admin approval and a restore point.`,
    nextSafeActions: agent.samplePrompts,
  };
}
