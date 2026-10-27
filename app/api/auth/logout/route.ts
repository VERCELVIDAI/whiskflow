import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { authMode } from "@/lib/auth";
import { clearLocalSession } from "@/lib/auth/local";
import { createSupabaseServerClient } from "@/lib/auth/supabase";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (authMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } else {
      await clearLocalSession();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
