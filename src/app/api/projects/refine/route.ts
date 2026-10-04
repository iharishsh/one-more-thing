import { refineProjectDraftSchema } from "@/features/projects/project.schema";
import { requireFreelancer } from "@/server/auth";
import { runProjectRefine } from "@/server/ai/refine-project";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(request: Request) {
  try {
    await requireFreelancer();
    const body = refineProjectDraftSchema.parse(await request.json());
    const draft = await runProjectRefine(body);
    return jsonOk({ draft });
  } catch (error) {
    return jsonError(error, 400);
  }
}
