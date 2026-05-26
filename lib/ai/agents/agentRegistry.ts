export type AgentMode = "read-only" | "monitoring-only" | "audit-only" | "qa-only";

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
  "Cannot change inventory, sales, payments, customer balances, supplier balances, or pricing without explicit admin approval.",
  "Cannot expose secrets, API keys, service account credentials, or environment variable values.",
];

export const agentRegistry: AgentDefinition[] = [
  {
    id: "pos-assistant",
    name: "Main POS Assistant Agent",
    title: "Dashboard AI Router",
    mode: "read-only",
    status: "ready",
    summary: "Main Realights POS assistant that routes questions to the correct specialist agent.",
    responsibilities: [
      "Answer general dashboard questions.",
      "Route inventory, customer, supplier, audit, QA, and app health questions to specialist agents.",
      "Summarize available POS insights in safe mode.",
    ],
    restrictions: defaultRestrictions,
    samplePrompts: [
      "What can you help me with in Realights POS?",
      "What needs attention today?",
      "Route this question to the correct agent.",
    ],
  },
  {
    id: "inventory",
    name: "Inventory Agent",
    title: "Stock and Product Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles products, stock levels, low-stock alerts, inventory movement, and reorder suggestions.",
    responsibilities: [
      "Review product and stock information.",
      "Detect low-stock and zero-stock situations.",
      "Suggest reorder quantities without changing records.",
    ],
    restrictions: defaultRestrictions,
    samplePrompts: [
      "Check low stock products.",
      "What should I reorder?",
      "Show inventory movement summary.",
    ],
  },
  {
    id: "customer-history",
    name: "Customer History Agent",
    title: "Customer Records Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles customer purchase history, balances, payment behavior, filters, and customer activity.",
    responsibilities: [
      "Review customer purchase history.",
      "Summarize customer balances and payment behavior.",
      "Support date, product, and customer filters.",
    ],
    restrictions: defaultRestrictions,
    samplePrompts: [
      "Show customer purchase history.",
      "Which customers have unpaid balances?",
      "Filter customer history this month.",
    ],
  },
  {
    id: "supplier-history",
    name: "Supplier History Agent",
    title: "Supplier Records Specialist",
    mode: "read-only",
    status: "ready",
    summary: "Handles supplier records, deliveries, invoices, payments, supplier costs, and supplier filters.",
    responsibilities: [
      "Review supplier deliveries and transaction history.",
      "Summarize supplier invoices and payment status.",
      "Support supplier filters by date, product, and status.",
    ],
    restrictions: defaultRestrictions,
    samplePrompts: [
      "Show supplier transaction history.",
      "Which supplier delivered this product?",
      "Show unpaid supplier invoices.",
    ],
  },
  {
    id: "app-guardian",
    name: "App Guardian Agent",
    title: "App Health and Restore Specialist",
    mode: "monitoring-only",
    status: "ready",
    summary: "Handles app health, restore points, maintenance logs, update recommendations, and safe issue observation.",
    responsibilities: [
      "Check dashboard and API health.",
      "Track restore-point and rollback readiness.",
      "Recommend safe patches and maintenance actions.",
    ],
    restrictions: [
      ...defaultRestrictions,
      "Cannot auto-deploy, auto-rollback, auto-restore, or patch production without explicit admin approval.",
    ],
    samplePrompts: [
      "Check app health.",
      "Create today's restore point plan.",
      "What maintenance issues should we watch?",
    ],
  },
  {
    id: "data-audit",
    name: "Data Audit Agent",
    title: "Data Accuracy Specialist",
    mode: "audit-only",
    status: "ready",
    summary: "Checks duplicates, missing fields, suspicious values, mismatched totals, and inventory-data inconsistencies.",
    responsibilities: [
      "Find duplicate or incomplete records.",
      "Flag suspicious totals, negative values, and missing required fields.",
      "Compare sales, inventory, supplier costs, and expense consistency.",
    ],
    restrictions: [
      ...defaultRestrictions,
      "Cannot delete, merge, rewrite, or clean data automatically.",
    ],
    samplePrompts: [
      "Audit possible data issues.",
      "Check for duplicate sales records.",
      "Find missing customer or supplier fields.",
    ],
  },
  {
    id: "testing-qa",
    name: "Testing / QA Agent",
    title: "Testing and Release Specialist",
    mode: "qa-only",
    status: "ready",
    summary: "Creates test plans, regression checks, release-readiness reports, and deployment verification checklists.",
    responsibilities: [
      "Create test checklists for POS flows.",
      "Identify regression risks before deployment.",
      "Verify dashboard, sales, inventory, customer, supplier, report, and agent features after updates.",
    ],
    restrictions: [
      ...defaultRestrictions,
      "Cannot modify production data while testing.",
    ],
    samplePrompts: [
      "Create a test checklist for Realights POS.",
      "What should we test after this update?",
      "Check release readiness.",
    ],
  },
];

export function getAgentsEnabled() {
  return process.env.REALIGHTS_AI_AGENTS_ENABLED === "true";
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
    response: `${agent.name} is online in ${agent.mode} safe mode. ${agent.summary} I can help with: ${agent.responsibilities.join(" ")} Current restriction: I cannot perform production writes, destructive actions, auto-deploys, or auto-restores without explicit admin approval.`,
    nextSafeActions: agent.samplePrompts,
  };
}
