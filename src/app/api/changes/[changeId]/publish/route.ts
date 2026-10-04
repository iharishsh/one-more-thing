import { publishProposal } from "@/features/proposals/proposal.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const body = await request.json();
    const proposal = await publishProposal(changeId, user.id, body);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return jsonOk({
      proposal,
      clientUrl: `${appUrl}/proposal/${proposal.clientToken}`,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
