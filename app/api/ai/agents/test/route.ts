import { NextResponse } from "next/server";
import { createAgentTestResponse, getAgentById } from "@/lib/ai/agents/agentRegistry";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const agentId = String(body?.agentId || "pos-assistant");
    const prompt = String(body?.prompt || "");

    if (!getAgentById(agentId)) {
      return NextResponse.json({ error: "Unknown agent", agentId }, { status: 404 });
    }

    return NextResponse.json(createAgentTestResponse(agentId, prompt));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to test agent" }, { status: 500 });
  }
}
