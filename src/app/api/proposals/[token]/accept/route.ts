import { acceptProposal } from "@/features/proposals/proposal.service";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await acceptProposal(token, body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
