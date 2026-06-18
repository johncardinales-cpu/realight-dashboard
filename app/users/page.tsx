"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type RoleName = "Admin" | "Accounting" | "Cashier";

type UserProfile = {
  name: string;
  email: string;
  role: RoleName;
  status: "Active" | "Pending Supabase" | "Disabled";
};

const STORAGE_KEY = "realights_user_role_plan";

const roleAccess: Record<RoleName, { access: string; description: string; pages: string[]; limits: string[] }> = {
  Admin: {
    access: "Full access",
    description: "Owner/manager access. Admin can manage all modules, users, roles, settings, migration, reports, and audit review.",
    pages: ["Dashboard", "Sales", "Confirm Sales", "Payments", "Inventory", "Pricing", "Customers", "Expenses", "Reports", "Users", "Settings", "Migration", "Audit Logs"],
    limits: ["No default limits", "Can void/cancel/undo", "Can add users", "Can assign roles", "Can change page access"],
  },
  Accounting: {
    access: "Finance and reports",
    description: "Accounting can review reports, collections, receivables, expenses, payment history, exports, and audit logs.",
    pages: ["Dashboard view", "Payments history", "Receivables", "Expenses", "Reports", "Exports", "Audit Logs view"],
    limits: ["Cannot add users", "Cannot change roles/settings", "Cannot edit inventory/pricing", "Cannot void confirmed sales without Admin"],
  },
  Cashier: {
    access: "Sales and payments",
    description: "Cashier can create sales, receive payments, print invoices/receipts, and view limited customer, price, and stock info.",
    pages: ["Sales", "Payments", "Invoices", "Customers view", "Pricing view", "Inventory availability view"],
    limits: ["Cannot add users", "Cannot change roles/settings", "Cannot edit pricing/cost", "Cannot access full reports", "Cannot void/cancel without Admin"],
  },
};

const defaultUsers: UserProfile[] = [
  { name: "John Cardinales", email: "john.cardinales@gmail.com", role: "Admin", status: "Active" },
];

const checklist = [
  "For now, live access is still single Admin through the configured Vercel admin login.",
  "This page is where Admin will add users after Supabase Auth is connected.",
  "Only Admin should be allowed to open Users and Settings.",
  "Accounting and Cashier roles are prepared here before database enforcement.",
  "Every future user add, role change, disable, and restore should write to audit logs.",
];

function RoleBadge({ role }: { role: RoleName }) {
  const className = role === "Admin" ? "bg-emerald-50 text-emerald-700" : role === "Accounting" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{role}</span>;
}

function StatusBadge({ status }: { status: UserProfile["status"] }) {
  const className = status === "Active" ? "bg-emerald-50 text-emerald-700" : status === "Disabled" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{status}</span>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>(defaultUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>("Cashier");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUsers(JSON.parse(stored));
    } catch {
      setUsers(defaultUsers);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch {
      // Ignore local storage write errors. Supabase will become the source of truth later.
    }
  }, [users]);

  const selectedRole = useMemo(() => roleAccess[role], [role]);
  const secondaryUserCount = users.filter((user) => user.status !== "Disabled" && user.email !== "john.cardinales@gmail.com").length;

  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setMessage("Name and email are required to prepare a user profile.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) {
      setMessage("This email already exists in the user list.");
      return;
    }
    setUsers((prev) => [...prev, { name: name.trim(), email: email.trim(), role, status: "Pending Supabase" }]);
    setName("");
    setEmail("");
    setRole("Cashier");
    setMessage("User profile prepared. It will become a real login after Supabase Auth is connected.");
  }

  function removeUser(emailToRemove: string) {
    if (emailToRemove === "john.cardinales@gmail.com") return;
    setUsers((prev) => prev.filter((user) => user.email !== emailToRemove));
    setMessage("Prepared user profile removed from this planning list.");
  }

  function resetPlan() {
    setUsers(defaultUsers);
    setMessage("User plan reset to single Admin only.");
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Access Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Users</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          This is the future Admin area for adding users, assigning roles, and controlling page access. For now, only John is active Admin; added users here are planning records until Supabase Auth is connected.
        </p>
        {message ? <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Current Access Mode</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">Single Admin</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">John Cardinales is the only active Admin for now.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Prepared Users</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{secondaryUserCount}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Profiles staged for Accounting, Cashier, or second Admin later.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Next Enforcement</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">Supabase Auth</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Needed before user-by-user restrictions become real security.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-sm font-bold text-amber-900">Important before migration</p>
        <p className="mt-1 text-sm leading-6 text-amber-800">Adding a user here does not create a live login yet. After Supabase migration, this same area will create real accounts, roles, views, and limits. Only Admin will be allowed to use it.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">User Profiles</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Planning list for migration. Supabase will become the source of truth later.</p>
            </div>
            <button type="button" onClick={resetPlan} className="w-fit rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Reset to John Only</button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Role</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-bold text-slate-950">{user.name}</td>
                    <td className="px-5 py-4 text-slate-700">{user.email}</td>
                    <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                    <td className="px-5 py-4"><StatusBadge status={user.status} /></td>
                    <td className="px-5 py-4">
                      {user.email === "john.cardinales@gmail.com" ? <span className="text-xs font-semibold text-slate-400">Protected Admin</span> : <button type="button" onClick={() => removeUser(user.email)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={addUser} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Prepare User</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Stage a user and role now. We will turn these into real accounts after Supabase Auth is connected.</p>
          <div className="mt-5 space-y-4">
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Full Name</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Staff name" /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Email</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@email.com" /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Role</span><select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as RoleName)}><option>Cashier</option><option>Accounting</option><option>Admin</option></select></label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-950">Selected Role Access</p><p className="mt-1 text-sm leading-6 text-slate-600">{selectedRole.description}</p><div className="mt-3 flex flex-wrap gap-2">{selectedRole.pages.map((page) => <span key={page} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{page}</span>)}</div></div>
            <button type="submit" className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">Prepare User Profile</button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Role Access Matrix</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-4 font-semibold">Role</th><th className="px-5 py-4 font-semibold">Access Level</th><th className="px-5 py-4 font-semibold">Allowed Views</th><th className="px-5 py-4 font-semibold">Limits</th></tr></thead>
            <tbody>
              {(Object.keys(roleAccess) as RoleName[]).map((item) => (
                <tr key={item} className="border-t border-slate-100 align-top"><td className="px-5 py-4"><RoleBadge role={item} /></td><td className="px-5 py-4 font-semibold text-slate-700">{roleAccess[item].access}<p className="mt-1 text-sm font-normal leading-6 text-slate-500">{roleAccess[item].description}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{roleAccess[item].pages.map((page) => <span key={page} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{page}</span>)}</div></td><td className="px-5 py-4"><ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">{roleAccess[item].limits.map((limit) => <li key={limit}>{limit}</li>)}</ul></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Access Checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {checklist.map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"><span className="mr-2 font-bold text-emerald-600">✓</span>{item}</div>)}
        </div>
      </div>
    </section>
  );
}
