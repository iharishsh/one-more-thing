import { ensureIntakeToken } from "@/features/intake/intake.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireFreelancer();
    const { projectId } = await context.params;
    return jsonOk({ token: await ensureIntakeToken(projectId, user.id) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
