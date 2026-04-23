import Link from "next/link";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Inventory", href: "/inventory" },
  { label: "Incoming Deliveries", href: "/incoming-deliveries" },
  { label: "Sales", href: "/sales" },
  { label: "Expenses", href: "/expenses" },
  { label: "Reports", href: "/reports" },
  { label: "Users", href: "/users" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="border-r border-slate-800 bg-slate-950 text-white">
      <div className="border-b border-white/10 p-6">
        <h1 className="text-2xl font-semibold">Realight</h1>
        <p className="text-sm text-slate-400">Corporation Report</p>
      </div>

      <nav className="space-y-1 p-4 text-sm">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-2xl px-4 py-3 text-slate-300 hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
