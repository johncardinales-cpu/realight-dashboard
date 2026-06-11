"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PurchaseRow = {
  saleDate: string;
  salesRefNo: string;
  description: string;
  specification: string;
  qty: number;
  grandTotalPhp: number;
  amountPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
};

type CustomerRow = {
  customerId: string;
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  customerType: string;
  status: string;
  notes: string;
  totalOrders?: number;
  totalPurchasedPhp?: number;
  totalPaidPhp?: number;
  outstandingBalancePhp?: number;
  lastPurchaseDate?: string;
  purchases?: PurchaseRow[];
};

function money(value: number | undefined) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ageDays(date: string) {
  if (!date) return 0;
  const start = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(Math.floor((Date.now() - start) / 86400000), 0);
}

function agingBucket(days: number) {
  if (days <= 30) return "Current / 1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export default function CustomerAccountPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = decodeURIComponent(String(params.customerId || ""));
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [message, setMessage] = useState("Loading customer account...");

  async function loadCustomer() {
    setMessage("Loading customer account...");
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customer");
      setCustomers(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load customer account.");
    }
  }

  useEffect(() => { loadCustomer().catch(console.error); }, [customerId]);

  const customer = useMemo(() => {
    const key = customerId.toLowerCase();
    return customers.find((row) => row.customerId.toLowerCase() === key) || customers.find((row) => row.customerName.toLowerCase() === key);
  }, [customers, customerId]);

  const purchases = customer?.purchases || [];
  const openReceivables = purchases.filter((sale) => Number(sale.balancePhp) > 0);
  const totalPurchased = customer?.totalPurchasedPhp || purchases.reduce((sum, sale) => sum + Number(sale.grandTotalPhp || 0), 0);
  const totalPaid = customer?.totalPaidPhp || purchases.reduce((sum, sale) => sum + Number(sale.amountPaidPhp || 0), 0);
  const totalBalance = customer?.outstandingBalancePhp || purchases.reduce((sum, sale) => sum + Number(sale.balancePhp || 0), 0);

  const aging = openReceivables.reduce<Record<string, number>>((map, sale) => {
    const bucket = agingBucket(ageDays(sale.saleDate));
    map[bucket] = (map[bucket] || 0) + Number(sale.balancePhp || 0);
    return map;
  }, {});

  if (message && !customer) {
    return <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-slate-600">{message}</p></section>;
  }

  if (!customer) {
    return <section className="space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">Customer not found</h1><p className="mt-2 text-sm text-slate-600">Return to Customers and select an existing record.</p><button onClick={() => history.back()} className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Back</button></div></section>;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Customer Account</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{customer.customerName}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{customer.contactPerson || "No contact person"} · {customer.phone || "No phone"} · {customer.email || "No email"}</p>
            <p className="text-sm text-slate-500">{customer.address || "No address"}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => history.back()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Back</button>
            <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Print SOA</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Purchased</p><p className="mt-2 text-2xl font-bold text-slate-950">{money(totalPurchased)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Paid</p><p className="mt-2 text-2xl font-bold text-emerald-700">{money(totalPaid)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-bold text-rose-700">{money(totalBalance)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Orders</p><p className="mt-2 text-2xl font-bold text-slate-950">{customer.totalOrders || purchases.length}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Sales History</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sale Ref</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>
                {purchases.map((sale, index) => <tr key={`${sale.salesRefNo}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3">{sale.saleDate}</td><td className="px-4 py-3 font-semibold">{sale.salesRefNo || "-"}</td><td className="px-4 py-3">{sale.description}<p className="text-xs text-slate-500">{sale.specification}</p></td><td className="px-4 py-3">{sale.qty}</td><td className="px-4 py-3">{money(sale.grandTotalPhp)}</td><td className="px-4 py-3">{money(sale.amountPaidPhp)}</td><td className="px-4 py-3 font-semibold text-rose-600">{money(sale.balancePhp)}</td><td className="px-4 py-3">{sale.paymentStatus} / {sale.saleStatus}</td></tr>)}
                {!purchases.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No sales history found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Open Receivables</h2>
            <div className="mt-4 space-y-3">
              {openReceivables.map((sale) => <div key={sale.salesRefNo} className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="font-bold text-rose-900">{sale.salesRefNo || "No ref"}</p><p className="mt-1 text-sm text-rose-800">Balance {money(sale.balancePhp)} · {ageDays(sale.saleDate)} days</p></div>)}
              {!openReceivables.length ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">No open receivables for this customer.</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Aging Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              {["Current / 1-30", "31-60", "61-90", "90+"].map((bucket) => <div key={bucket} className="flex justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold text-slate-600">{bucket}</span><span className="font-bold text-slate-950">{money(aging[bucket] || 0)}</span></div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Statement of Account</h2>
        <div className="mt-4 rounded-2xl border border-slate-200 p-5">
          <p className="text-lg font-black text-slate-950">REALIGHTS SOLAR</p>
          <p className="mt-2 text-sm text-slate-600">Customer: <span className="font-bold text-slate-950">{customer.customerName}</span></p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm"><div><p className="text-slate-500">Total Sales</p><p className="font-bold">{money(totalPurchased)}</p></div><div><p className="text-slate-500">Total Paid</p><p className="font-bold">{money(totalPaid)}</p></div><div><p className="text-slate-500">Total Balance</p><p className="font-bold text-rose-700">{money(totalBalance)}</p></div></div>
        </div>
      </div>
    </section>
  );
}
