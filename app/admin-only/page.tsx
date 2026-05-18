export default function AdminOnlyPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
      <div className="rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-3xl font-black text-amber-600">!</div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This page is restricted because it can affect system setup, user access, testing resets, migration, or business configuration.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Use an authorized admin login to open this section. Regular operations can continue from Dashboard, Sales, Payments, Expenses, Inventory, Customers, and Reports.
        </p>
      </div>
    </section>
  );
}
