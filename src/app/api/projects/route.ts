import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";
import {
  createProject,
  listProjectsForOwner,
} from "@/features/projects/project.service";

export async function GET() {
  try {
    const user = await requireFreelancer();
    const projects = await listProjectsForOwner(user.id);
    return jsonOk({ projects });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFreelancer();
    const body = await request.json();
    const project = await createProject(user.id, body);
    return jsonOk({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
