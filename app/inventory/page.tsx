export default function InventoryPage() {
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

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track incoming, received, on-hand, and sellable stock.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Inventory List</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
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
                  <td className="px-4 py-3 font-medium">{row.description}</td>
                  <td className="px-4 py-3 text-slate-600">{row.specification}</td>
                  <td className="px-4 py-3">{row.incoming}</td>
                  <td className="px-4 py-3">{row.received}</td>
                  <td className="px-4 py-3">{row.onHand}</td>
                  <td className="px-4 py-3">{row.buffer}</td>
                  <td className="px-4 py-3 font-medium text-emerald-600">{row.sellable}</td>
                  <td className="px-4 py-3">{row.latestArrival}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
