"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type InvoiceLine = {
  description: string;
  specification: string;
  qty: number;
  unitPricePhp: number;
  subtotalPhp: number;
  costPricePhp?: number;
  grossProfitPhp?: number;
};

type InvoiceData = {
  invoiceNo: string;
  saleDate: string;
  saleStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionRef: string;
  cashierName: string;
  salesperson: string;
  customer: {
    customerId?: string;
    customerName: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    customerType?: string;
  };
  lines: InvoiceLine[];
  totals: {
    productSubtotalPhp: number;
    deliveryFeePhp: number;
    installationFeePhp: number;
    otherChargePhp: number;
    discountPhp: number;
    taxAmountPhp: number;
    grandTotalPhp: number;
    paidPhp: number;
    balancePhp: number;
    tenderedAmountPhp: number;
    changeDuePhp: number;
  };
};

function money(value: number | undefined) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: string) {
  const value = String(status || "").toLowerCase();
  if (value.includes("paid")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("partial")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (value.includes("confirm")) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function label(value: string | undefined, fallback = "-") {
  return value && value.trim() ? value : fallback;
}

export default function InvoicePage() {
  const params = useParams<{ saleId: string }>();
  const saleId = decodeURIComponent(String(params.saleId || ""));
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [message, setMessage] = useState("Loading invoice...");

  async function loadInvoice() {
    if (!saleId) return;
    setMessage("Loading invoice...");
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(saleId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load invoice");
      setInvoice(data);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load invoice");
      setInvoice(null);
    }
  }

  useEffect(() => { loadInvoice().catch(console.error); }, [saleId]);

  const paidStatus = useMemo(() => {
    if (!invoice) return "Pending";
    if (Number(invoice.totals.balancePhp || 0) <= 0) return "Paid";
    if (Number(invoice.totals.paidPhp || 0) > 0) return "Partial";
    return invoice.paymentStatus || "Pending";
  }, [invoice]);

  if (message && !invoice) {
    return (
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Invoice</h1>
        <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p>
        <button onClick={() => history.back()} className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Back</button>
      </section>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <section className="invoice-page mx-auto max-w-5xl space-y-5 print:m-0 print:block print:max-w-none print:space-y-0">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        @media print {
          html, body {
            width: 210mm !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside, header, nav, .no-print {
            display: none !important;
          }

          main {
            display: block !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .invoice-page {
            width: 198mm !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .invoice-sheet {
            width: 198mm !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            transform-origin: top center;
          }

          .invoice-header { padding-bottom: 10px !important; gap: 14px !important; }
          .invoice-company-logo { width: 36px !important; height: 36px !important; border-radius: 10px !important; font-size: 16px !important; }
          .invoice-company-title { font-size: 24px !important; line-height: 1.05 !important; }
          .invoice-company-subtitle { font-size: 9px !important; letter-spacing: 0.22em !important; }
          .invoice-company-info { margin-top: 10px !important; font-size: 11px !important; line-height: 1.45 !important; }
          .invoice-status-box { min-width: 210px !important; padding: 12px !important; font-size: 11px !important; border-radius: 14px !important; }
          .invoice-info-grid { gap: 12px !important; padding-top: 12px !important; padding-bottom: 12px !important; }
          .invoice-card { padding: 12px !important; border-radius: 14px !important; }
          .invoice-card-title { font-size: 9px !important; letter-spacing: 0.20em !important; }
          .invoice-customer-name { margin-top: 8px !important; font-size: 16px !important; }
          .invoice-small-text { font-size: 11px !important; line-height: 1.45 !important; }
          .invoice-lines-section { padding-top: 12px !important; padding-bottom: 12px !important; }
          .invoice-table { font-size: 11px !important; }
          .invoice-table th { padding: 8px 10px !important; font-size: 9px !important; }
          .invoice-table td { padding: 8px 10px !important; }
          .invoice-summary-grid { gap: 12px !important; padding-top: 12px !important; }
          .invoice-notes, .invoice-totals { padding: 12px !important; border-radius: 14px !important; font-size: 11px !important; }
          .invoice-totals-inner { gap: 6px !important; font-size: 11px !important; }
          .invoice-grand-total { font-size: 15px !important; }
          .invoice-balance { padding: 8px 10px !important; border-radius: 8px !important; }
          .invoice-signatures { margin-top: 18px !important; gap: 28px !important; font-size: 11px !important; }

          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-950">Invoice Preview</p>
          <p className="text-xs text-slate-500">Print this page or save as PDF from your browser print dialog.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => history.back()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Back</button>
          <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm">Print Invoice</button>
        </div>
      </div>

      <div className="invoice-sheet rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:p-0">
        <div className="invoice-header flex flex-wrap items-start justify-between gap-8 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="invoice-company-logo flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-xl font-black text-orange-600">R</div>
              <div>
                <h1 className="invoice-company-title text-3xl font-black tracking-tight text-slate-950">Realights Solar</h1>
                <p className="invoice-company-subtitle text-xs font-black uppercase tracking-[0.3em] text-orange-500">Sales Invoice</p>
              </div>
            </div>
            <div className="invoice-company-info mt-5 text-sm leading-6 text-slate-600">
              <p>Realight Operations Dashboard</p>
              <p>Solar products, installation, and electrical supplies</p>
              <p>Email: john.cardinales@gmail.com</p>
            </div>
          </div>

          <div className="invoice-status-box min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <div className="flex justify-between gap-4"><span className="font-semibold text-slate-500">Invoice No.</span><span className="font-black text-slate-950">{label(invoice.invoiceNo)}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span className="font-semibold text-slate-500">Date</span><span className="font-bold text-slate-950">{label(invoice.saleDate)}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span className="font-semibold text-slate-500">Sale Status</span><span className={`rounded-full border px-2 py-0.5 text-xs font-black ${statusClass(invoice.saleStatus)}`}>{label(invoice.saleStatus)}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span className="font-semibold text-slate-500">Payment</span><span className={`rounded-full border px-2 py-0.5 text-xs font-black ${statusClass(paidStatus)}`}>{paidStatus}</span></div>
          </div>
        </div>

        <div className="invoice-info-grid grid grid-cols-1 gap-5 border-b border-slate-200 py-6 md:grid-cols-2 print:grid-cols-2">
          <div className="invoice-card rounded-2xl border border-slate-200 p-5 print-avoid-break">
            <p className="invoice-card-title text-xs font-black uppercase tracking-[0.25em] text-slate-400">Bill To</p>
            <h2 className="invoice-customer-name mt-3 text-xl font-black text-slate-950">{label(invoice.customer.customerName, "Walk-in Customer")}</h2>
            <p className="invoice-small-text mt-2 text-sm text-slate-600">{label(invoice.customer.contactPerson, "No contact person")}</p>
            <p className="invoice-small-text text-sm text-slate-600">{label(invoice.customer.phone, "No phone")} · {label(invoice.customer.email, "No email")}</p>
            <p className="invoice-small-text mt-2 text-sm text-slate-600">{label(invoice.customer.address, "No address")}</p>
          </div>

          <div className="invoice-card rounded-2xl border border-slate-200 p-5 print-avoid-break">
            <p className="invoice-card-title text-xs font-black uppercase tracking-[0.25em] text-slate-400">Payment Details</p>
            <div className="invoice-small-text mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="font-semibold text-slate-500">Method</span><span className="font-bold text-slate-950">{label(invoice.paymentMethod)}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-slate-500">Reference</span><span className="font-bold text-slate-950">{label(invoice.transactionRef)}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-slate-500">Cashier</span><span className="font-bold text-slate-950">{label(invoice.cashierName)}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-slate-500">Salesperson</span><span className="font-bold text-slate-950">{label(invoice.salesperson)}</span></div>
            </div>
          </div>
        </div>

        <div className="invoice-lines-section py-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="invoice-table min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Specification</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line, index) => (
                  <tr key={`${line.description}-${line.specification}-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-bold text-slate-950">{Number(line.qty || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 font-bold text-slate-950">{label(line.description)}</td>
                    <td className="px-4 py-4 text-slate-600">{label(line.specification)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-700">{money(line.unitPricePhp)}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-950">{money(line.subtotalPhp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-summary-grid grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 md:grid-cols-[1fr_360px] print:grid-cols-[1fr_320px]">
          <div className="invoice-notes rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 print-avoid-break">
            <p className="font-black text-slate-950">Notes</p>
            <p className="mt-2">Please retain this invoice for warranty, service, and payment reference. Amounts are in Philippine Peso.</p>
          </div>

          <div className="invoice-totals rounded-2xl border border-slate-200 p-5 print-avoid-break">
            <div className="invoice-totals-inner space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Product Subtotal</span><span className="font-bold text-slate-950">{money(invoice.totals.productSubtotalPhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Delivery Fee</span><span className="font-bold text-slate-950">{money(invoice.totals.deliveryFeePhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Installation Fee</span><span className="font-bold text-slate-950">{money(invoice.totals.installationFeePhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Other Charges</span><span className="font-bold text-slate-950">{money(invoice.totals.otherChargePhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-bold text-rose-600">-{money(invoice.totals.discountPhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-bold text-slate-950">{money(invoice.totals.taxAmountPhp)}</span></div>
              <div className="border-t border-slate-200 pt-3">
                <div className="invoice-grand-total flex justify-between text-lg"><span className="font-black text-slate-950">Grand Total</span><span className="font-black text-slate-950">{money(invoice.totals.grandTotalPhp)}</span></div>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Paid / Applied</span><span className="font-bold text-emerald-700">{money(invoice.totals.paidPhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cash Tendered</span><span className="font-bold text-slate-950">{money(invoice.totals.tenderedAmountPhp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Change</span><span className="font-bold text-rose-600">{money(invoice.totals.changeDuePhp)}</span></div>
              <div className="invoice-balance flex justify-between rounded-xl bg-slate-950 px-4 py-3 text-white"><span className="font-black">Balance</span><span className="font-black">{money(invoice.totals.balancePhp)}</span></div>
            </div>
          </div>
        </div>

        <div className="invoice-signatures mt-10 grid grid-cols-2 gap-10 text-center text-sm print-avoid-break">
          <div><div className="border-t border-slate-300 pt-3 font-bold text-slate-950">Prepared By</div></div>
          <div><div className="border-t border-slate-300 pt-3 font-bold text-slate-950">Customer Signature</div></div>
        </div>
      </div>
    </section>
  );
}
