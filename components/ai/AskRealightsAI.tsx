"use client";

import { useState } from "react";

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

type AiResponse = {
  agentId: string;
  agentName: string;
  mode: string;
  prompt: string;
  response: string;
  reportType?: string;
  inventoryReport?: InventoryReport | null;
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

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>{priority}</span>;
}

function EmptyTableMessage({ message }: { message: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">{message}</div>;
}

function InventoryReportView({ report }: { report: InventoryReport }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">{report.generatedBy}</p>
            <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{report.title}</h4>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-600">{report.executiveSummary}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{report.mode}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {report.summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h5 className="text-lg font-semibold text-slate-950">Low-Stock Items</h5>
            <p className="mt-1 text-sm font-medium text-slate-500">Items requiring stock monitoring or replenishment.</p>
          </div>
          {report.lowStockItems.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 text-right font-bold">Sellable</th>
                    <th className="px-4 py-3 text-right font-bold">On Hand</th>
                    <th className="px-4 py-3 text-right font-bold">Incoming</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.lowStockItems.map((item) => (
                    <tr key={item.product}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.product}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.sellableQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.actualOnHand.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.incomingQty.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyTableMessage message="No low-stock items were detected by the current inventory rules." />}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h5 className="text-lg font-semibold text-slate-950">Reorder Recommendations</h5>
            <p className="mt-1 text-sm font-medium text-slate-500">Suggested reorder quantities are advisory only and require admin approval.</p>
          </div>
          {report.reorderSuggestions.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 text-right font-bold">Current Sellable</th>
                    <th className="px-4 py-3 text-right font-bold">Suggested Reorder</th>
                    <th className="px-4 py-3 font-bold">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.reorderSuggestions.map((item) => (
                    <tr key={item.product}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.product}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.currentSellable.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.suggestedReorderQty.toLocaleString()}</td>
                      <td className="px-4 py-3"><PriorityBadge priority={item.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyTableMessage message="No reorder suggestions were triggered by the current low-stock rules." />}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h5 className="text-lg font-semibold text-slate-950">Lowest Stock Watchlist</h5>
          <p className="mt-1 text-sm font-medium text-slate-500">Lowest-stock products ranked by current sellable quantity.</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Product</th>
                <th className="px-4 py-3 text-right font-bold">Sellable Qty</th>
                <th className="px-4 py-3 text-right font-bold">On Hand</th>
                <th className="px-4 py-3 text-right font-bold">Incoming</th>
                <th className="px-4 py-3 text-right font-bold">Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.lowestStockItems.map((item) => (
                <tr key={item.product}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.product}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.sellableQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.actualOnHand.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.incomingQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.soldQty.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h5 className="text-lg font-semibold text-slate-950">Incoming Stock Status</h5>
          <p className="mt-1 text-sm font-medium text-slate-500">Incoming inventory currently recorded in the system.</p>
          <div className="mt-4">
            {report.incomingStock.length ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Product</th>
                      <th className="px-4 py-3 text-right font-bold">Incoming Qty</th>
                      <th className="px-4 py-3 font-bold">Latest Incoming</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.incomingStock.map((item) => (
                      <tr key={item.product}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.product}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.incomingQty.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{item.latestIncoming}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyTableMessage message="No incoming stock rows were detected at the time of this report." />}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h5 className="text-lg font-semibold text-slate-950">Recommended Actions</h5>
          <p className="mt-1 text-sm font-medium text-slate-500">Operational recommendations generated from current read-only inventory data.</p>
          <ol className="mt-4 space-y-3">
            {report.recommendedActions.map((action, index) => (
              <li key={action} className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{index + 1}</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold leading-6 text-emerald-800">
        <span className="font-bold">System Note:</span> {report.systemNote}
      </div>
    </div>
  );
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
          {result.reportType === "inventory" && result.inventoryReport ? (
            <InventoryReportView report={result.inventoryReport} />
          ) : (
            <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-800">{result.response}</pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
