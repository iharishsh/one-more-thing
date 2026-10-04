import { NextResponse } from "next/server";
import { recordClientResponse } from "@/features/proposals/proposal.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = await request.json();
    const result = await recordClientResponse(token, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
