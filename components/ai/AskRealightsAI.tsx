"use client";

import { useState } from "react";

type AiResponse = {
  agentId: string;
  agentName: string;
  mode: string;
  prompt: string;
  response: string;
  dataSources: string[];
  writeActionsEnabled: boolean;
  timestamp: string;
};

const quickPrompts = [
  "Show dashboard summary.",
  "What needs attention today?",
  "Check inventory status.",
  "Show recent activity.",
  "Create a QA checklist.",
  "Check app guardian status.",
];

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    const preview = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(preview || `Realights AI returned ${response.status} instead of JSON. Please refresh after deployment finishes.`);
  }

  return response.json();
}

export default function AskRealightsAI() {
  const [prompt, setPrompt] = useState("Show dashboard summary.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState("");

  async function askRealightsAI(nextPrompt = prompt) {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt) return;

    setPrompt(cleanPrompt);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload?.error || "Failed to ask Realights AI.");
      setResult(payload);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to ask Realights AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">Ask Realights AI</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Read-Only POS Assistant</h3>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            Ask for dashboard summaries, inventory status, recent activity, QA checks, and guardian status. This assistant reads data only and cannot change POS records.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">
          Writes Disabled
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") askRealightsAI().catch(console.error);
          }}
          className="min-h-12 flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-0 transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="Ask Realights AI..."
        />
        <button
          onClick={() => askRealightsAI().catch(console.error)}
          disabled={loading}
          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Reading..." : "Ask AI"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((item) => (
          <button
            key={item}
            onClick={() => askRealightsAI(item).catch(console.error)}
            disabled={loading}
            className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item}
          </button>
        ))}
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {result ? (
        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{result.agentName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Mode: {result.mode}</p>
            </div>
            <p className="text-xs font-semibold text-slate-400">Sources: {result.dataSources.join(", ")}</p>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-800">{result.response}</pre>
        </div>
      ) : null}
    </div>
  );
}
