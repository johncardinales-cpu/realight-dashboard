"use client";

import { FormEvent, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ImportMode = "general" | "receipt" | "product" | "inventory" | "supplier" | "customer";

const starterPrompts: Array<{ label: string; prompt: string; mode: ImportMode }> = [
  { label: "Receipt upload", prompt: "receipt", mode: "receipt" },
  { label: "Product template", prompt: "product upload", mode: "product" },
  { label: "Inventory upload", prompt: "inventory upload", mode: "inventory" },
  { label: "Find customer", prompt: "find customer", mode: "general" },
  { label: "Find sale/ref", prompt: "find sale ref", mode: "general" },
];

function detectMode(text: string): ImportMode {
  const value = text.trim().toLowerCase();
  if (value === "receipt" || value.startsWith("receipt ")) return "receipt";
  if (value.includes("product upload") || value.includes("pricing upload")) return "product";
  if (value.includes("inventory upload") || value.includes("delivery upload")) return "inventory";
  if (value.includes("supplier upload") || value.includes("invoice upload")) return "supplier";
  if (value.includes("customer upload")) return "customer";
  return "general";
}

function modeLabel(mode: ImportMode) {
  if (mode === "receipt") return "Receipt → Expenses";
  if (mode === "product") return "Product/Pricing Import";
  if (mode === "inventory") return "Inventory/Delivery Import";
  if (mode === "supplier") return "Supplier Cost Import";
  if (mode === "customer") return "Customer Import";
  return "General AI Search";
}

export default function AIChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Reallights AI. For receipts, type receipt first, then upload the file. I will treat it as an expense receipt preview. You can also ask me to find customers, sales refs, products, balances, expenses, or inventory.",
    },
  ]);
  const [fileContext, setFileContext] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [importMode, setImportMode] = useState<ImportMode>("general");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function sendMessage(messageText?: string, forcedMode?: ImportMode) {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;

    const detectedMode = forcedMode || detectMode(text);
    if (detectedMode !== "general") setImportMode(detectedMode);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, fileContext, fileName, importMode: detectedMode !== "general" ? detectedMode : importMode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "AI request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.reply || "I could not generate a response. Please try again.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong while contacting the AI assistant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setFileName(file.name);

    const supportedTextFile = /\.(csv|txt|md|json)$/i.test(file.name) || file.type.startsWith("text/");
    const modePrefix = `IMPORT_MODE=${importMode}\nFILE_NAME=${file.name}\n`;

    if (!supportedTextFile) {
      setFileContext(`${modePrefix}Uploaded file is binary or not directly text-readable in this version. If import mode is receipt, treat this upload as an expense receipt and ask for any missing fields needed for expense preview: date, payee/vendor, amount, category, payment method, reference number, and related sales ref if applicable.`);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: importMode === "receipt"
            ? `Receipt mode is active. I attached ${file.name} as an expense receipt. If I cannot read the image/PDF text directly, I will ask for the missing receipt fields before preparing an expense preview.`
            : `I attached ${file.name}. For this version, I can read CSV, TXT, MD, and JSON directly. PDF/image/Excel parsing can be added next; I will still classify the file based on the selected mode: ${modeLabel(importMode)}.`,
        },
      ]);
      return;
    }

    const text = await file.text();
    const limitedText = text.slice(0, 12000);
    setFileContext(`${modePrefix}${limitedText}`);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: importMode === "receipt"
          ? `I uploaded ${file.name} in Receipt mode. I will treat its contents as an expense receipt and prepare an Expenses preview before saving.`
          : `I uploaded ${file.name} for ${modeLabel(importMode)}. Ask me to identify the template, validate the rows, or prepare an import preview.`,
      },
    ]);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 sm:bottom-4 sm:right-4">
      {open ? (
        <div className="mb-3 flex h-[560px] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.20)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-sm">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v3" />
                  <path d="M12 18v3" />
                  <path d="M3 12h3" />
                  <path d="M18 12h3" />
                  <path d="m5.6 5.6 2.1 2.1" />
                  <path d="m16.3 16.3 2.1 2.1" />
                  <path d="m18.4 5.6-2.1 2.1" />
                  <path d="m7.7 16.3-2.1 2.1" />
                  <path d="M12 8l1.6 3.2L17 12l-3.4.8L12 16l-1.6-3.2L7 12l3.4-.8L12 8Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold leading-tight">Reallights AI</h3>
                <p className="text-xs text-slate-300">{modeLabel(importMode)}</p>
              </div>
            </div>

            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close AI chat">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="mb-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-200">
              Receipt rule: type <span className="font-black text-emerald-700">receipt</span> first, then upload. Receipt uploads become expense previews.
            </div>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button key={prompt.label} type="button" onClick={() => void sendMessage(prompt.prompt, prompt.mode)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{message.content}</div>
              </div>
            ))}
            {loading ? <div className="flex justify-start"><div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500">Thinking...</div></div> : null}
          </div>

          {fileName ? <div className="border-t border-slate-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">File attached: {fileName} · Mode: {modeLabel(importMode)}</div> : null}

          <form onSubmit={submitForm} className="border-t border-slate-100 bg-white p-4">
            <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.txt,.md,.json,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:text-emerald-600" aria-label="Upload file">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" /></svg>
              </button>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type receipt, product upload, or ask to find records..." rows={1} className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400" />
              <button type="submit" disabled={loading || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300" aria-label="Send message">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 rounded-full bg-slate-950/75 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-950/90 sm:opacity-75 sm:hover:opacity-100" aria-label="Open Reallights AI chat">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="M12 8l1.6 3.2L17 12l-3.4.8L12 16l-1.6-3.2L7 12l3.4-.8L12 8Z" /></svg></span>
        <span className="hidden sm:inline">Ask AI</span>
      </button>
    </div>
  );
}
