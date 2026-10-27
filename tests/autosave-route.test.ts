import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "" }));

vi.mock("@/lib/auth", () => ({
  requireApiUser: async () => ({
    id: authState.userId,
    email: "route-test@example.test",
    fullName: "Route Test",
    avatarUrl: null,
    plan: "studio",
    credits: 1_000,
    reservedCredits: 0,
    createdAt: new Date().toISOString(),
    authMode: "local" as const,
  }),
}));

import { PATCH as patchProject } from "@/app/api/projects/[id]/route";
import { PATCH as patchScene } from "@/app/api/scenes/[id]/route";
import { createProject, getProject } from "@/lib/data/projects";
import { getScene } from "@/lib/data/scenes";
import type { ProjectDetail, Scene } from "@/lib/types";
import {
  createTestProfile,
  setupTestDatabase,
  teardownTestDatabase,
} from "./helpers/db";

let ownerId = "";
let otherId = "";
let project: ProjectDetail;
let scene: Scene;

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  const owner = await createTestProfile();
  const other = await createTestProfile();
  ownerId = owner.id;
  otherId = other.id;
  authState.userId = ownerId;
  project = await createProject(ownerId, {
    title: "Autosave project",
    mode: "storyboard",
    aspectRatio: "16:9",
    prompt: "A first prompt",
    scenes: [
      { title: "Scene one", prompt: "A wide shot", durationSeconds: 10 },
      { title: "Scene two", prompt: "A close-up", durationSeconds: 8 },
    ],
  });
  scene = project.scenes[0];
});

function projectRequest(body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

function sceneRequest(body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/scenes/${scene.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("autosave PATCH routes", () => {
  it("persists project title, settings and prompt history", async () => {
    const response = await patchProject(projectRequest({
      title: "Autosaved title",
      settings: { resolution: "1080p", generateAudio: true },
      promptHistory: ["A first prompt", "A revised prompt"],
    }), { params: Promise.resolve({ id: project.id }) });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { project: { title: string } };
    expect(payload.project.title).toBe("Autosaved title");

    const stored = await getProject(ownerId, project.id);
    expect(stored.title).toBe("Autosaved title");
    expect(stored.settings).toMatchObject({ resolution: "1080p", generateAudio: true });
    expect(stored.promptHistory).toEqual(["A first prompt", "A revised prompt"]);
  });

  it("persists scene prompt, duration and negative prompt", async () => {
    const response = await patchScene(sceneRequest({
      prompt: "A slow push through the doorway",
      durationSeconds: 12,
      negativePrompt: "no text, no logos",
    }), { params: Promise.resolve({ id: scene.id }) });

    expect(response.status).toBe(200);
    const stored = await getScene(ownerId, scene.id);
    expect(stored.prompt).toBe("A slow push through the doorway");
    expect(stored.durationSeconds).toBe(12);
    expect(stored.negativePrompt).toBe("no text, no logos");
  });

  it("rejects unknown fields with a validation response", async () => {
    const response = await patchProject(projectRequest({
      title: "Spoofed",
      ownerId: otherId,
    }), { params: Promise.resolve({ id: project.id }) });

    expect(response.status).toBe(422);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("validation_error");
    const stored = await getProject(ownerId, project.id);
    expect(stored.title).toBe("Autosave project");
  });

  it("does not let another user autosave into the project", async () => {
    authState.userId = otherId;
    const response = await patchProject(projectRequest({ title: "Stolen" }), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(response.status).toBe(404);

    const stored = await getProject(ownerId, project.id);
    expect(stored.title).toBe("Autosave project");
  });

  it("rejects cross-origin writes", async () => {
    const response = await patchProject(projectRequest({ title: "Cross-origin" }, "http://evil.test"), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(response.status).toBe(403);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("invalid_origin");
  });
});
