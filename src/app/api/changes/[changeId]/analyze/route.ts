import { updateChangeAnalysis } from "@/features/changes/change.service";
import { analysisSchema } from "@/features/changes/analysis.schema";
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
    const analysis = analysisSchema.parse(body.analysis ?? body);
    const change = await updateChangeAnalysis(changeId, user.id, analysis);
    return jsonOk({ change });
  } catch (error) {
    return jsonError(error, 400);
  }
}
