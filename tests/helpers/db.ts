import { randomUUID } from "node:crypto";
import { createLocalDatabase, type Database } from "@/lib/db";

type GlobalDatabaseStore = typeof globalThis & {
  __whiskFlowDb?: Promise<Database>;
};

let database: Database | null = null;

export async function setupTestDatabase(): Promise<Database> {
  if (database) await database.close();
  database = await createLocalDatabase({ memory: true });
  (globalThis as GlobalDatabaseStore).__whiskFlowDb = Promise.resolve(database);
  return database;
}

export async function teardownTestDatabase(): Promise<void> {
  delete (globalThis as GlobalDatabaseStore).__whiskFlowDb;
  if (database) {
    await database.close();
    database = null;
  }
}

export function testDatabase(): Database {
  if (!database) throw new Error("The test database has not been initialized.");
  return database;
}

export async function resetTestDatabase(): Promise<void> {
  const db = testDatabase();
  await db.query(
    `TRUNCATE TABLE
       billing_events, billing_subscriptions, billing_orders,
       exports, credit_transactions, generation_jobs, scenes, assets, projects,
       local_password_resets, local_credentials, profiles
     RESTART IDENTITY CASCADE`,
  );
}

export interface TestProfile {
  id: string;
  email: string;
  fullName: string;
  credits: number;
}

export async function createTestProfile(
  input: { credits?: number; email?: string; fullName?: string; plan?: string } = {},
): Promise<TestProfile> {
  const db = testDatabase();
  const id = randomUUID();
  const email = input.email ?? `creator-${id}@example.test`;
  const fullName = input.fullName ?? "Test Creator";
  const credits = input.credits ?? 1_000;
  const plan = input.plan ?? "free";
  await db.query(
    `INSERT INTO profiles (id, email, full_name, plan, credits, reserved_credits)
     VALUES ($1, $2, $3, $4, $5, 0)`,
    [id, email, fullName, plan, credits],
  );
  return { id, email, fullName, credits };
}

export async function getProfileBalance(
  ownerId: string,
): Promise<{ credits: number; reserved: number }> {
  const rows = await testDatabase().query<{ credits: number; reserved_credits: number }>(
    `SELECT credits, reserved_credits FROM profiles WHERE id = $1`,
    [ownerId],
  );
  if (rows.length === 0) throw new Error("Profile not found.");
  return { credits: Number(rows[0].credits), reserved: Number(rows[0].reserved_credits) };
}
