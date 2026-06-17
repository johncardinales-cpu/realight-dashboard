"use client";

export default function ReportPrintHelper() {
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-xl print:hidden"
      >
        Print Report / Save PDF
      </button>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            font-size: 10px !important;
          }

          nav,
          aside,
          header,
          form,
          button,
          input,
          select,
          .fixed,
          .print\:hidden {
            display: none !important;
          }

          main,
          section {
            margin: 0 !important;
            padding: 0 !important;
          }

          section.space-y-6::before {
            content: "Realights Solar Operations Report";
            display: block;
            margin-bottom: 4px;
            font-size: 24px;
            line-height: 1.1;
            font-weight: 900;
            color: #0f172a;
          }

          section.space-y-6::after {
            content: "Prepared By ________________________________    Reviewed / Approved By ________________________________";
            display: block;
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1px solid #94a3b8;
            font-size: 10px;
            color: #334155;
          }

          .rounded-3xl,
          .rounded-2xl,
          .rounded-xl {
            border-radius: 10px !important;
          }

          .shadow-sm,
          .shadow-xl {
            box-shadow: none !important;
          }

          .border,
          .border-slate-200 {
            border-color: #cbd5e1 !important;
          }

          .bg-white {
            background: #ffffff !important;
          }

          .bg-slate-50 {
            background: #f1f5f9 !important;
          }

          .p-6 {
            padding: 12px !important;
          }

          .p-5 {
            padding: 10px !important;
          }

          .space-y-6 > * + * {
            margin-top: 10px !important;
          }

          .grid {
            gap: 8px !important;
          }

          .xl\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .xl\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          h1 {
            font-size: 22px !important;
            line-height: 1.1 !important;
          }

          h2 {
            font-size: 15px !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          thead {
            display: table-header-group;
            background: #f1f5f9 !important;
          }

          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          th,
          td {
            padding: 5px 7px !important;
            border-top: 1px solid #e2e8f0 !important;
            vertical-align: top;
          }

          .overflow-x-auto,
          .overflow-auto,
          .max-h-72 {
            max-height: none !important;
            overflow: visible !important;
          }

          .report-section,
          .rounded-3xl,
          .rounded-2xl {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
