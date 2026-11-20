"use client";

import { useState, type FormEvent } from "react";

type StockItem = Record<string, string | number | boolean>;

export default function InventoryVisibilityDialog({
  item, onClose, onSuccess,
}: {
  item: StockItem;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const archived = item["Is Archived"] === true;
  const action = archived ? "RESTORE" : "ARCHIVE";
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stock = Number(item["Actual On Hand"] || 0);
  const incoming = Number(item["Incoming Qty"] || 0);
  const safeToArchive = stock === 0 && incoming === 0 && Number(item["Sellable Qty"] || 0) === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/inventory/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          description: String(item["Description"] || ""),
          specification: String(item["Specification"] || ""),
          expectedQty: stock,
          expectedArchived: archived,
          reason,
          adminCode: code,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to change inventory visibility.");
      setCode("");
      onSuccess(action === "ARCHIVE" ? "Item archived. Original history was preserved." : "Item restored to the inventory list.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to update inventory visibility.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={archived ? "Restore inventory item" : "Archive inventory item"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-950">{archived ? "Restore Item" : "Archive Item"}</h2>
        <p className="text-sm font-semibold text-slate-700">{String(item["Description"] || "")} / {String(item["Specification"] || "")}</p>
        <p className="text-sm text-slate-600">
          {archived ? "Restore this product to your active inventory list." :
            "Archive hides this item from the active list but keeps deliveries, sales, payments and audit records. It does not delete stock."}
        </p>
        {!archived && !safeToArchive ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Archive is blocked: this item has on-hand, sellable or incoming quantity. Resolve the stock and delivery records first.
          </p>
        ) : null}
        <label className="block text-sm font-semibold text-slate-700">Reason
          <textarea rows={3} required minLength={8} maxLength={250} value={reason}
            onChange={event => setReason(event.target.value)} placeholder="Reason for hiding/restoring this product"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Admin access code
          <input type="password" required autoComplete="off" value={code}
            onChange={event => setCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
        </label>
        {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving || (!archived && !safeToArchive)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Saving..." : archived ? "Confirm Restore" : "Confirm Archive"}
          </button>
        </div>
      </form>
    </div>
  );
}
