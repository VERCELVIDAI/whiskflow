import "server-only";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { mapProfile } from "@/lib/data/mappers";
import { AppError, UnauthorizedError } from "@/lib/errors";
import type { AppUser, AuthMode } from "@/lib/types";
import { isSupabaseAuthConfigured, createSupabaseServerClient } from "@/lib/auth/supabase";
import { getLocalSessionUser } from "@/lib/auth/local";

export function authMode(): AuthMode {
  return isSupabaseAuthConfigured() ? "supabase" : "local";
}

async function syncSupabaseProfile(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<AppUser | null> {
  const db = await getDatabase();
  const email = (user.email || "").toLowerCase();
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : email.split("@")[0] || "Creator";

  await db.query(
    `INSERT INTO profiles (id, email, full_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [user.id, email, fullName],
  );
  const rows = await db.query(`SELECT * FROM profiles WHERE id = $1 LIMIT 1`, [user.id]);
  if (rows.length === 0) return null;
  const profile = mapProfile(rows[0]);
  return { ...profile, authMode: "supabase" };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return syncSupabaseProfile(user);
  }
  return getLocalSessionUser();
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireSameUser(userId: string): Promise<AppUser> {
  const user = await requireApiUser();
  if (user.id !== userId) throw new AppError(403, "forbidden", "You cannot access this resource.");
  return user;
}

export async function updateProfileForUser(
  user: AppUser,
  input: { fullName: string },
): Promise<AppUser> {
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE profiles SET full_name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [input.fullName, user.id],
  );
  if (rows.length === 0) throw new AppError(404, "not_found", "Profile not found.");
  if (user.authMode === "supabase") {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.updateUser({ data: { full_name: input.fullName } });
    } catch {
      // The profile table is authoritative for display names.
    }
  }
  return { ...mapProfile(rows[0]), authMode: user.authMode };
}

export { isSupabaseAuthConfigured };
