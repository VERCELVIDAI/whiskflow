import path from "node:path";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

async function main(): Promise<void> {
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is missing. Add the direct Postgres connection string to .env.local first.",
    );
    process.exitCode = 1;
    return;
  }

  const migration = path.join(process.cwd(), "supabase", "migrations", "0001_whisk_flow.sql");
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    prepare: false,
    onnotice: (notice) => {
      // "relation already exists, skipping" notices are expected on re-runs.
      if (notice.severity !== "NOTICE") console.log(`[${notice.severity}] ${notice.message}`);
    },
  });

  try {
    console.log("Applying supabase/migrations/0001_whisk_flow.sql ...");
    await sql.file(migration);
    console.log("Migration applied.");

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('profiles', 'projects', 'assets', 'scenes', 'generation_jobs',
                           'credit_transactions', 'exports', 'billing_orders',
                           'billing_subscriptions', 'billing_events')
      ORDER BY table_name
    `;
    const required = [
      "assets",
      "billing_events",
      "billing_orders",
      "billing_subscriptions",
      "credit_transactions",
      "exports",
      "generation_jobs",
      "profiles",
      "projects",
      "scenes",
    ];
    const found = new Set(tables.map((row) => row.table_name));
    const missing = required.filter((table) => !found.has(table));
    if (missing.length > 0) {
      throw new Error(`Migration finished but these tables are missing: ${missing.join(", ")}`);
    }
    console.log(`Verified ${required.length} tables.`);

    const bucket = await sql<{ id: string; public: boolean }[]>`
      SELECT id, "public" FROM storage.buckets WHERE id = 'whisk-media'
    `;
    if (bucket.length === 0) {
      throw new Error("The private whisk-media storage bucket was not created.");
    }
    console.log(`Storage bucket "whisk-media" exists (public: ${bucket[0].public}).`);
    if (bucket[0].public) {
      throw new Error("The whisk-media bucket is public. Make it private.");
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
