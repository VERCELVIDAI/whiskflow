import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const databaseUrl = process.env.DATABASE_URL;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "whisk-media";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const failures: string[] = [];

function check(ok: boolean, label: string, detail = ""): void {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function main(): Promise<void> {
  console.log("Whisk Flow — Supabase connection check\n");

  check(Boolean(url), "NEXT_PUBLIC_SUPABASE_URL");
  check(Boolean(publishableKey), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  check(Boolean(secretKey), "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  check(Boolean(databaseUrl), "DATABASE_URL");
  check(
    appUrl.startsWith("http://") || appUrl.startsWith("https://"),
    "NEXT_PUBLIC_APP_URL",
    appUrl,
  );

  if (url && publishableKey) {
    try {
      const response = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      check(response.ok, "Supabase Auth endpoint", `HTTP ${response.status}`);
    } catch (error) {
      check(false, "Supabase Auth endpoint", error instanceof Error ? error.message : String(error));
    }
  }

  if (databaseUrl) {
    const sql = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      prepare: false,
      onnotice: () => undefined,
    });
    try {
      const tables = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('profiles', 'projects', 'assets', 'scenes', 'generation_jobs')
        ORDER BY table_name
      `;
      const found = new Set(tables.map((row) => row.table_name));
      const required = ["profiles", "projects", "assets", "scenes", "generation_jobs"];
      const missing = required.filter((table) => !found.has(table));
      check(
        missing.length === 0,
        "Whisk Flow tables",
        missing.length ? `missing ${missing.join(", ")}` : "all present",
      );

      const profiles = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM public.profiles
      `;
      check(true, "profiles table is queryable", `${profiles[0]?.count ?? "0"} row(s)`);
    } catch (error) {
      check(false, "Postgres connection", error instanceof Error ? error.message : String(error));
    } finally {
      await sql.end({ timeout: 2 }).catch(() => undefined);
    }
  }

  if (url && secretKey) {
    try {
      const admin = createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await admin.storage.getBucket(bucket);
      check(
        !error && Boolean(data) && data?.public === false,
        `Private storage bucket "${bucket}"`,
        error?.message ?? (data?.public === false ? "private" : "public bucket — make it private"),
      );
    } catch (error) {
      check(false, "Storage bucket", error instanceof Error ? error.message : String(error));
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed. Fix the values above and run the check again.`);
    process.exitCode = 1;
  } else {
    console.log("Supabase looks ready. Restart the app and test register, login and password reset.");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
