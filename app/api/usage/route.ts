import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { getUsage } from "@/lib/data/credits";

export async function GET() {
  try {
    const user = await requireApiUser();
    const usage = await getUsage(user.id);
    return Response.json(usage);
  } catch (error) {
    return errorResponse(error);
  }
}
