import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { getJobWithAssets } from "@/lib/data/jobs";
import { pollGenerationJob } from "@/lib/generation/service";

export const maxDuration = 300;
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const current = await getJobWithAssets(user.id, id);
    if (current.job.status !== "running" && current.job.status !== "queued") {
      return Response.json(current);
    }
    if (!current.job.providerJobId) {
      return Response.json(current);
    }
    const result = await pollGenerationJob(user.id, id);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
