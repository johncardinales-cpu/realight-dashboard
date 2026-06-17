"use client";

function cleanText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function asciiText(value: string | null | undefined) {
  return cleanText(value)
    .replace(/₱/g, "PHP ")
    .replace(/→/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
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

function downloadBlob(name: string, content: BlobPart[], type: string) {
  const blob = new Blob(content, { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadFile(name: string, content: string, type: string) {
  downloadBlob(name, [content], type);
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

function sheetName(raw: string, used: Set<string>) {
  const base = cleanText(raw).replace(/[\\/?*\[\]:]/g, " ").slice(0, 28) || "Sheet";
  let name = base;
  let index = 1;
  while (used.has(name)) {
    name = `${base.slice(0, 24)} ${index}`.slice(0, 31);
    index += 1;
  }
  used.add(name);
  return name;
}

async function exportExcel() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Realights Solar Operations Report"],
    [reportTitle()],
    ["Generated", new Date().toLocaleString("en-PH")],
    [],
    ["Metric", "Amount", "Notes"],
    ...summaryRows(),
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, sheetName("Executive Summary", used));
  tables().forEach((table, index) => {
    const rows = tableRows(table);
    if (rows.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName(tableTitle(table, index + 1), used));
    }
  });
  XLSX.writeFile(workbook, `${fileBaseName()}.xlsx`);
}

function pdfEscape(value: string) {
  return asciiText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, maxChars: number) {
  const words = asciiText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function buildPdf() {
  const width = 841.89;
  const height = 595.28;
  const margin = 34;
  const usable = width - margin * 2;
  let y = height - margin;
  const pages: string[][] = [[]];
  const page = () => pages[pages.length - 1];

  const add = (cmd: string) => page().push(cmd);
  const text = (value: string, x: number, yy: number, size = 8, bold = false) => add(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${pdfEscape(value)}) Tj ET`);
  const line = (x1: number, y1: number, x2: number, y2: number) => add(`0.73 0.78 0.86 RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  const rect = (x: number, yy: number, w: number, h: number, fill = false) => add(`${fill ? "0.94 0.96 0.98 rg " : ""}0.82 0.86 0.92 RG ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill ? "B" : "S"}`);

  const newPage = () => { pages.push([]); y = height - margin; };
  const ensure = (needed: number) => { if (y - needed < margin) newPage(); };

  text("REALIGHTS SOLAR", margin, y, 10, true);
  text("Operations Report", margin, y - 18, 20, true);
  text(reportTitle(), margin, y - 34, 10);
  text(`Generated: ${new Date().toLocaleString("en-PH")}`, width - 240, y - 8, 9);
  y -= 54;
  line(margin, y, width - margin, y);
  y -= 16;

  const drawHeading = (title: string) => { ensure(28); text(title, margin, y, 12, true); y -= 16; };

  const drawTable = (title: string, rows: string[][]) => {
    if (!rows.length) return;
    drawHeading(title);
    const colCount = Math.max(...rows.map((row) => row.length));
    const colW = usable / colCount;
    const font = colCount > 8 ? 5.6 : colCount > 6 ? 6.5 : 7.5;
    const lineH = font + 2.2;
    const drawRow = (row: string[], isHeader: boolean) => {
      const wrapped = Array.from({ length: colCount }).map((_, index) => wrapText(row[index] || "", Math.max(6, Math.floor((colW - 8) / (font * 0.48)))));
      const rowH = Math.max(17, Math.max(...wrapped.map((lines) => lines.length)) * lineH + 8);
      ensure(rowH + (isHeader ? 0 : 18));
      if (isHeader) rect(margin, y - rowH, usable, rowH, true);
      let x = margin;
      wrapped.forEach((lines) => {
        rect(x, y - rowH, colW, rowH, false);
        lines.slice(0, 7).forEach((txt, i) => text(txt, x + 4, y - 10 - i * lineH, font, isHeader));
        x += colW;
      });
      y -= rowH;
    };
    drawRow(rows[0], true);
    rows.slice(1).forEach((row) => drawRow(row, false));
    y -= 10;
  };

  drawTable("Executive Summary", [["Metric", "Amount", "Notes"], ...summaryRows()]);
  tables().forEach((table, index) => drawTable(tableTitle(table, index + 1), tableRows(table)));

  ensure(40);
  y -= 20;
  line(margin, y, margin + 250, y);
  line(width - margin - 250, y, width - margin, y);
  text("Prepared By", margin + 88, y - 14, 8);
  text("Reviewed / Approved By", width - margin - 180, y - 14, 8);

  const font1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const font2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const objects: string[] = [];
  const kids: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push(font1);
  objects.push(font2);
  pages.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const stream = content.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function exportPdf() {
  downloadBlob(`${fileBaseName()}.pdf`, [buildPdf()], "application/pdf");
}

export default function ReportPrintHelper() {
  return (
    <>
      <div className="report-export-toolbar fixed bottom-6 right-6 z-50 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl print:hidden">
        <button type="button" onClick={exportPdf} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">PDF</button>
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
          .overflow-x-auto, .overflow-auto, .max-h-72 { max-height: none !important; overflow: visible !important; }
        }
      `}</style>
    </>
  );
}
