/**
 * Seed example projects for a Whisk Flow account.
 *
 * Local mode (default):
 *   npm run db:seed
 *   Creates (or reuses) demo@whiskflow.studio with the demo-flow password,
 *   then inserts the welcome and demo projects.
 *
 * Custom local account:
 *   SEED_EMAIL=you@example.com SEED_PASSWORD=your-password npm run db:seed
 *
 * Supabase/PostgreSQL mode:
 *   SEED_EMAIL=you@example.com npm run db:seed
 *   The profile must already exist (sign up in the app first). The script only
 *   seeds content; Supabase Auth users are managed by Supabase.
 *
 * The script is idempotent: projects are matched by owner + template slug.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLocalDatabase, createPostgresDatabase, type Database } from "@/lib/db";
import { hashPassword } from "@/lib/auth/crypto";
import { DEFAULT_CREDITS, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/config";
import { DEMO_PROJECTS, WELCOME_PROJECTS, type ExampleProject } from "@/lib/demo-content";

/** Minimal .env loader so the script behaves like `next dev` without extra deps. */
async function loadEnvFiles(): Promise<void> {
  for (const filename of [".env.local", ".env"]) {
    let contents: string;
    try {
      contents = await fs.readFile(path.join(process.cwd(), filename), "utf8");
    } catch {
      continue;
    }
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function seedScope(): ExampleProject[] {
  const scope = (process.env.SEED_SCOPE || "demo").trim().toLowerCase();
  if (scope === "welcome") return WELCOME_PROJECTS;
  if (scope === "demo" || scope === "all") return [...WELCOME_PROJECTS, ...DEMO_PROJECTS];
  throw new Error(`Unknown SEED_SCOPE "${scope}". Use "welcome" or "demo".`);
}

async function ensureLocalUser(
  db: Database,
  email: string,
  password: string,
  fullName: string,
): Promise<{ userId: string; created: boolean }> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM profiles WHERE email = $1 LIMIT 1`,
    [email],
  );
  if (existing.length > 0) {
    const userId = String(existing[0].id);
    const credentials = await db.query(
      `SELECT user_id FROM local_credentials WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (credentials.length === 0) {
      const passwordHash = await hashPassword(password);
      await db.query(
        `INSERT INTO local_credentials (user_id, password_hash, email_verified, session_version)
         VALUES ($1, $2, TRUE, 1)`,
        [userId, passwordHash],
      );
    }
    return { userId, created: false };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO profiles (id, email, full_name, plan, credits, reserved_credits)
       VALUES ($1, $2, $3, 'free', $4, 0)`,
      [userId, email, fullName, DEFAULT_CREDITS],
    );
    await tx.query(
      `INSERT INTO local_credentials (user_id, password_hash, email_verified, session_version)
       VALUES ($1, $2, TRUE, 1)`,
      [userId, passwordHash],
    );
    await tx.query(
      `INSERT INTO credit_transactions
         (id, owner_id, type, amount, reserved_delta, balance_after, description, metadata)
       VALUES ($1, $2, 'grant', $3, 0, $4, $5, $6::jsonb)`,
      [
        crypto.randomUUID(),
        userId,
        DEFAULT_CREDITS,
        DEFAULT_CREDITS,
        "Welcome credits",
        JSON.stringify({ source: "seed" }),
      ],
    );
  });
  return { userId, created: true };
}

async function ensureRemoteUser(db: Database, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM profiles WHERE email = $1 LIMIT 1`,
    [email],
  );
  if (rows.length === 0) {
    throw new Error(
      `No profile exists for ${email}. Create the account in the app first, then run the seed again.`,
    );
  }
  return String(rows[0].id);
}

