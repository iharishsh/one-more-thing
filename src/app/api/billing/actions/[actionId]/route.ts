import {
  decideBillingAction,
  planNextBillingAction,
} from "@/features/billing/billing-agent.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ actionId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { actionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body.decision !== "approve" && body.decision !== "reject") {
      throw new Error("decision must be approve or reject");
    }
    const result = await decideBillingAction(actionId, user.id, body.decision);
    // Keep going: draft the next step right away so it's waiting for approval.
    let next = null;
    if (result.status === "executed" && result.proposalId) {
      next = await planNextBillingAction(result.proposalId, user.id, {}).catch(
        () => null,
      );
    }
    return jsonOk({ ...result, next });
  } catch (error) {
    return jsonError(error, 400);
  }
}
