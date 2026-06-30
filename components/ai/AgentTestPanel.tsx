"use client";

import { useEffect, useState } from "react";
import AskRealightsAI from "@/components/ai/AskRealightsAI";

type AgentDefinition = {
  id: string;
  name: string;
  title: string;
  mode: string;
  status: string;
  summary: string;
  responsibilities: string[];
  restrictions: string[];
  samplePrompts: string[];
};

type StatusPayload = {
  enabled: boolean;
  mode: string;
  writeActionsEnabled: boolean;
  destructiveActionsEnabled: boolean;
  autoDeployEnabled: boolean;
  autoRestoreEnabled: boolean;
  restorePointRequiredBeforeRiskyChanges: boolean;
  agents: AgentDefinition[];
};

type TestResponse = {
  agentId: string;
  agentName: string;
  mode: string;
  status: string;
  prompt: string;
  response: string;
  nextSafeActions: string[];
};

export default function AgentTestPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoadingStatus(true);
    setError("");
    try {
      const response = await fetch("/api/ai/agents/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load AI agent status.");
      setStatus(await response.json());
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load AI agent status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function testAgent(agent: AgentDefinition) {
    setTestingAgentId(agent.id);
    setError("");
    try {
      const response = await fetch("/api/ai/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, prompt: agent.samplePrompts[0] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to test AI agent.");
      setTestResponse(payload);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to test AI agent.");
    } finally {
      setTestingAgentId(null);
    }
  }

  useEffect(() => {
    loadStatus().catch(console.error);
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">AI Agents</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Agent Test Panel</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {status?.agents?.length ?? "..."} agents registered · {status?.mode || "safe"} mode · writes {status?.writeActionsEnabled ? "enabled" : "disabled"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href="/api/accounting-audit" target="_blank" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100">
            Open Accounting Audit
          </a>
          <button onClick={() => loadStatus().catch(console.error)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            {loadingStatus ? "Checking..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setIsPanelOpen((value) => !value)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            {isPanelOpen ? "Hide Panel" : "Open Panel"}
          </button>
        </div>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div> : null}

      {isPanelOpen ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">System Mode</p><p className="mt-1 text-sm font-semibold text-slate-950">{status?.mode || "safe"}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Registered</p><p className="mt-1 text-sm font-semibold text-slate-950">{status?.agents?.length ?? "..."}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Writes</p><p className="mt-1 text-sm font-semibold text-slate-950">{status?.writeActionsEnabled ? "Enabled" : "Disabled"}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto Restore</p><p className="mt-1 text-sm font-semibold text-slate-950">{status?.autoRestoreEnabled ? "Enabled" : "Disabled"}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {(status?.agents || []).map((agent) => {
              const isExpanded = expandedAgentId === agent.id;
              return (
                <div key={agent.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-950">{agent.name}</h3><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">{agent.status}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">{agent.mode}</span></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{agent.title}</p></div>
                    <button type="button" onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">{isExpanded ? "Hide" : "Details"}</button>
                  </div>
                  {isExpanded ? <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs leading-5 text-slate-600">{agent.summary}</p><div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sample Prompt</p><p className="mt-1 text-xs font-semibold text-slate-700">{agent.samplePrompts[0]}</p></div><button onClick={() => testAgent(agent)} disabled={testingAgentId === agent.id} className="mt-3 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{testingAgentId === agent.id ? "Testing..." : "Test Agent"}</button></div> : null}
                </div>
              );
            })}
          </div>

          {testResponse ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Latest Test Result</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{testResponse.agentName}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{testResponse.response}</p></div> : null}
        </div>
      ) : null}

      <AskRealightsAI />
    </div>
  );
}
