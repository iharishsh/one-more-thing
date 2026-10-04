import { createChangeRequest } from "@/features/changes/change.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(request: Request) {
  try {
    const user = await requireFreelancer();
    const body = await request.json();
    const change = await createChangeRequest(user.id, body);
    return jsonOk({ change }, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
