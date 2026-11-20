"use client";

export type AdjustmentMode = "delta" | "set";

export function proposedAdjustment(current: number, mode: AdjustmentMode, input: string): { delta: number; target: number } | null {
  const text = input.trim();
  if (mode === "delta" ? !/^[+-][1-9][0-9]*$/.test(text) : !/^(0|[1-9][0-9]*)$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isSafeInteger(number) || !Number.isSafeInteger(current) || current < 0) return null;
  const target = mode === "delta" ? current + number : number;
  if (!Number.isSafeInteger(target) || target < 0 || target > 1000000 || target === current) return null;
  return { delta: target - current, target };
}

export default function QuantityDeltaInput({
  current, mode, setMode, value, setValue,
}: {
  current: number;
  mode: AdjustmentMode;
  setMode: (mode: AdjustmentMode) => void;
  value: string;
  setValue: (value: string) => void;
}) {
  const preview = proposedAdjustment(current, mode, value);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quantity adjustment mode">
        <button type="button" aria-pressed={mode === "delta"} onClick={() => { setMode("delta"); setValue(""); }}
          className={`rounded-xl border px-3 py-2 text-sm font-bold ${mode === "delta" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}>
          Change by (+/−)
        </button>
        <button type="button" aria-pressed={mode === "set"} onClick={() => { setMode("set"); setValue(String(current)); }}
          className={`rounded-xl border px-3 py-2 text-sm font-bold ${mode === "set" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}>
          Set Final Qty
        </button>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        {mode === "delta" ? "Quantity change (type +5 or -4)" : "Correct final quantity"}
        <input type="text" inputMode="numeric" required autoComplete="off"
          placeholder={mode === "delta" ? "+5 or -4" : "Enter final count"}
          value={value} onChange={event => setValue(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
        />
      </label>
      <p className="text-sm text-slate-600">
        {preview ? `Quantity ${current} → ${preview.target} (${preview.delta > 0 ? "+" : ""}${preview.delta} units)`
          : "Enter a valid change. Negative final stock and zero-change adjustments are not allowed."}
      </p>
    </div>
  );
}
