import { getDatabase } from "@/lib/db";
import { authMode } from "@/lib/auth";
import { storageMode } from "@/lib/storage";

export async function GET() {
  try {
    const db = await getDatabase();
    await db.query("SELECT 1");
    return Response.json({
      ok: true,
      authMode: authMode(),
      storageMode: storageMode(),
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
