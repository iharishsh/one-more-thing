import {
  getBillingPanel,
  planNextBillingAction,
} from "@/features/billing/billing-agent.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { proposalId } = await context.params;
    return jsonOk(await getBillingPanel(proposalId, user.id));
  } catch (error) {
    return jsonError(error, 400);
  }
}

/** Ask the billing agent for its next proposed PayPal action. Nothing runs until approved. */
export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { proposalId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await planNextBillingAction(proposalId, user.id, {
      clientEmail:
        typeof body.clientEmail === "string" ? body.clientEmail : undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
