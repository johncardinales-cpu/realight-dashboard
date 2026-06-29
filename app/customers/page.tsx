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

type PaymentHistoryRow = {
  entryType: string;
  paymentDate: string;
  salesRefNo: string;
  groupRef: string;
  customerName: string;
  paymentMethod: string;
  amountPaidPhp: number;
  transactionRef: string;
  cashierName: string;
  notes: string;
  paymentStatus: string;
  totalSalePhp: number;
  runningPaidPhp: number;
  balanceAfterPhp: number;
  saleStatus: string;
  createdAt: string;
  paymentId: string;
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

type UnpaidOrder = {
  key: string;
  saleDate: string;
  salesRefNo: string;
  grandTotalPhp: number;
  amountPaidPhp: number;
  balancePhp: number;
  paymentStatus: string;
  saleStatus: string;
  lineCount: number;
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

function normalizeDate(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const [month, day, yearRaw] = raw.split("/").map(Number);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) {
      return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function normalizedName(value: string | undefined) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function customerKey(row: CustomerRow) {
  return row.customerId || `${row.rowNumber}-${row.customerName}`;
}

function inactiveSale(value: string) {
  return ["cancelled", "canceled", "void", "voided"].includes(String(value || "").trim().toLowerCase());
}

function inactivePayment(value: string) {
  return ["voided", "cancelled", "canceled"].includes(String(value || "").trim().toLowerCase());
}

function unpaidOrdersFor(row: CustomerRow) {
  const map = new Map<string, UnpaidOrder>();

  (row.purchases || [])
    .filter((sale) => Number(sale.balancePhp) > 0 && !inactiveSale(sale.saleStatus))
    .forEach((sale) => {
      const saleDate = normalizeDate(sale.saleDate);
      const key = sale.salesRefNo || `${saleDate}-${sale.description}-${sale.specification}`;
      const current = map.get(key) || {
        key,
        saleDate,
        salesRefNo: sale.salesRefNo || "-",
        grandTotalPhp: 0,
        amountPaidPhp: 0,
        balancePhp: 0,
        paymentStatus: sale.paymentStatus || "Pending",
        saleStatus: sale.saleStatus || "Draft",
        lineCount: 0,
      };

      current.grandTotalPhp += Number(sale.grandTotalPhp) || 0;
      current.amountPaidPhp += Number(sale.amountPaidPhp) || 0;
      current.balancePhp += Number(sale.balancePhp) || 0;
      current.paymentStatus = sale.paymentStatus || current.paymentStatus;
      current.saleStatus = sale.saleStatus || current.saleStatus;
      current.lineCount += 1;
      map.set(key, current);
    });

  return Array.from(map.values()).sort((a, b) => `${b.saleDate}-${b.salesRefNo}`.localeCompare(`${a.saleDate}-${a.salesRefNo}`));
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading customers...");
  const [saving, setSaving] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState("");

  async function loadRows() {
    setMessage("Loading customers...");
    try {
      const [customersRes, paymentsRes] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch(`/api/payments?history=1&t=${Date.now()}`, { cache: "no-store" }),
      ]);

      const customersData = await customersRes.json();
      const paymentsData = await paymentsRes.json().catch(() => []);

      if (!customersRes.ok) throw new Error(customersData?.error || "Failed to load customers");

      setRows(Array.isArray(customersData) ? customersData : []);
      setPaymentHistory(paymentsRes.ok && Array.isArray(paymentsData) ? paymentsData : []);
      setMessage(paymentsRes.ok ? "" : "Customers loaded. Payment history is temporarily unavailable.");
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

  function paymentRowsFor(row: CustomerRow) {
    const key = normalizedName(row.customerName);
    return paymentHistory
      .filter((payment) => normalizedName(payment.customerName) === key)
      .sort((a, b) => `${normalizeDate(b.paymentDate)}-${b.createdAt}-${b.paymentId}`.localeCompare(`${normalizeDate(a.paymentDate)}-${a.createdAt}-${a.paymentId}`));
  }

  function paymentTotalFor(payments: PaymentHistoryRow[]) {
    return payments.reduce((sum, payment) => sum + (inactivePayment(payment.paymentStatus) ? 0 : Number(payment.amountPaidPhp) || 0), 0);
  }

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
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Unpaid</p><p className="mt-2 text-2xl font-bold text-rose-600">{money(totalReceivables)}</p></div>
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
              const totalUnpaid = Number(row.outstandingBalancePhp) || 0;
              const unpaidOrders = unpaidOrdersFor(row);
              const lastPurchaseDate = normalizeDate(row.lastPurchaseDate);
              const customerPayments = paymentRowsFor(row);
              const totalReceived = paymentTotalFor(customerPayments) || Number(row.totalPaidPhp) || 0;

              return (
                <div key={key} className="border-b border-slate-100 bg-white last:border-b-0">
                  <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-bold text-slate-950">{row.customerName}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : row.status === "Watchlist" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{row.status || "Active"}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{row.customerType || "Retail"}</span>
                        {totalUnpaid > 0 ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">Unpaid</span> : null}
                      </div>
                      {contact ? <p className="mt-1 truncate text-xs text-slate-600">{contact}</p> : null}
                      {extraInfo ? <p className="mt-1 truncate text-xs text-slate-500">{extraInfo}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs lg:justify-end">
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">Orders</p><p className="font-bold text-slate-950">{row.totalOrders || 0}</p></div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">Received</p><p className="font-bold text-emerald-700">{money(totalReceived)}</p></div>
                      <div className={`${totalUnpaid > 0 ? "border border-rose-100 bg-rose-50" : "bg-slate-50"} rounded-xl px-3 py-2`}><p className="text-[11px] font-semibold text-rose-500">Balance Remaining</p><p className="font-bold text-rose-700">{money(totalUnpaid)}</p></div>
                      <button type="button" onClick={() => setExpandedCustomerId(expanded ? "" : key)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{expanded ? "Hide" : "Records"}</button>
                      <button type="button" onClick={() => editRow(row)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                      <div className="mb-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-semibold text-slate-500">Balance Remaining</p><p className="mt-1 text-base font-bold text-rose-700">{money(totalUnpaid)}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-semibold text-slate-500">Unpaid Orders</p><p className="mt-1 text-base font-bold text-slate-950">{unpaidOrders.length}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-semibold text-slate-500">Amount Received</p><p className="mt-1 text-base font-bold text-emerald-700">{money(totalReceived)}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-semibold text-slate-500">Payment Records</p><p className="mt-1 text-base font-bold text-slate-950">{customerPayments.length}</p></div>
                      </div>

                      {unpaidOrders.length ? (
                        <div className="mb-4">
                          <h3 className="mb-2 text-sm font-bold text-slate-950">Unpaid Orders</h3>
                          <div className="max-h-56 overflow-auto rounded-xl border border-rose-100 bg-white">
                            <table className="min-w-full text-left text-xs">
                              <thead className="sticky top-0 bg-rose-50 text-rose-700"><tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Sale Ref</th><th className="px-3 py-2 font-semibold">Lines</th><th className="px-3 py-2 font-semibold">Grand Total</th><th className="px-3 py-2 font-semibold">Paid</th><th className="px-3 py-2 font-semibold">Balance</th><th className="px-3 py-2 font-semibold">Payment</th></tr></thead>
                              <tbody>
                                {unpaidOrders.map((order) => <tr key={order.key} className="border-t border-rose-50"><td className="px-3 py-2 text-slate-700">{normalizeDate(order.saleDate)}</td><td className="px-3 py-2 font-semibold text-slate-900">{order.salesRefNo}</td><td className="px-3 py-2 text-slate-700">{order.lineCount}</td><td className="px-3 py-2 text-slate-700">{money(order.grandTotalPhp)}</td><td className="px-3 py-2 text-slate-700">{money(order.amountPaidPhp)}</td><td className="px-3 py-2 font-bold text-rose-700">{money(order.balancePhp)}</td><td className="px-3 py-2 text-slate-700">{order.paymentStatus}</td></tr>)}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : totalUnpaid > 0 ? (
                        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">This customer has an unpaid balance. Open Sales/Payments for older unpaid order details if they are not shown in this recent history list.</p>
                      ) : null}

                      <div className="mb-4">
                        <h3 className="mb-2 text-sm font-bold text-slate-950">Payment History</h3>
                        <div className="max-h-56 overflow-auto rounded-xl border border-emerald-100 bg-white">
                          <table className="min-w-full text-left text-xs">
                            <thead className="sticky top-0 bg-emerald-50 text-emerald-700"><tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Sale Ref</th><th className="px-3 py-2 font-semibold">Method</th><th className="px-3 py-2 font-semibold">Amount Received</th><th className="px-3 py-2 font-semibold">Balance After</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Notes</th></tr></thead>
                            <tbody>
                              {customerPayments.map((payment, index) => <tr key={payment.paymentId || `${payment.salesRefNo}-${index}`} className="border-t border-emerald-50"><td className="px-3 py-2 text-slate-700">{normalizeDate(payment.paymentDate)}</td><td className="px-3 py-2 font-semibold text-slate-900">{payment.salesRefNo || payment.groupRef || "-"}</td><td className="px-3 py-2 text-slate-700">{payment.paymentMethod || "-"}</td><td className="px-3 py-2 font-bold text-emerald-700">{money(payment.amountPaidPhp)}</td><td className="px-3 py-2 text-rose-700">{money(payment.balanceAfterPhp)}</td><td className="px-3 py-2 text-slate-700">{payment.paymentStatus || payment.entryType}</td><td className="px-3 py-2 text-slate-600">{payment.notes || "-"}</td></tr>)}
                              {!customerPayments.length ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No payment history found for this customer yet.</td></tr> : null}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-950">Order History</h3>
                        <p className="text-xs font-semibold text-slate-500">Last purchase: {lastPurchaseDate || "-"}</p>
                      </div>
                      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Sale Ref</th><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Qty</th><th className="px-3 py-2 font-semibold">Grand Total</th><th className="px-3 py-2 font-semibold">Paid</th><th className="px-3 py-2 font-semibold">Balance</th><th className="px-3 py-2 font-semibold">Payment</th><th className="px-3 py-2 font-semibold">Sale</th></tr></thead>
                          <tbody>
                            {(row.purchases || []).map((sale, index) => <tr key={`${sale.salesRefNo}-${index}`} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{normalizeDate(sale.saleDate)}</td><td className="px-3 py-2 font-semibold text-slate-900">{sale.salesRefNo || "-"}</td><td className="px-3 py-2 text-slate-700">{sale.description}<p className="text-[11px] text-slate-500">{sale.specification}</p></td><td className="px-3 py-2 text-slate-700">{sale.qty}</td><td className="px-3 py-2 text-slate-700">{money(sale.grandTotalPhp)}</td><td className="px-3 py-2 text-slate-700">{money(sale.amountPaidPhp)}</td><td className="px-3 py-2 font-semibold text-rose-600">{money(sale.balancePhp)}</td><td className="px-3 py-2 text-slate-700">{sale.paymentStatus}</td><td className="px-3 py-2 text-slate-700">{sale.saleStatus}</td></tr>)}
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
