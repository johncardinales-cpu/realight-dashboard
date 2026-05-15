"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading customers...");
  const [saving, setSaving] = useState(false);

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
      const text = `${row.customerName} ${row.contactPerson} ${row.phone} ${row.email} ${row.address} ${row.customerType} ${row.status}`.toLowerCase();
      return !query || text.includes(query);
    });
  }, [rows, search]);

  const activeCount = rows.filter((row) => row.status === "Active").length;
  const dealerCount = rows.filter((row) => row.customerType === "Dealer").length;

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
          Add and maintain customer records for sales, payment follow-up, outstanding balances, dealer tracking, and future customer history reports.
        </p>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Customers</p><p className="mt-2 text-3xl font-bold text-slate-950">{rows.length}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Active Customers</p><p className="mt-2 text-3xl font-bold text-slate-950">{activeCount}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Dealers</p><p className="mt-2 text-3xl font-bold text-slate-950">{dealerCount}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={saveCustomer} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">{form.rowNumber ? "Update Customer" : "Add Customer"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Customer records help avoid repeated typing in sales and support future customer history reports.</p>

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
            <div><h2 className="text-xl font-bold text-slate-950">Customer List</h2><p className="mt-1 text-sm text-slate-600">Search by name, phone, email, address, or type.</p></div>
            <button type="button" onClick={loadRows} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>
          </div>
          <input className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer..." />
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Notes</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => <tr key={row.customerId || `${row.rowNumber}-${row.customerName}`} className="border-t border-slate-100 align-top"><td className="px-4 py-3"><p className="font-semibold text-slate-950">{row.customerName}</p><p className="mt-1 text-xs text-slate-500">{row.address || "No address"}</p></td><td className="px-4 py-3 text-slate-700"><p>{row.contactPerson || "-"}</p><p className="mt-1 text-xs text-slate-500">{row.phone || "No phone"}</p><p className="mt-1 text-xs text-slate-500">{row.email || "No email"}</p></td><td className="px-4 py-3 text-slate-700">{row.customerType}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : row.status === "Watchlist" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{row.status}</span></td><td className="max-w-xs px-4 py-3 leading-6 text-slate-600">{row.notes || "-"}</td><td className="px-4 py-3"><button type="button" onClick={() => editRow(row)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button></td></tr>)}
                {!filteredRows.length ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No customers found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-amber-950">Next integration</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">The next improvement is to connect this Customers list to the Sales page so customer names can auto-suggest and auto-fill contact/address details when creating a sale.</p>
      </div>
    </section>
  );
}
