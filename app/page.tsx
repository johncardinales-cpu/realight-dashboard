export default function HomePage() {
  const kpis = [
    { title: "Incoming Units", value: "1,240", note: "Purchased, not yet received" },
    { title: "Warehouse Received", value: "980", note: "Already received" },
    { title: "Actual On Hand", value: "910", note: "Received less sold" },
    { title: "Sellable Units", value: "860", note: "After minimum buffer" },
    { title: "Today Sales", value: "₱42,500", note: "Today only" },
    { title: "This Month Sales", value: "₱1.28M", note: "Current month" },
    { title: "Total Expenses", value: "₱745,000", note: "Freight, taxes, labor, etc." },
    { title: "Net Gain", value: "₱535,000", note: "Sales minus expenses" },
  ];

  const inventory = [
    {
      description: "Solar Panel 610W",
      specification: "BSM610M10-72HNH",
      incoming: 180,
      received: 120,
      onHand: 300,
      buffer: 20,
      sellable: 280,
      latestArrival: "2026-04-17",
    },
    {
      description: "11KW Hybrid Inverter",
      specification: "BSM-11000LV-48",
      incoming: 5,
      received: 15,
      onHand: 20,
      buffer: 2,
      sellable: 18,
      latestArrival: "2026-04-17",
    },
    {
      description: "16KWh HV Lithium Battery",
      specification: "BSM48314H",
      incoming: 8,
      received: 10,
      onHand: 18,
      buffer: 3,
      sellable: 15,
      latestArrival: "2026-04-17",
    },
  ];

  const deliveries = [
    { batch: "DEL-20260416-01", supplier: "BLUESUN", eta: "2026-04-17", status: "Pending arrival" },
    { batch: "DEL-20260420-02", supplier: "BLUESUN", eta: "2026-04-22", status: "Uploaded" },
    { batch: "DEL-20260424-03", supplier: "BLUESUN", eta: "2026-04-28", status: "In transit" },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Dashboard Overview</h1>
            <p className="mt-1 text-sm text-slate-700">
              Inventory, deliveries, sales, expenses, and reporting overview.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Export Report
            </button>
            <button className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Add Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">{item.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Inventory Snapshot</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {[
                    "Description",
                    "Specification",
                    "Incoming",
                    "Received",
                    "On Hand",
                    "Min Buffer",
                    "Sellable",
                    "Latest Arrival",
                  ].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-medium">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.specification} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.description}</td>
                    <td className="px-4 py-3 text-slate-700">{row.specification}</td>
                    <td className="px-4 py-3 text-slate-700">{row.incoming}</td>
                    <td className="px-4 py-3 text-slate-700">{row.received}</td>
                    <td className="px-4 py-3 text-slate-700">{row.onHand}</td>
                    <td className="px-4 py-3 text-slate-700">{row.buffer}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{row.sellable}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestArrival}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Incoming Deliveries</h2>
            <div className="space-y-3">
              {deliveries.map((item) => (
                <div key={item.batch} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{item.batch}</p>
                  <p className="text-sm text-slate-700">
                    {item.supplier} · ETA {item.eta}
                  </p>
                  <p className="mt-2 text-sm font-medium text-emerald-600">{item.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Reports</h2>
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">Daily Report</div>
              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">Weekly Report</div>
              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">Monthly Report</div>
              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">Monthly Records</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
