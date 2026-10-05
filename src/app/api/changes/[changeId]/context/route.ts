import { addDiscussionContext } from "@/features/changes/change.service";
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
    const result = await addDiscussionContext(changeId, user.id, body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
