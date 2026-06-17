"use client";

const peso = "₱";

function cleanText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeCsv(value: string) {
  return `"${cleanText(value).replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function reportRoot() {
  return document.querySelector("section.space-y-6") || document.body;
}

function reportTitle() {
  const root = reportRoot();
  const reportLine = Array.from(root.querySelectorAll("p"))
    .map((node) => cleanText(node.textContent))
    .find((text) => /Report:/i.test(text));
  return reportLine || "Operations Report";
}

function fileBaseName() {
  return `realights-${reportTitle().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${fileStamp()}`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function summaryRows() {
  const root = reportRoot();
  return Array.from(root.querySelectorAll("p.text-2xl"))
    .map((amountNode) => {
      const card = amountNode.parentElement;
      const label = cleanText(card?.querySelector("p.text-sm")?.textContent);
      const amount = cleanText(amountNode.textContent);
      const helper = cleanText(card?.querySelector("p.text-xs")?.textContent);
      return label && amount ? [label, amount, helper] : null;
    })
    .filter(Boolean) as string[][];
}

function tableTitle(table: HTMLTableElement, index: number) {
  let node: HTMLElement | null = table.parentElement;
  while (node && node !== document.body) {
    const heading = node.querySelector("h2");
    if (heading) return cleanText(heading.textContent) || `Table ${index}`;
    node = node.parentElement;
  }
  return `Table ${index}`;
}

function tables() {
  const root = reportRoot();
  return Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
}

function tableRows(table: HTMLTableElement) {
  return Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => cleanText(cell.textContent)));
}

function exportCsv() {
  const lines: string[] = [];
  lines.push(["Realights Solar", reportTitle()].map(escapeCsv).join(","));
  lines.push(["Generated", new Date().toLocaleString("en-PH")].map(escapeCsv).join(","));
  lines.push("");
  lines.push("Summary");
  lines.push(["Metric", "Amount", "Notes"].map(escapeCsv).join(","));
  summaryRows().forEach((row) => lines.push(row.map(escapeCsv).join(",")));
  tables().forEach((table, index) => {
    lines.push("");
    lines.push(tableTitle(table, index + 1));
    tableRows(table).forEach((row) => lines.push(row.map(escapeCsv).join(",")));
  });
  downloadFile(`${fileBaseName()}.csv`, `\ufeff${lines.join("\n")}`, "text/csv;charset=utf-8");
}

function exportExcel() {
  const tableHtml = tables().map((table, index) => {
    const rows = tableRows(table).map((row, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
    }).join("");
    return `<h2>${escapeHtml(tableTitle(table, index + 1))}</h2><table>${rows}</table>`;
  }).join("");

  const summaryHtml = summaryRows().map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2] || "")}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#0f172a}h1{font-size:24px;margin-bottom:4px}h2{font-size:16px;margin-top:22px;background:#eef2f7;padding:8px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#f1f5f9;font-weight:700}.right{text-align:right}.meta{color:#475569;font-size:12px;margin-bottom:14px}</style></head><body><h1>Realights Solar Operations Report</h1><div class="meta">${escapeHtml(reportTitle())}<br>Generated: ${escapeHtml(new Date().toLocaleString("en-PH"))}</div><h2>Executive Summary</h2><table><tr><th>Metric</th><th>Amount</th><th>Notes</th></tr>${summaryHtml}</table>${tableHtml}<br><br><table><tr><td>Prepared By</td><td>Reviewed / Approved By</td></tr><tr><td style="height:40px"></td><td></td></tr></table></body></html>`;
  downloadFile(`${fileBaseName()}.xls`, `\ufeff${html}`, "application/vnd.ms-excel;charset=utf-8");
}

export default function ReportPrintHelper() {
  return (
    <>
      <div className="report-export-toolbar fixed bottom-6 right-6 z-50 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">PDF</button>
        <button type="button" onClick={exportExcel} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Excel</button>
        <button type="button" onClick={exportCsv} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">CSV</button>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { background: #ffffff !important; color: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-size: 10px !important; }
          nav, aside, header, form, button, input, select, .fixed, .report-export-toolbar { display: none !important; }
          main, section { margin: 0 !important; padding: 0 !important; }
          section.space-y-6::before { content: "Realights Solar Operations Report"; display: block; margin-bottom: 4px; font-size: 24px; line-height: 1.1; font-weight: 900; color: #0f172a; }
          section.space-y-6::after { content: "Prepared By ________________________________    Reviewed / Approved By ________________________________"; display: block; margin-top: 18px; padding-top: 12px; border-top: 1px solid #94a3b8; font-size: 10px; color: #334155; }
          .rounded-3xl, .rounded-2xl, .rounded-xl { border-radius: 10px !important; }
          .shadow-sm, .shadow-xl { box-shadow: none !important; }
          .border, .border-slate-200 { border-color: #cbd5e1 !important; }
          .bg-white { background: #ffffff !important; }
          .bg-slate-50 { background: #f1f5f9 !important; }
          .p-6 { padding: 12px !important; }
          .p-5 { padding: 10px !important; }
          .space-y-6 > * + * { margin-top: 10px !important; }
          .grid { gap: 8px !important; }
          .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .xl\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          h1 { font-size: 22px !important; line-height: 1.1 !important; }
          h2 { font-size: 15px !important; }
          table { width: 100% !important; border-collapse: collapse !important; page-break-inside: auto; }
          thead { display: table-header-group; background: #f1f5f9 !important; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          th, td { padding: 5px 7px !important; border-top: 1px solid #e2e8f0 !important; vertical-align: top; }
          .overflow-x-auto, .overflow-auto, .max-h-72 { max-height: none !important; overflow: visible !important; }
          .report-section, .rounded-3xl, .rounded-2xl { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
