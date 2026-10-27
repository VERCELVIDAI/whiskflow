import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAsset,
  getAsset,
  listAssetFolders,
  listAssets,
  permanentlyDeleteAsset,
  restoreAsset,
  softDeleteAsset,
  updateAsset,
} from "@/lib/data/assets";
import {
  createProject,
  duplicateProject,
  exportProject,
  getProject,
  listProjects,
  permanentlyDeleteProject,
  projectAssets,
  restoreProject,
  softDeleteProject,
  updateProject,
} from "@/lib/data/projects";
import {
  deleteScene,
  duplicateScene,
  getScene,
  reorderScenes,
  updateScene,
} from "@/lib/data/scenes";
import {
  createTestProfile,
  setupTestDatabase,
  teardownTestDatabase,
  testDatabase,
} from "./helpers/db";

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

function sampleProjectInput() {
  return {
    title: "The Last Light",
    description: "A quiet roadside story.",
    mode: "video" as const,
    aspectRatio: "16:9",
    prompt: "A solitary diner at dusk",
    negativePrompt: "no text, no logos",
    settings: { stylePreset: "cinematic" },
    scenes: [
      { title: "Arrival", prompt: "Wide shot of a diner", durationSeconds: 10 },
      { title: "The counter", prompt: "Close-up of coffee", durationSeconds: 8 },
      { title: "Last light", prompt: "The sign switches off", durationSeconds: 6 },
    ],
  };
}

describe("project persistence and ownership", () => {
  it("creates a project with ordered scenes, settings and prompt history", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());

    expect(project.ownerId).toBe(owner.id);
    expect(project.title).toBe("The Last Light");
    expect(project.status).toBe("draft");
    expect(project.settings).toMatchObject({
      stylePreset: "cinematic",
      negativePrompt: "no text, no logos",
    });
    expect(project.promptHistory).toEqual(["A solitary diner at dusk"]);
    expect(project.scenes.map((scene) => scene.title)).toEqual([
      "Arrival",
      "The counter",
      "Last light",
    ]);
    expect(project.scenes.map((scene) => scene.orderIndex)).toEqual([0, 1, 2]);
    expect(project.scenes[0].durationSeconds).toBe(10);
  });

  it("isolates projects by owner", async () => {
    const owner = await createTestProfile();
    const other = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());

    await expect(getProject(other.id, project.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateProject(other.id, project.id, { title: "Stolen" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      testDatabase().query(`SELECT title FROM projects WHERE id = $1`, [project.id]),
    ).resolves.toEqual([{ title: "The Last Light" }]);

    const ownList = await listProjects(owner.id, {
      page: 1,
      pageSize: 10,
      search: "",
    });
    const otherList = await listProjects(other.id, {
      page: 1,
      pageSize: 10,
      search: "",
    });
    expect(ownList.total).toBe(1);
    expect(otherList.total).toBe(0);
  });

  it("persists autosaved project fields", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());

    const updated = await updateProject(owner.id, project.id, {
      title: "The Last Light — Director's Cut",
      status: "in_progress",
      settings: { stylePreset: "noir", resolution: "1080p" },
      promptHistory: ["A solitary diner at dusk", "A neon sign in the rain"],
      favorite: true,
    });

    expect(updated.title).toBe("The Last Light — Director's Cut");
    expect(updated.status).toBe("in_progress");
    expect(updated.favorite).toBe(true);
    expect(updated.settings).toMatchObject({ stylePreset: "noir", resolution: "1080p" });
    expect(updated.promptHistory).toHaveLength(2);

    const reloaded = await getProject(owner.id, project.id);
    expect(reloaded.title).toBe(updated.title);
    expect(reloaded.promptHistory).toEqual(updated.promptHistory);
  });

  it("persists scene edits and rejects edits from another owner", async () => {
    const owner = await createTestProfile();
    const other = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    const scene = project.scenes[0];

    const updated = await updateScene(owner.id, scene.id, {
      title: "Arrival — revised",
      prompt: "A slower dolly toward the diner",
      durationSeconds: 12,
      transition: "fade",
    });
    expect(updated.title).toBe("Arrival — revised");
    expect(updated.prompt).toBe("A slower dolly toward the diner");
    expect(updated.durationSeconds).toBe(12);
    expect(updated.transition).toBe("fade");

    await expect(updateScene(other.id, scene.id, { title: "Stolen" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(getScene(other.id, scene.id)).rejects.toMatchObject({ status: 404 });
  });

  it("reorders, duplicates and deletes scenes while keeping contiguous order", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    const [first, second, third] = project.scenes;

    const reordered = await reorderScenes(owner.id, project.id, [third.id, first.id, second.id]);
    expect(reordered.map((scene) => scene.id)).toEqual([third.id, first.id, second.id]);
    expect(reordered.map((scene) => scene.orderIndex)).toEqual([0, 1, 2]);

    const copy = await duplicateScene(owner.id, first.id);
    expect(copy.title).toBe("Arrival copy");
    expect(copy.status).toBe("draft");
    const afterCopy = await getProject(owner.id, project.id);
    expect(afterCopy.scenes).toHaveLength(4);
    expect(afterCopy.scenes.findIndex((scene) => scene.id === copy.id)).toBe(2);

    await deleteScene(owner.id, second.id);
    const afterDelete = await getProject(owner.id, project.id);
    expect(afterDelete.scenes).toHaveLength(3);
    expect(afterDelete.scenes.map((scene) => scene.orderIndex)).toEqual([0, 1, 2]);
    expect(afterDelete.scenes.some((scene) => scene.id === second.id)).toBe(false);
  });

  it("duplicates a project with independent scenes", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    const copy = await duplicateProject(owner.id, project.id);

    expect(copy.id).not.toBe(project.id);
    expect(copy.title).toBe("Copy of The Last Light");
    expect(copy.scenes).toHaveLength(project.scenes.length);
    expect(copy.scenes[0].id).not.toBe(project.scenes[0].id);
    expect(copy.scenes[0].prompt).toBe(project.scenes[0].prompt);
    await expect(getProject(owner.id, copy.id)).resolves.toBeTruthy();
  });

  it("moves projects to trash, restores them and permanently deletes them", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());

    await softDeleteProject(owner.id, project.id);
    const active = await listProjects(owner.id, { page: 1, pageSize: 10, search: "" });
    const trash = await listProjects(owner.id, {
      page: 1,
      pageSize: 10,
      search: "",
      trash: true,
    });
    expect(active.total).toBe(0);
    expect(trash.total).toBe(1);

    await restoreProject(owner.id, project.id);
    await expect(
      listProjects(owner.id, { page: 1, pageSize: 10, search: "" }),
    ).resolves.toMatchObject({ total: 1 });

    await permanentlyDeleteProject(owner.id, project.id);
    await expect(getProject(owner.id, project.id)).rejects.toMatchObject({ status: 404 });
  });

  it("filters projects by mode, favorite and search", async () => {
    const owner = await createTestProfile();
    const first = await createProject(owner.id, sampleProjectInput());
    await createProject(owner.id, {
      ...sampleProjectInput(),
      title: "Saffron & Smoke",
      mode: "image",
      aspectRatio: "4:5",
    });
    await updateProject(owner.id, first.id, { favorite: true });

    await expect(
      listProjects(owner.id, { page: 1, pageSize: 10, search: "", mode: "image" }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      listProjects(owner.id, { page: 1, pageSize: 10, search: "", favorites: true }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      listProjects(owner.id, { page: 1, pageSize: 10, search: "Saffron" }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      listProjects(owner.id, { page: 1, pageSize: 1, search: "" }),
    ).resolves.toMatchObject({ total: 2, pageSize: 1 });
  });

  it("records export history", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());

    const first = await exportProject(owner.id, project.id);
    expect(first.record.format).toBe("json");
    expect(first.project.exportHistory).toHaveLength(1);

    const second = await exportProject(owner.id, project.id);
    expect(second.project.exportHistory).toHaveLength(2);
    const rows = await testDatabase().query(
      `SELECT COUNT(*)::int AS count FROM exports WHERE owner_id = $1`,
      [owner.id],
    );
    expect(rows[0].count).toBe(2);
  });
});

