"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  rowNumber: number;
  customerId: string;
  createdAt: string;
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

const emptyForm = {
  rowNumber: 0,
  customerId: "",
  createdAt: "",
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  customerType: "Retail",
  status: "Active",
  notes: "",
};

const customerTypes = ["Retail", "Dealer", "Contractor", "Corporate", "Government", "Installer", "Other"];
const statuses = ["Active", "Inactive", "Watchlist"];

function money(value: number | undefined) {
  return `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function customerKey(row: CustomerRow) {
  return row.customerId || `${row.rowNumber}-${row.customerName}`;
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading customers...");
  const [saving, setSaving] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState("");

  async function loadRows() {
    setMessage("Loading customers...");
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customers");
      setRows(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load customers.");
    }
  }

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const purchaseText = (row.purchases || [])
        .map((sale) => `${sale.salesRefNo} ${sale.description} ${sale.specification} ${sale.paymentStatus} ${sale.saleStatus}`)
        .join(" ");
      const text = `${row.customerName} ${row.contactPerson} ${row.phone} ${row.email} ${row.address} ${row.customerType} ${row.status} ${purchaseText}`.toLowerCase();
      return !query || text.includes(query);
    });
  }, [rows, search]);

  const activeCount = rows.filter((row) => row.status === "Active").length;
  const dealerCount = rows.filter((row) => row.customerType === "Dealer").length;
  const totalReceivables = rows.reduce((sum, row) => sum + (Number(row.outstandingBalancePhp) || 0), 0);
  const totalPurchased = rows.reduce((sum, row) => sum + (Number(row.totalPurchasedPhp) || 0), 0);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function editRow(row: CustomerRow) {
    setForm({
      rowNumber: row.rowNumber,
      customerId: row.customerId,
      createdAt: row.createdAt,
      customerName: row.customerName,
      contactPerson: row.contactPerson,
      phone: row.phone,
      email: row.email,
      address: row.address,
      customerType: row.customerType || "Retail",
      status: row.status || "Active",
      notes: row.notes,
    });
    setMessage(`Editing customer: ${row.customerName}`);
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save customer");
      setMessage(`Customer ${data?.mode || "saved"}. ID: ${data?.customerId || "created"}`);
      resetForm();
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Customer Records</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Customers</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Keep live customer records clean for sales history, receivables, warranty, and repeat orders.
        </p>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Customers</p><p className="mt-2 text-3xl font-bold text-slate-950">{rows.length}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Active Customers</p><p className="mt-2 text-3xl font-bold text-slate-950">{activeCount}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Dealers</p><p className="mt-2 text-3xl font-bold text-slate-950">{dealerCount}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Purchased</p><p className="mt-2 text-2xl font-bold text-slate-950">{money(totalPurchased)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Receivables</p><p className="mt-2 text-2xl font-bold text-rose-600">{money(totalReceivables)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={saveCustomer} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">{form.rowNumber ? "Update Customer" : "Add Customer"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use this only for real live customer records. Avoid duplicate customer names.</p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Customer Name</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.customerName} onChange={(e) => updateField("customerName", e.target.value)} placeholder="Customer or company name" required /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Contact Person</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)} placeholder="Contact person" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Phone</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="Phone" /></label>
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Email</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" /></label>
            </div>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Address</span><textarea className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Delivery or billing address" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Customer Type</span><select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.customerType} onChange={(e) => updateField("customerType", e.target.value)}>{customerTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Status</span><select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.status} onChange={(e) => updateField("status", e.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Notes</span><textarea className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Payment preference, delivery instructions, special pricing notes, etc." /></label>
            <div className="flex gap-3"><button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : form.rowNumber ? "Update Customer" : "Add Customer"}</button><button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Clear</button></div>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-bold text-slate-950">Customer List</h2><p className="mt-1 text-sm text-slate-600">Compact live list. Open only the customer you need.</p></div>
            <button type="button" onClick={loadRows} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
          </div>
          <input className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, item, sale ref, phone, email..." />
          <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200">
            {filteredRows.map((row) => {
              const key = customerKey(row);
              const expanded = expandedCustomerId === key;
              const contact = [row.contactPerson, row.phone, row.email].filter(Boolean).join(" · ");
              const extraInfo = [row.address, row.notes].filter(Boolean).join(" · ");
              return (
                <div key={key} className="border-b border-slate-100 bg-white last:border-b-0">
                  <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-bold text-slate-950">{row.customerName}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : row.status === "Watchlist" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{row.status || "Active"}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{row.customerType || "Retail"}</span>
                      </div>
                      {contact ? <p className="mt-1 truncate text-xs text-slate-600">{contact}</p> : null}
                      {extraInfo ? <p className="mt-1 truncate text-xs text-slate-500">{extraInfo}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs lg:justify-end">
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">Orders</p><p className="font-bold text-slate-950">{row.totalOrders || 0}</p></div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">Purchased</p><p className="font-bold text-slate-950">{money(row.totalPurchasedPhp)}</p></div>
                      <div className={`${Number(row.outstandingBalancePhp) > 0 ? "bg-rose-50" : "bg-slate-50"} rounded-xl px-3 py-2`}><p className="text-[11px] font-semibold text-rose-500">Balance</p><p className="font-bold text-rose-700">{money(row.outstandingBalancePhp)}</p></div>
                      <button type="button" onClick={() => setExpandedCustomerId(expanded ? "" : key)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{expanded ? "Hide" : "Orders"}</button>
                      <button type="button" onClick={() => editRow(row)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-950">Order History</h3>
                        <p className="text-xs font-semibold text-slate-500">Last purchase: {row.lastPurchaseDate || "-"}</p>
                      </div>
                      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Sale Ref</th><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Qty</th><th className="px-3 py-2 font-semibold">Grand Total</th><th className="px-3 py-2 font-semibold">Paid</th><th className="px-3 py-2 font-semibold">Balance</th><th className="px-3 py-2 font-semibold">Payment</th><th className="px-3 py-2 font-semibold">Sale</th></tr></thead>
                          <tbody>
                            {(row.purchases || []).map((sale, index) => <tr key={`${sale.salesRefNo}-${index}`} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{sale.saleDate}</td><td className="px-3 py-2 font-semibold text-slate-900">{sale.salesRefNo || "-"}</td><td className="px-3 py-2 text-slate-700">{sale.description}<p className="text-[11px] text-slate-500">{sale.specification}</p></td><td className="px-3 py-2 text-slate-700">{sale.qty}</td><td className="px-3 py-2 text-slate-700">{money(sale.grandTotalPhp)}</td><td className="px-3 py-2 text-slate-700">{money(sale.amountPaidPhp)}</td><td className="px-3 py-2 font-semibold text-rose-600">{money(sale.balancePhp)}</td><td className="px-3 py-2 text-slate-700">{sale.paymentStatus}</td><td className="px-3 py-2 text-slate-700">{sale.saleStatus}</td></tr>)}
                            {!(row.purchases || []).length ? <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No purchases/orders found for this customer yet.</td></tr> : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!filteredRows.length ? <div className="p-10 text-center text-slate-500">No customers found.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
