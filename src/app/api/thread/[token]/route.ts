import {
  getClientThreadByToken,
  submitClientAnswer,
} from "@/features/agent/agent.service";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const view = await getClientThreadByToken(token);
    if (view.state === "missing") {
      return jsonError(new Error("Thread not found"), 404);
    }
    return jsonOk(view);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await submitClientAnswer(token, body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
