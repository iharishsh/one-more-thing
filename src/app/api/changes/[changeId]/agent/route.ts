import {
  approveClarification,
  getAgentStateForOwner,
  revokeThreadInvite,
} from "@/features/agent/agent.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const state = await getAgentStateForOwner(changeId, user.id);
    return jsonOk(state);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      editedQuestion?: string;
    };

    if (body.action === "approve_clarification") {
      const result = await approveClarification(changeId, user.id, body);
      return jsonOk(result);
    }
    if (body.action === "revoke_invite") {
      const result = await revokeThreadInvite(changeId, user.id);
      return jsonOk(result);
    }

    return jsonError(new Error("Unknown action"), 400);
  } catch (error) {
    return jsonError(error);
  }
}
