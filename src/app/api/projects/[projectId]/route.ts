import { updateProject } from "@/features/projects/project.service";
import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const user = await requireFreelancer();
    const body = await request.json();
    const project = await updateProject(projectId, user.id, body);
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error, 400);
  }
}
