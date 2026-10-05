import { reanalyzeChange } from "@/features/changes/change.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const result = await reanalyzeChange(changeId, user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
