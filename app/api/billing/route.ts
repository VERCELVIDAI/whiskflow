import { json } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { getBillingSummary } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const summary = await getBillingSummary(user.id);
    return json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
