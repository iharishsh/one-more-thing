import { retryFailedPayouts } from "@/features/billing/payouts.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

/** Re-draft failed payouts for approval (e.g. after fixing a PayPal email). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { proposalId } = await context.params;
    const drafted = await retryFailedPayouts(proposalId, user.id);
    return jsonOk({ drafted: drafted.length });
  } catch (error) {
    return jsonError(error, 400);
  }
}
