import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  captureCreditsTx,
  getUsage,
  grantCredits,
  releaseCreditsTx,
  reserveCreditsTx,
} from "@/lib/data/credits";
import { insertJobTx } from "@/lib/data/jobs";
import {
  createTestProfile,
  getProfileBalance,
  setupTestDatabase,
  teardownTestDatabase,
  testDatabase,
} from "./helpers/db";

let sequence = 0;

async function createJob(ownerId: string, creditsReserved = 40) {
  sequence += 1;
  return testDatabase().transaction((tx) =>
    insertJobTx(tx, {
      id: randomUUID(),
      ownerId,
      projectId: null,
      sceneId: null,
      kind: "image",
      provider: "google",
      model: "test-image-model",
      prompt: "A test frame",
      negativePrompt: "",
      settings: { aspectRatio: "1:1" },
      outputCount: 1,
      creditsReserved,
      idempotencyKey: `credits-job-${sequence}-${randomUUID()}`,
      status: "queued",
    }),
  );
}

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe("credit reservation, capture and release", () => {
  it("reserves credits without reducing the balance and records a ledger row", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const job = await createJob(owner.id, 40);

    const result = await testDatabase().transaction((tx) =>
      reserveCreditsTx(tx, {
        ownerId: owner.id,
        amount: 40,
        generationId: job.id,
        description: "Reserved test credits",
      }),
    );

    expect(result).toEqual({ balance: 100, reserved: 40 });
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 40 });

    const ledger = await testDatabase().query(
      `SELECT type, amount, reserved_delta, balance_after, metadata
       FROM credit_transactions WHERE generation_id = $1`,
      [job.id],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      type: "reservation",
      amount: 0,
      reserved_delta: 40,
      balance_after: 100,
    });
    expect(ledger[0].metadata).toMatchObject({ availableBefore: 100 });
  });

  it("refuses to oversubscribe when credits are already reserved", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const first = await createJob(owner.id, 60);
    const second = await createJob(owner.id, 60);

    await testDatabase().transaction((tx) =>
      reserveCreditsTx(tx, {
        ownerId: owner.id,
        amount: 60,
        generationId: first.id,
        description: "First reservation",
      }),
    );

    await expect(
      testDatabase().transaction((tx) =>
        reserveCreditsTx(tx, {
          ownerId: owner.id,
          amount: 60,
          generationId: second.id,
          description: "Second reservation",
        }),
      ),
    ).rejects.toMatchObject({
      name: "InsufficientCreditsError",
      status: 402,
      code: "insufficient_credits",
      details: { required: 60, available: 40 },
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 60 });
    const secondLedger = await testDatabase().query(
      `SELECT id FROM credit_transactions WHERE generation_id = $1`,
      [second.id],
    );
    expect(secondLedger).toHaveLength(0);
  });

  it("captures a reservation and deducts the balance exactly once", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const job = await createJob(owner.id, 40);
    await testDatabase().transaction((tx) =>
      reserveCreditsTx(tx, {
        ownerId: owner.id,
        amount: 40,
        generationId: job.id,
        description: "Reserve",
      }),
    );

    await testDatabase().transaction((tx) =>
      captureCreditsTx(tx, {
        ownerId: owner.id,
        amount: 40,
        generationId: job.id,
        description: "Charge",
      }),
    );

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 60, reserved: 0 });
    const ledger = await testDatabase().query(
      `SELECT type, amount, reserved_delta, balance_after
       FROM credit_transactions WHERE generation_id = $1 ORDER BY created_at ASC`,
      [job.id],
    );
    expect(ledger.map((row) => row.type)).toEqual(["reservation", "charge"]);
    expect(ledger[1]).toMatchObject({
      amount: -40,
      reserved_delta: -40,
      balance_after: 60,
    });
  });

  it("releases a reservation without charging the balance", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const job = await createJob(owner.id, 30);
    await testDatabase().transaction((tx) =>
      reserveCreditsTx(tx, {
        ownerId: owner.id,
        amount: 30,
        generationId: job.id,
        description: "Reserve",
      }),
    );

    await testDatabase().transaction((tx) =>
      releaseCreditsTx(tx, {
        ownerId: owner.id,
        amount: 30,
        generationId: job.id,
        description: "Release",
      }),
    );

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 100, reserved: 0 });
    const ledger = await testDatabase().query(
      `SELECT type, amount, reserved_delta, balance_after
       FROM credit_transactions WHERE generation_id = $1 ORDER BY created_at ASC`,
      [job.id],
    );
    expect(ledger.map((row) => row.type)).toEqual(["reservation", "release"]);
    expect(ledger[1]).toMatchObject({ amount: 0, reserved_delta: -30, balance_after: 100 });
  });

  it("grants credits and reports usage from the ledger", async () => {
    const owner = await createTestProfile({ credits: 100 });
    const job = await createJob(owner.id, 40);
    await testDatabase().transaction((tx) =>
      reserveCreditsTx(tx, {
        ownerId: owner.id,
        amount: 40,
        generationId: job.id,
        description: "Reserve",
      }),
    );
    await testDatabase().transaction((tx) =>
      captureCreditsTx(tx, {
        ownerId: owner.id,
        amount: 40,
        generationId: job.id,
        description: "Charge",
      }),
    );
    await grantCredits(owner.id, 25, "Bonus credits");

    const usage = await getUsage(owner.id);
    expect(usage.balance).toBe(85);
    expect(usage.reserved).toBe(0);
    expect(usage.spentThisMonth).toBe(40);
    expect(usage.grantedThisMonth).toBe(25);
    expect(usage.generationsThisMonth).toBe(1);
    expect(usage.byKind).toEqual([{ kind: "image", count: 1, credits: 40 }]);
    expect(usage.transactions.map((row) => row.type)).toEqual([
      "grant",
      "charge",
      "reservation",
    ]);
    expect(usage.jobs).toHaveLength(1);
  });
});
