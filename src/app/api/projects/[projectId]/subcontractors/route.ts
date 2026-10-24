import {
  addSubcontractor,
  removeSubcontractor,
} from "@/features/billing/payouts.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

type Ctx = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireFreelancer();
    const { projectId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return jsonOk(await addSubcontractor(projectId, user.id, body));
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const user = await requireFreelancer();
    const { projectId } = await context.params;
    const id = new URL(request.url).searchParams.get("id") ?? "";
    return jsonOk(await removeSubcontractor(projectId, user.id, id));
  } catch (error) {
    return jsonError(error, 400);
  }
}
