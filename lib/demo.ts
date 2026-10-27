import "server-only";
import { getDatabase } from "@/lib/db";
import { createAsset } from "@/lib/data/assets";
import { createProject, getProject, updateProject } from "@/lib/data/projects";
import { updateScene } from "@/lib/data/scenes";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/config";
import { AppError, logWarning } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { loginLocal, registerLocal } from "@/lib/auth/local";
import { DEMO_PROJECTS, WELCOME_PROJECTS, type ExampleProject } from "@/lib/demo-content";
import type { AppUser } from "@/lib/types";

async function hasExample(ownerId: string, templateSlug: string): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT id FROM projects WHERE owner_id = $1 AND template_slug = $2 LIMIT 1`,
    [ownerId, templateSlug],
  );
  return rows.length > 0;
}

async function createExampleProject(ownerId: string, example: ExampleProject): Promise<void> {
  if (await hasExample(ownerId, example.templateSlug)) return;
  const project = await createProject(ownerId, {
    title: example.title,
    description: example.description,
    mode: example.mode,
    aspectRatio: example.aspectRatio,
    templateSlug: example.templateSlug,
    isExample: true,
    scenes: example.scenes,
  });

  const imageAsset = await createAsset(ownerId, {
    projectId: project.id,
    kind: "image",
    title: `${example.title} · key frame`,
    url: example.poster,
    thumbnailUrl: example.poster,
    storageProvider: "local",
    mimeType: "image/jpeg",
    source: "example",
    folder: "Examples",
    isExample: true,
    aspectRatio: example.aspectRatio,
    tags: ["Example"],
  });

  let videoAssetId: string | null = null;
  if (example.video) {
    const videoAsset = await createAsset(ownerId, {
      projectId: project.id,
      kind: "video",
      title: `${example.title} · sample clip`,
      url: example.video,
      thumbnailUrl: example.poster,
      storageProvider: "local",
      mimeType: "video/mp4",
      durationSeconds: 10,
      source: "example",
      folder: "Examples",
      isExample: true,
      aspectRatio: example.aspectRatio,
      tags: ["Example", "Sample clip"],
    });
    videoAssetId = videoAsset.id;
  }

  await updateProject(ownerId, project.id, {
    coverAssetId: imageAsset.id,
    favorite: example.favorite ?? false,
    status: example.status,
  });

  const refreshed = await getProject(ownerId, project.id);
  for (const [index, scene] of refreshed.scenes.entries()) {
    await updateScene(ownerId, scene.id, {
      thumbnailUrl: index === 1 && example.mode === "image" ? "/samples/fashion-portrait.jpg" : example.poster,
      status: example.status === "complete" ? "ready" : "draft",
      ...(index === 0 && videoAssetId
        ? { videoAssetId, status: "ready" as const }
        : {}),
    });
  }
}

export async function seedWelcomeContent(ownerId: string): Promise<void> {
  try {
    for (const example of WELCOME_PROJECTS) {
      await createExampleProject(ownerId, example);
    }
  } catch (error) {
    logWarning("Could not seed welcome content", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function seedDemoContent(ownerId: string): Promise<void> {
  await seedWelcomeContent(ownerId);
  try {
    for (const example of DEMO_PROJECTS) {
      await createExampleProject(ownerId, example);
    }
  } catch (error) {
    logWarning("Could not seed demo content", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureDemoUser(): Promise<AppUser> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new AppError(
      400,
      "demo_unavailable",
      "The shared demo account is available in local mode. Create a Supabase account to use this deployment.",
    );
  }
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT p.id, c.password_hash FROM profiles p
     JOIN local_credentials c ON c.user_id = p.id
     WHERE p.email = $1 LIMIT 1`,
    [DEMO_EMAIL],
  );
  if (rows.length === 0) {
    const user = await registerLocal({
      fullName: "Demo Director",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    await seedDemoContent(user.id);
    return user;
  }
  const userId = String(rows[0].id);
  const valid = await verifyPassword(DEMO_PASSWORD, String(rows[0].password_hash));
  if (!valid) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    await db.query(
      `UPDATE local_credentials SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
       WHERE user_id = $2`,
      [passwordHash, userId],
    );
  }
  await seedDemoContent(userId);
  return loginLocal(DEMO_EMAIL, DEMO_PASSWORD);
}
