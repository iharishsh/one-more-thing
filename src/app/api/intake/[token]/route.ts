import { submitClientRequest } from "@/features/intake/intake.service";
import { jsonError, jsonOk } from "@/server/http";

/** Public: a client sends a request through the project's request link. */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    return jsonOk(await submitClientRequest(token, body));
  } catch (error) {
    return jsonError(error, 400);
  }
}