async function seedExample(
  db: Database,
  ownerId: string,
  example: ExampleProject,
): Promise<boolean> {
  const existing = await db.query(
    `SELECT id FROM projects WHERE owner_id = $1 AND template_slug = $2 LIMIT 1`,
    [ownerId, example.templateSlug],
  );
  if (existing.length > 0) return false;

  const projectId = crypto.randomUUID();
  const imageAssetId = crypto.randomUUID();
  const videoAssetId = example.video ? crypto.randomUUID() : null;

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO projects
         (id, owner_id, title, description, mode, status, aspect_ratio, settings,
          prompt_history, template_slug, is_example, favorite, cover_asset_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb,'[]'::jsonb,$8,TRUE,$9,$10)`,
      [
        projectId,
        ownerId,
        example.title,
        example.description,
        example.mode,
        example.status,
        example.aspectRatio,
        example.templateSlug,
        example.favorite ?? false,
        imageAssetId,
      ],
    );

    for (const [index, scene] of example.scenes.entries()) {
      const thumbnail =
        index === 1 && example.mode === "image"
          ? "/samples/fashion-portrait.jpg"
          : example.poster;
      const status =
        index === 0 && videoAssetId
          ? "ready"
          : example.status === "complete"
            ? "ready"
            : "draft";
      await tx.query(
        `INSERT INTO scenes
           (id, project_id, owner_id, title, prompt, duration_seconds, order_index,
            status, thumbnail_url, video_asset_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          crypto.randomUUID(),
          projectId,
          ownerId,
          scene.title,
          scene.prompt,
          scene.durationSeconds,
          index,
          status,
          thumbnail,
          index === 0 ? videoAssetId : null,
        ],
      );
    }

    await tx.query(
      `INSERT INTO assets
         (id, owner_id, project_id, kind, title, url, thumbnail_url, storage_provider,
          mime_type, source, folder, tags, is_example, aspect_ratio)
       VALUES ($1,$2,$3,'image',$4,$5,$5,'local',$6,'example','Examples',$7::text[],TRUE,$8)`,
      [
        imageAssetId,
        ownerId,
        projectId,
        `${example.title} · key frame`,
        example.poster,
        "image/jpeg",
        ["Example"],
        example.aspectRatio,
      ],
    );

    if (videoAssetId && example.video) {
      await tx.query(
        `INSERT INTO assets
           (id, owner_id, project_id, kind, title, url, thumbnail_url, storage_provider,
            mime_type, duration_seconds, source, folder, tags, is_example, aspect_ratio)
         VALUES ($1,$2,$3,'video',$4,$5,$6,'local','video/mp4',10,'example','Examples',$7::text[],TRUE,$8)`,
        [
          videoAssetId,
          ownerId,
          projectId,
          `${example.title} · sample clip`,
          example.video,
          example.poster,
          ["Example", "Sample clip"],
          example.aspectRatio,
        ],
      );
    }
  });

  return true;
}

async function main(): Promise<void> {
  await loadEnvFiles();

  const supabaseAuthConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (supabaseAuthConfigured && !process.env.DATABASE_URL) {
    throw new Error(
      "Supabase Auth is configured but DATABASE_URL is missing. Add the direct Postgres connection string to .env.local.",
    );
  }

  const remote = Boolean(process.env.DATABASE_URL);
  const email = (process.env.SEED_EMAIL || DEMO_EMAIL).trim().toLowerCase();
  const password = process.env.SEED_PASSWORD || DEMO_PASSWORD;
  const fullName = (process.env.SEED_NAME || "Demo Director").trim();
  const examples = seedScope();

  const db = remote
    ? await createPostgresDatabase(process.env.DATABASE_URL as string)
    : await createLocalDatabase();

  try {
    let userId: string;
    let created = false;
    if (remote) {
      userId = await ensureRemoteUser(db, email);
    } else {
      ({ userId, created } = await ensureLocalUser(db, email, password, fullName));
    }

    let inserted = 0;
    for (const example of examples) {
      if (await seedExample(db, userId, example)) inserted += 1;
    }

    console.log(`Whisk Flow seed complete (${remote ? "PostgreSQL" : "local PGlite"}).`);
    console.log(`Account: ${email}${created ? " (created)" : ""}`);
    console.log(`Projects inserted: ${inserted}; already present: ${examples.length - inserted}.`);
    if (!remote && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
