export type PaymentRuleInput = {
  paymentStatus: string;
  paymentMethod: string;
  amountPaidPhp: number;
  grandTotalPhp: number;
};

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function peso(value: number) {
  return `PHP ${roundMoney(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function validatePaymentProcedure(input: PaymentRuleInput) {
  const status = normalize(input.paymentStatus || "Pending");
  const method = normalize(input.paymentMethod);
  const paid = roundMoney(input.amountPaidPhp);
  const total = roundMoney(input.grandTotalPhp);
  const balance = roundMoney(Math.max(total - paid, 0));
  const prefix = "Payment procedure review:";

  if (total <= 0) return { ok: false, error: `${prefix} Grand total must be greater than zero before saving a sale.` };
  if (status === "pending" && paid > 0) return { ok: false, error: `${prefix} Payment Status is Pending but paid amount is ${peso(paid)}. Use Partial or Paid, or set paid amount to zero.` };

  if (status === "partial") {
    if (paid <= 0) return { ok: false, error: `${prefix} Payment Status is Partial but no payment amount was entered. Enter the partial amount or change status to Pending.` };
    if (paid + 0.009 >= total) return { ok: false, error: `${prefix} Payment Status is Partial but paid amount covers the full total. Use Paid instead.` };
    if (method === "cash") return { ok: false, error: `${prefix} Partial sale was set to Cash. Use Installment, Mixed Payment, Bank Transfer, GCash, or another traceable partial-payment method.` };
  }

  if (status === "paid" && paid + 0.009 < total) return { ok: false, error: `${prefix} Payment Status is Paid but paid amount is only ${peso(paid)} of ${peso(total)}. Use Partial or collect the remaining ${peso(balance)}.` };
  if (!status || !["pending", "partial", "paid"].includes(status)) return { ok: false, error: `${prefix} Payment Status must be Pending, Partial, or Paid.` };

  return { ok: true, warning: "" };
}
