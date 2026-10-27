import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const providerState = vi.hoisted(() => ({
  create: vi.fn(),
  poll: vi.fn(),
  cancel: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  putMedia: vi.fn(),
  readAssetData: vi.fn(),
  deleteStoredMedia: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  getProviderAdapter: () => providerState,
}));

vi.mock("@/lib/storage", () => storageState);

import {
  cancelGenerationJob,
  pollGenerationJob,
  startGeneration,
} from "@/lib/generation/service";
import { MODEL_CONFIG } from "@/lib/providers/models";
import { ProviderError } from "@/lib/errors";
import { createProject, getProject } from "@/lib/data/projects";
import {
  createTestProfile,
  getProfileBalance,
  setupTestDatabase,
  teardownTestDatabase,
  testDatabase,
} from "./helpers/db";

let sequence = 0;

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-google-key";
  sequence += 1;
  providerState.create.mockReset();
  providerState.poll.mockReset();
  providerState.cancel.mockReset();
  storageState.putMedia.mockReset();
  storageState.readAssetData.mockReset();
  storageState.deleteStoredMedia.mockReset();
  storageState.putMedia.mockImplementation(
    async (input: { ownerId: string; mediaId: string; mimeType: string }) => ({
      provider: "local" as const,
      storagePath: `${input.ownerId}/${input.mediaId}.${input.mimeType.split("/")[1] || "bin"}`,
      thumbnailPath: null,
      sizeBytes: 4,
    }),
  );
  storageState.readAssetData.mockResolvedValue({
    data: Buffer.from("reference"),
    mimeType: "image/png",
  });
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

function key(prefix: string): string {
  return `${prefix}-${sequence}-${randomUUID()}`;
}

async function createImageProject(ownerId: string) {
  return createProject(ownerId, {
    title: "Generation test",
    mode: "image",
    aspectRatio: "1:1",
    prompt: "A test frame",
  });
}

