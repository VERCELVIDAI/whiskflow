import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { promptAssistantSchema } from "@/lib/validation";
import { runPromptAssistant } from "@/lib/prompt-assistant";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `prompt:${user.id}`, limit: 30, windowMs: 60_000 });
    const input = promptAssistantSchema.parse(await readJson(request));
    const result = await runPromptAssistant(input);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
