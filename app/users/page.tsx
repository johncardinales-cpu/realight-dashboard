"use client";

import { FormEvent, useMemo, useState } from "react";

type RoleName = "Admin" | "Cashier" | "Inventory Staff" | "Viewer / Auditor";

type UserProfile = {
  name: string;
  email: string;
  role: RoleName;
  status: "Active" | "Training" | "Disabled";
};

const roleAccess: Record<RoleName, { access: string; description: string; pages: string[] }> = {
  Admin: {
    access: "Full access",
    description: "Can manage all modules, settings, migration, reset tools, reports, and audit review.",
    pages: ["Dashboard", "Incoming Deliveries", "Inventory", "Inventory Review", "Sales", "Confirm Sales", "Payments", "Expenses", "Reports", "Migration", "Testing Reset", "Users", "Settings", "Activity Log"],
  },
  Cashier: {
    access: "Sales and payments only",
    description: "Recommended for front-line staff who create sales, record payments, and view limited daily summaries.",
    pages: ["Dashboard", "Sales", "Payments", "Reports limited", "Activity Log limited"],
  },
  "Inventory Staff": {
    access: "Inventory operations only",
    description: "Recommended for staff receiving deliveries, checking stock, and marking items available/damaged/cancelled.",
    pages: ["Dashboard", "Incoming Deliveries", "Inventory", "Inventory Review", "Activity Log limited"],
  },
  "Viewer / Auditor": {
    access: "Read-only review",
    description: "Recommended for owners/accounting/auditors who need reports, logs, and read-only stock review.",
    pages: ["Dashboard", "Inventory Review", "Reports", "Activity Log"],
  },
};

const defaultUsers: UserProfile[] = [
  { name: "Configured Admin", email: "Hidden in Vercel", role: "Admin", status: "Active" },
];

const checklist = [
  "Current production login still uses REALIGHTS_ADMIN_EMAIL and REALIGHTS_ACCESS_CODE from Vercel.",
  "Secondary users here are a role/permission plan for trial and migration readiness.",
  "For true enforced limited access, the next backend step is App_Users or Supabase Auth.",
  "The access code is never displayed in the app for security.",
  "Logout is available in the top bar.",
];

function RoleBadge({ role }: { role: RoleName }) {
  const className = role === "Admin" ? "bg-emerald-50 text-emerald-700" : role === "Cashier" ? "bg-blue-50 text-blue-700" : role === "Inventory Staff" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{role}</span>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>(defaultUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>("Cashier");
  const [message, setMessage] = useState("");

  const selectedRole = useMemo(() => roleAccess[role], [role]);

  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setMessage("Name and email are required to add a secondary user profile.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) {
      setMessage("This email already exists in the user list.");
      return;
    }
    setUsers((prev) => [...prev, { name: name.trim(), email: email.trim(), role, status: "Training" }]);
    setName("");
    setEmail("");
    setRole("Cashier");
    setMessage("Secondary user profile added for planning/training. Backend-enforced login can be connected next.");
  }

  function removeUser(emailToRemove: string) {
    setUsers((prev) => prev.filter((user) => user.email !== emailToRemove));
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Access Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Users</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manage staff access planning for Realights POS. Current live login uses one secure admin access code. This page prepares secondary users and limited roles for the next database/authentication upgrade.
        </p>
        {message ? <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Current Access Mode</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">Admin Login</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Email plus private access code. Best for controlled trial and training.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Secondary Users</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{Math.max(users.length - 1, 0)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Profiles prepared for role-based access upgrade.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Recommended Upgrade</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">App_Users / Supabase Auth</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Needed before true user-by-user restrictions are enforced.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">User Profiles</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use this list for training and migration planning. Actual enforced limited login will be connected later to a user table/auth provider.</p>
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
                    <td className="px-5 py-4 text-slate-700">{user.status}</td>
                    <td className="px-5 py-4">
                      {user.email === "Hidden in Vercel" ? <span className="text-xs font-semibold text-slate-400">Protected</span> : <button type="button" onClick={() => removeUser(user.email)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={addUser} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Add Secondary User</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Create a staff profile and assign a role. This prepares limited access setup for the next authentication step.</p>
          <div className="mt-5 space-y-4">
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Full Name</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Staff name" /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Email</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@email.com" /></label>
            <label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Role</span><select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as RoleName)}><option>Cashier</option><option>Inventory Staff</option><option>Viewer / Auditor</option><option>Admin</option></select></label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-950">Selected Role Access</p><p className="mt-1 text-sm leading-6 text-slate-600">{selectedRole.description}</p><div className="mt-3 flex flex-wrap gap-2">{selectedRole.pages.map((page) => <span key={page} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{page}</span>)}</div></div>
            <button type="submit" className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">Add User Profile</button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Role Access Matrix</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-4 font-semibold">Role</th><th className="px-5 py-4 font-semibold">Access Level</th><th className="px-5 py-4 font-semibold">Allowed Pages</th></tr></thead>
            <tbody>
              {(Object.keys(roleAccess) as RoleName[]).map((item) => (
                <tr key={item} className="border-t border-slate-100 align-top"><td className="px-5 py-4"><RoleBadge role={item} /></td><td className="px-5 py-4 font-semibold text-slate-700">{roleAccess[item].access}<p className="mt-1 text-sm font-normal leading-6 text-slate-500">{roleAccess[item].description}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{roleAccess[item].pages.map((page) => <span key={page} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{page}</span>)}</div></td></tr>
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
