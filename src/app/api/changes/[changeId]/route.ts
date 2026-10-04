import {
  deleteChangeRequest,
  revokeChangeRequest,
} from "@/features/changes/change.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const result = await deleteChangeRequest(changeId, user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ changeId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { changeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "revoke") {
      return jsonError(new Error("Unsupported action"), 400);
    }
    const result = await revokeChangeRequest(changeId, user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
