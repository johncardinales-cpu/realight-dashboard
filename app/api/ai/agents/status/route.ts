import { NextResponse } from "next/server";
import { getAgentStatusPayload } from "@/lib/ai/agents/agentRegistry";

export async function GET() {
  return NextResponse.json(getAgentStatusPayload());
}
