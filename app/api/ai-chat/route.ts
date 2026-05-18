import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ImportMode = "general" | "receipt" | "product" | "inventory" | "supplier" | "customer";

export async function POST(request: Request) {
  try {
    const { messages, fileContext, fileName, importMode } = (await request.json()) as {
      messages?: ChatMessage[];
      fileContext?: string;
      fileName?: string;
      importMode?: ImportMode;
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured yet. Add it in Vercel Project Settings > Environment Variables, then redeploy.",
        },
        { status: 500 }
      );
    }

    const safeMessages = Array.isArray(messages) ? messages.slice(-12) : [];
    const mode = importMode || "general";

    const systemPrompt = [
      "You are Reallights AI, a premium reasoning assistant built into the Realights/Reallights Solar operations dashboard.",
      "Use careful step-by-step analysis internally, but reply with clear final answers only.",
      "Help users understand inventory, incoming deliveries, pricing, customers, sales, payments, expenses, reports, and uploaded business files.",
      "Be practical, direct, and action-oriented. If data is missing, say exactly what is missing and what the user should upload or enter next.",
      "When analyzing files, call out totals, anomalies, risks, duplicates, missing columns, and recommended next actions.",
      "Do not claim you changed Google Sheets or the database unless a real API/tool explicitly did it.",
      "Never auto-save uploaded records. Always prepare a preview and say user confirmation is required before import.",
      "Template names and target modules:",
      "- product / pricing upload = Pricing_Product_Master template -> Pricing_Base.",
      "- inventory / delivery upload = Incoming_Deliveries template -> Incoming Deliveries/App_Deliveries.",
      "- receipt = any uploaded receipt/image/PDF/text/CSV should be treated as an expense receipt -> Expenses preview.",
      "- expense upload = Expense_Receipt_Upload template -> Expenses.",
      "- supplier/invoice upload = Supplier_Invoice_Costs template -> Supplier_Invoice_Costs and/or Expenses.",
      "- customer upload = Customers template -> Customers.",
      "- sales/payment upload = migration/backfill only; warn user before using for daily operations.",
      "Receipt rule: if mode is receipt or the user typed 'receipt', classify the upload as an expense receipt. Extract or request: Expense Date, Category, Description, Amount, Payment Method, Reference No., Related Sales Ref No. if connected to a sale, Payee/Vendor, Notes, Receipt File Name.",
      "For receipts, use simple categories: Bank Fees, Payment Processing Fees, Delivery / Logistics Expense, Fuel / Transportation, Installation Labor, Tools and Equipment, Office Supplies, Utilities, Rent, Repairs and Maintenance, Marketing, Taxes and Permits, Staff Allowance, Professional Fees, Miscellaneous.",
      "For product files, required columns are Item ID, Description, Specification, Category, Unit, Cost Price USD, FX Rate, Cost Price PHP, Selling Price PHP, Dealer Price PHP, Minimum Price PHP, Gross Margin, Status, Notes.",
      "For inventory files, required columns are Supplier, Batch / Reference, Description, Specification, Qty, Status, Expected Date, Received Date, Unit Cost PHP, Notes.",
      "For customer files, required columns are Customer ID, Customer Name, Contact Person, Phone, Email, Address, Customer Type, Status, Notes.",
      "For record search requests, help locate records conceptually across Customers, Sales, Payments, Expenses, Pricing, Inventory, Incoming Deliveries, and Audit_Log. If live search is unavailable in this chat route, tell the user what page to open and what field to search.",
    ].join("\n");

    const input = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Current AI import/search mode: ${mode}.` },
      fileContext
        ? {
            role: "user",
            content: `Attached file context${fileName ? ` from ${fileName}` : ""}:\n\n${fileContext.slice(0, 12000)}`,
          }
        : null,
      ...safeMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ].filter(Boolean);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4",
        input,
        reasoning: {
          effort: (process.env.OPENAI_REASONING_EFFORT || "xhigh") as "none" | "low" | "medium" | "high" | "xhigh",
        },
        text: {
          verbosity: "medium",
        },
        max_output_tokens: 1800,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || "The AI service returned an error." },
        { status: response.status }
      );
    }

    const reply =
      result.output_text ||
      result.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || [])
        ?.map((content: { text?: string }) => content.text)
        ?.filter(Boolean)
        ?.join("\n") ||
      "I could not generate a response.";

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while processing the AI chat request.",
      },
      { status: 500 }
    );
  }
}
