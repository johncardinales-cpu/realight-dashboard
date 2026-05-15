const roles = [
  {
    role: "Admin",
    access: "Full access",
    description: "Can access dashboard, sales, payments, inventory, reports, migration, settings, and testing reset.",
  },
  {
    role: "Cashier",
    access: "Future role",
    description: "Recommended future role for creating sales, recording payments, and viewing limited reports.",
  },
  {
    role: "Inventory Staff",
    access: "Future role",
    description: "Recommended future role for deliveries, inventory review, and stock receiving updates.",
  },
  {
    role: "Viewer / Auditor",
    access: "Future role",
    description: "Recommended future role for reports, activity log, and read-only audit review.",
  },
];

const checklist = [
  "Current login uses REALIGHTS_ADMIN_EMAIL and REALIGHTS_ACCESS_CODE from Vercel environment variables.",
  "The access code is not displayed in the app for security.",
  "Logout is available in the top bar.",
  "Future database upgrade should move users into a Users table with roles and permissions.",
];

export default function UsersPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Access Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Users</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manage how staff access the Realights POS. The current trial build uses a secure admin login through Vercel environment variables. Full multi-user roles are prepared as a future database feature.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Current Access Mode</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">Admin Login</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Email plus private access code. Best for controlled trial and training.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Session</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">12 hours</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Users can logout manually from the top bar.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Recommended Upgrade</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">Role-Based Users</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">When migrated to Supabase/Postgres, add real user accounts and permissions.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Current Admin User</h2>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-950">Configured Admin</p>
              <p className="mt-1 text-sm text-slate-600">Uses REALIGHTS_ADMIN_EMAIL from Vercel. The actual value is intentionally not exposed here.</p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Active</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Role Plan</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Access</th>
                <th className="px-5 py-4 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((item) => (
                <tr key={item.role} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-bold text-slate-950">{item.role}</td>
                  <td className="px-5 py-4 text-slate-700">{item.access}</td>
                  <td className="px-5 py-4 leading-6 text-slate-600">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Access Checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <span className="mr-2 font-bold text-emerald-600">✓</span>{item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