describe("asset persistence and ownership", () => {
  async function createSampleAsset(ownerId: string, projectId: string) {
    return createAsset(ownerId, {
      projectId,
      kind: "image",
      title: "Hero frame",
      storageProvider: "local",
      storagePath: `${ownerId}/hero-frame.png`,
      mimeType: "image/png",
      sizeBytes: 128,
      source: "upload",
      folder: "Characters",
      tags: ["hero", "frame"],
      favorite: true,
    });
  }

  it("stores private asset URLs and isolates assets by owner", async () => {
    const owner = await createTestProfile();
    const other = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    const asset = await createSampleAsset(owner.id, project.id);

    expect(asset.url).toBe(`/api/media/${asset.id}`);
    expect(asset.thumbnailUrl).toBe(`/api/media/${asset.id}?variant=thumb`);
    await expect(getAsset(owner.id, asset.id)).resolves.toMatchObject({ title: "Hero frame" });
    await expect(getAsset(other.id, asset.id)).rejects.toMatchObject({ status: 404 });
    await expect(projectAssets(owner.id, project.id)).resolves.toHaveLength(1);
    await expect(projectAssets(other.id, project.id)).resolves.toHaveLength(0);
  });

  it("filters, updates, trashes and restores assets", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    const asset = await createSampleAsset(owner.id, project.id);

    const filtered = await listAssets(owner.id, {
      page: 1,
      pageSize: 10,
      search: "Hero",
      folder: "Characters",
      favorites: true,
      sort: "newest",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].id).toBe(asset.id);

    const updated = await updateAsset(owner.id, asset.id, {
      title: "Hero frame — alternate",
      folder: "Locations",
      favorite: false,
    });
    expect(updated.title).toBe("Hero frame — alternate");
    expect(updated.folder).toBe("Locations");
    expect(updated.favorite).toBe(false);

    await softDeleteAsset(owner.id, asset.id);
    const active = await listAssets(owner.id, {
      page: 1,
      pageSize: 10,
      search: "",
      sort: "newest",
    });
    const trash = await listAssets(owner.id, {
      page: 1,
      pageSize: 10,
      search: "",
      trash: true,
      sort: "newest",
    });
    expect(active.total).toBe(0);
    expect(trash.total).toBe(1);

    await restoreAsset(owner.id, asset.id);
    await expect(getAsset(owner.id, asset.id)).resolves.toMatchObject({ folder: "Locations" });
    await permanentlyDeleteAsset(owner.id, asset.id);
    await expect(getAsset(owner.id, asset.id)).rejects.toMatchObject({ status: 404 });
  });

  it("lists folder counts for the media library", async () => {
    const owner = await createTestProfile();
    const project = await createProject(owner.id, sampleProjectInput());
    await createSampleAsset(owner.id, project.id);
    await createAsset(owner.id, {
      kind: "image",
      title: "Location plate",
      storageProvider: "local",
      storagePath: `${owner.id}/location.png`,
      mimeType: "image/png",
      folder: "Locations",
    });

    const folders = await listAssetFolders(owner.id);
    expect(folders).toEqual([
      { folder: "Characters", count: 1 },
      { folder: "Locations", count: 1 },
    ]);
  });
});
