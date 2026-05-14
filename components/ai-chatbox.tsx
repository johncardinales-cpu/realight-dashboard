"use client";

import { FormEvent, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterPrompts = [
  "Summarize today's dashboard numbers.",
  "Create a quick inventory report.",
  "Explain the current stock position.",
  "What should I check before adding a delivery?",
];

export default function AIChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Reallights AI. Ask me about inventory, deliveries, sales, expenses, or upload a CSV/text file for analysis.",
    },
  ]);
  const [fileContext, setFileContext] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function sendMessage(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, fileContext, fileName }),
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

    if (!supportedTextFile) {
      setFileContext(`Uploaded file: ${file.name}. Direct parsing is currently enabled for CSV, TXT, MD, and JSON files.`);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I attached ${file.name}. For this first version, I can read CSV, TXT, MD, and JSON content directly. PDF and Excel parsing can be added next.`,
        },
      ]);
      return;
    }

    const text = await file.text();
    const limitedText = text.slice(0, 12000);
    setFileContext(limitedText);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: `I uploaded ${file.name} and can use its contents in this chat. Ask me to summarize it, find issues, or create a report.`,
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
                <p className="text-xs text-slate-300">Inventory, reports, and file help</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close AI chat"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500">
                  Thinking...
                </div>
              </div>
            ) : null}
          </div>

          {fileName ? (
            <div className="border-t border-slate-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
              File attached: {fileName}
            </div>
          ) : null}

          <form onSubmit={submitForm} className="border-t border-slate-100 bg-white p-4">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.txt,.md,.json,.pdf,.xlsx,.xls"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />

            <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:text-emerald-600"
                aria-label="Upload file"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about inventory, deliveries, sales..."
                rows={1}
                className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-2 rounded-full bg-slate-950/75 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-950/90 sm:opacity-75 sm:hover:opacity-100"
        aria-label="Open Reallights AI chat"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3" />
            <path d="M12 18v3" />
            <path d="M3 12h3" />
            <path d="M18 12h3" />
            <path d="M12 8l1.6 3.2L17 12l-3.4.8L12 16l-1.6-3.2L7 12l3.4-.8L12 8Z" />
          </svg>
        </span>
        <span className="hidden sm:inline">Ask AI</span>
      </button>
    </div>
  );
}
