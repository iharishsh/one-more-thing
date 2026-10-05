import { startPrepareChange } from "@/features/agent/agent.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const result = await startPrepareChange(changeId, user.id);
    return jsonOk({
      runId: result.run.id,
      status: result.run.status,
      alreadyActive: result.alreadyActive,
      inviteToken: result.thread.inviteToken,
    });
  } catch (error) {
    return jsonError(error);
  }
}
