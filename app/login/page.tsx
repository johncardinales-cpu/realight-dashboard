"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to sign in");
      router.replace("/");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-2xl font-black text-amber-600 ring-1 ring-amber-100">R</div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-600">Reallights Solar</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Admin Login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enter your authorized email and access code to open the operations dashboard.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@company.com"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Access Code</span>
            <input
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter access code"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              required
            />
          </label>

          {message ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Access is restricted. Configure credentials in Vercel environment variables.</p>
      </div>
    </main>
  );
}