async function jobRows(ownerId: string) {
  return testDatabase().query(
    `SELECT * FROM generation_jobs WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
}

describe("generation orchestration and credits", () => {
  it("reserves, captures, stores assets and updates the project", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const project = await createImageProject(owner.id);
    providerState.create.mockResolvedValue({
      status: "succeeded",
      providerJobId: "provider-image-1",
      assets: [
        { data: Buffer.from("one"), mimeType: "image/png" },
        { data: Buffer.from("two"), mimeType: "image/png" },
      ],
    });

    const result = await startGeneration(owner.id, {
      kind: "image",
      model: MODEL_CONFIG.geminiImage,
      prompt: "A lighthouse in fog",
      aspectRatio: "1:1",
      resolution: "1K",
      outputCount: 2,
      projectId: project.id,
      idempotencyKey: key("image-success"),
    });

    expect(result.job.status).toBe("succeeded");
    expect(result.job.creditsReserved).toBe(20);
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0].kind).toBe("image");
    expect(providerState.create).toHaveBeenCalledTimes(1);
    const adapterRequest = providerState.create.mock.calls[0][0];
    expect(adapterRequest).toMatchObject({
      model: expect.objectContaining({ id: MODEL_CONFIG.geminiImage }),
      prompt: "A lighthouse in fog",
      outputCount: 2,
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 80, reserved: 0 });
    const stored = await testDatabase().query(
      `SELECT id, kind, storage_path FROM assets WHERE owner_id = $1`,
      [owner.id],
    );
    expect(stored).toHaveLength(2);
    expect(stored[0].storage_path).toContain(owner.id);
    const refreshed = await getProject(owner.id, project.id);
    expect(refreshed.status).toBe("in_progress");
    expect(refreshed.coverAssetId).toBeTruthy();
    expect(refreshed.promptHistory).toContain("A lighthouse in fog");

    const ledger = await testDatabase().query(
      `SELECT type FROM credit_transactions WHERE generation_id = $1`,
      [result.job.id],
    );
    expect(new Set(ledger.map((row) => row.type))).toEqual(new Set(["reservation", "charge"]));
  });

  it("returns the existing job for an idempotency key without charging twice", async () => {
    const owner = await createTestProfile({ credits: 100 });
    providerState.create.mockResolvedValue({
      status: "succeeded",
      providerJobId: "provider-idempotent",
      assets: [{ data: Buffer.from("one"), mimeType: "image/png" }],
    });
    const input = {
      kind: "image" as const,
      model: MODEL_CONFIG.geminiImage,
      prompt: "An idempotent frame",
      aspectRatio: "1:1",
      resolution: "1K",
      idempotencyKey: key("idempotent"),
    };

    const first = await startGeneration(owner.id, input);
    const second = await startGeneration(owner.id, input);
    expect(second.job.id).toBe(first.job.id);
    expect(providerState.create).toHaveBeenCalledTimes(1);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 90, reserved: 0 });
  });

  it("releases reserved credits and records a failed job when the provider fails", async () => {
    const owner = await createTestProfile({ credits: 100 });
    providerState.create.mockRejectedValue(new ProviderError("google", "Upstream failed"));

    await expect(
      startGeneration(owner.id, {
        kind: "image",
        model: MODEL_CONFIG.geminiImage,
        prompt: "A failing frame",
        aspectRatio: "1:1",
        resolution: "1K",
        idempotencyKey: key("provider-failure"),
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      status: 502,
      message: "Upstream failed",
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 0 });
    const jobs = await jobRows(owner.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ status: "failed", error: "Upstream failed" });

    const ledger = await testDatabase().query(
      `SELECT type FROM credit_transactions WHERE generation_id = $1`,
      [String(jobs[0].id)],
    );
    expect(new Set(ledger.map((row) => row.type))).toEqual(new Set(["reservation", "release"]));
  });

  it("does not create a job or reserve credits when the balance is insufficient", async () => {
    const owner = await createTestProfile({ credits: 5 });
    providerState.create.mockResolvedValue({
      status: "succeeded",
      assets: [{ data: Buffer.from("one"), mimeType: "image/png" }],
    });

    await expect(
      startGeneration(owner.id, {
        kind: "image",
        model: MODEL_CONFIG.geminiImage,
        prompt: "An unaffordable frame",
        aspectRatio: "1:1",
        resolution: "1K",
        idempotencyKey: key("insufficient"),
      }),
    ).rejects.toMatchObject({ status: 402, code: "insufficient_credits" });

    expect(providerState.create).not.toHaveBeenCalled();
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 5, reserved: 0 });
    await expect(jobRows(owner.id)).resolves.toHaveLength(0);
  });

  it("rejects invalid models, unsupported settings and missing provider keys", async () => {
    const owner = await createTestProfile({ credits: 100 });

    await expect(
      startGeneration(owner.id, {
        kind: "image",
        model: "missing-model",
        prompt: "A frame",
        aspectRatio: "1:1",
      }),
    ).rejects.toMatchObject({ status: 422, code: "invalid_model" });

    await expect(
      startGeneration(owner.id, {
        kind: "video",
        model: MODEL_CONFIG.geminiVideo,
        prompt: "A video",
        aspectRatio: "1:1",
        resolution: "1080p",
      }),
    ).rejects.toMatchObject({ status: 422, code: "invalid_setting" });

    delete process.env.GEMINI_API_KEY;
    await expect(
      startGeneration(owner.id, {
        kind: "image",
        model: MODEL_CONFIG.geminiImage,
        prompt: "A frame",
        aspectRatio: "1:1",
      }),
    ).rejects.toMatchObject({ status: 503, code: "provider_not_configured" });

    expect(providerState.create).not.toHaveBeenCalled();
    await expect(jobRows(owner.id)).resolves.toHaveLength(0);
  });

  it("normalizes video duration, polls an async provider and captures credits", async () => {
    const owner = await createTestProfile({ credits: 100 });
    providerState.create.mockResolvedValue({
      status: "running",
      providerJobId: "provider-video-1",
    });
    providerState.poll.mockResolvedValue({
      status: "succeeded",
      assets: [
        { data: Buffer.from("video"), mimeType: "video/mp4", durationSeconds: 10 },
      ],
    });

    const started = await startGeneration(owner.id, {
      kind: "video",
      model: MODEL_CONFIG.geminiVideo,
      prompt: "A slow push through a rainy street",
      aspectRatio: "16:9",
      resolution: "1080p",
      durationSeconds: 4,
      generateAudio: true,
      idempotencyKey: key("video-async"),
    });

    expect(started.job.status).toBe("running");
    expect(started.job.settings.durationSeconds).toBe(10);
    expect(started.job.settings.generateAudio).toBe(true);
    expect(started.job.creditsReserved).toBe(80);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 80 });

    const polled = await pollGenerationJob(owner.id, started.job.id);
    expect(polled.job.status).toBe("succeeded");
    expect(polled.assets).toHaveLength(1);
    expect(polled.assets[0]).toMatchObject({ kind: "video", durationSeconds: 10 });
    expect(providerState.poll).toHaveBeenCalledWith("provider-video-1");
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 20, reserved: 0 });
  });

  it("cancels a running provider job and releases the reservation", async () => {
    const owner = await createTestProfile({ credits: 100 });
    providerState.create.mockResolvedValue({
      status: "running",
      providerJobId: "provider-cancel-1",
    });
    providerState.cancel.mockResolvedValue(undefined);

    const started = await startGeneration(owner.id, {
      kind: "image",
      model: MODEL_CONFIG.geminiImage,
      prompt: "A frame to cancel",
      aspectRatio: "1:1",
      resolution: "1K",
      idempotencyKey: key("cancel"),
    });
    const cancelled = await cancelGenerationJob(owner.id, started.job.id);

    expect(cancelled.status).toBe("cancelled");
    expect(providerState.cancel).toHaveBeenCalledWith("provider-cancel-1");
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 0 });
  });
});
