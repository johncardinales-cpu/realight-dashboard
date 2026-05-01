import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    const { messages, fileContext, fileName } = (await request.json()) as {
      messages?: ChatMessage[];
      fileContext?: string;
      fileName?: string;
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

    const systemPrompt = [
      "You are Reallights AI, a concise business assistant built into the Realights/Reallights Solar operations dashboard.",
      "Help users understand inventory, incoming deliveries, sales, expenses, reports, and uploaded business files.",
      "Be practical, direct, and action-oriented. If data is missing, say exactly what is missing.",
      "Do not claim you changed Google Sheets or the database unless a tool explicitly did it.",
    ].join("\n");

    const input = [
      { role: "system", content: systemPrompt },
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
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input,
        temperature: 0.3,
        max_output_tokens: 900,
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
