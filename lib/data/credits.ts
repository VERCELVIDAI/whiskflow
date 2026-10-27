import "server-only";
import { getDatabase, type DbClient } from "@/lib/db";
import { mapJob, mapProfile, mapTransaction } from "@/lib/data/mappers";
import { InsufficientCreditsError, NotFoundError } from "@/lib/errors";
import type { UsageSummary } from "@/lib/types";

async function lockedBalance(tx: DbClient, ownerId: string): Promise<{ credits: number; reserved: number }> {
  const rows = await tx.query<{ credits: number; reserved_credits: number }>(
    `SELECT credits, reserved_credits FROM profiles WHERE id = $1 FOR UPDATE`,
    [ownerId],
  );
  if (rows.length === 0) throw new NotFoundError("Profile not found.");
  return { credits: Number(rows[0].credits), reserved: Number(rows[0].reserved_credits) };
}

export async function reserveCreditsTx(
  tx: DbClient,
  input: { ownerId: string; amount: number; generationId: string; description: string },
): Promise<{ balance: number; reserved: number }> {
  const amount = Math.max(1, Math.round(input.amount));
  const balance = await lockedBalance(tx, input.ownerId);
  const available = balance.credits - balance.reserved;
  if (available < amount) {
    throw new InsufficientCreditsError(amount, available);
  }
  await tx.query(
    `UPDATE profiles SET reserved_credits = reserved_credits + $1, updated_at = NOW() WHERE id = $2`,
    [amount, input.ownerId],
  );
  await tx.query(
    `INSERT INTO credit_transactions
       (id, owner_id, generation_id, type, amount, reserved_delta, balance_after, description, metadata)
     VALUES ($1, $2, $3, 'reservation', 0, $4, $5, $6, $7::jsonb)`,
    [
      crypto.randomUUID(),
      input.ownerId,
      input.generationId,
      amount,
      balance.credits,
      input.description,
      JSON.stringify({ availableBefore: available }),
    ],
  );
  return { balance: balance.credits, reserved: balance.reserved + amount };
}

export async function captureCreditsTx(
  tx: DbClient,
  input: { ownerId: string; amount: number; generationId: string; description: string },
): Promise<void> {
  const amount = Math.max(1, Math.round(input.amount));
  const balance = await lockedBalance(tx, input.ownerId);
  const reservedCharge = Math.min(amount, balance.reserved);
  await tx.query(
    `UPDATE profiles
     SET credits = GREATEST(0, credits - $1),
         reserved_credits = GREATEST(0, reserved_credits - $2),
         updated_at = NOW()
     WHERE id = $3`,
    [amount, reservedCharge, input.ownerId],
  );
  await tx.query(
    `INSERT INTO credit_transactions
       (id, owner_id, generation_id, type, amount, reserved_delta, balance_after, description, metadata)
     VALUES ($1, $2, $3, 'charge', $4, $5, $6, $7, $8::jsonb)`,
    [
      crypto.randomUUID(),
      input.ownerId,
      input.generationId,
      -amount,
      -reservedCharge,
      Math.max(0, balance.credits - amount),
      input.description,
      JSON.stringify({ captured: amount }),
    ],
  );
}

export async function releaseCreditsTx(
  tx: DbClient,
  input: { ownerId: string; amount: number; generationId: string; description: string },
): Promise<void> {
  const amount = Math.max(1, Math.round(input.amount));
  const balance = await lockedBalance(tx, input.ownerId);
  const release = Math.min(amount, balance.reserved);
  if (release <= 0) return;
  await tx.query(
    `UPDATE profiles SET reserved_credits = GREATEST(0, reserved_credits - $1), updated_at = NOW() WHERE id = $2`,
    [release, input.ownerId],
  );
  await tx.query(
    `INSERT INTO credit_transactions
       (id, owner_id, generation_id, type, amount, reserved_delta, balance_after, description, metadata)
     VALUES ($1, $2, $3, 'release', 0, $4, $5, $6, $7::jsonb)`,
    [
      crypto.randomUUID(),
      input.ownerId,
      input.generationId,
      -release,
      balance.credits,
      input.description,
      JSON.stringify({ released: release }),
    ],
  );
}

export async function grantCreditsTx(
  tx: DbClient,
  input: {
    ownerId: string;
    amount: number;
    description: string;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const amount = Math.max(1, Math.round(input.amount));
  const balance = await lockedBalance(tx, input.ownerId);
  const nextBalance = balance.credits + amount;
  await tx.query(`UPDATE profiles SET credits = credits + $1, updated_at = NOW() WHERE id = $2`, [
    amount,
    input.ownerId,
  ]);
  await tx.query(
    `INSERT INTO credit_transactions
       (id, owner_id, type, amount, reserved_delta, balance_after, description, metadata)
     VALUES ($1, $2, 'grant', $3, 0, $4, $5, $6::jsonb)`,
    [
      crypto.randomUUID(),
      input.ownerId,
      amount,
      nextBalance,
      input.description,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return nextBalance;
}

export async function grantCredits(
  ownerId: string,
  amount: number,
  description: string,
): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    await grantCreditsTx(tx, { ownerId, amount, description });
  });
}

export async function getUsage(ownerId: string): Promise<UsageSummary> {
  const db = await getDatabase();
  const profileRows = await db.query(`SELECT * FROM profiles WHERE id = $1 LIMIT 1`, [ownerId]);
  if (profileRows.length === 0) throw new NotFoundError("Profile not found.");
  const profile = mapProfile(profileRows[0]);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [transactionRows, jobRows, spendRows, kindRows] = await Promise.all([
    db.query(
      `SELECT * FROM credit_transactions WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 60`,
      [ownerId],
    ),
    db.query(
      `SELECT * FROM generation_jobs WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [ownerId],
    ),
    db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'charge' THEN -amount ELSE 0 END), 0)::int AS spent,
         COALESCE(SUM(CASE WHEN type = 'grant' THEN amount ELSE 0 END), 0)::int AS granted
       FROM credit_transactions WHERE owner_id = $1 AND created_at >= $2`,
      [ownerId, monthStart],
    ),
    db.query(
      `SELECT kind, COUNT(*)::int AS count, COALESCE(SUM(credits_reserved), 0)::int AS credits
       FROM generation_jobs WHERE owner_id = $1 AND created_at >= $2
       GROUP BY kind ORDER BY kind`,
      [ownerId, monthStart],
    ),
  ]);

  const spend = spendRows[0] ?? { spent: 0, granted: 0 };
  return {
    balance: profile.credits,
    reserved: profile.reservedCredits,
    spentThisMonth: Number(spend.spent ?? 0),
    grantedThisMonth: Number(spend.granted ?? 0),
    generationsThisMonth: jobRows.filter(
      (row) => new Date(String(row.created_at)).getTime() >= monthStart.getTime(),
    ).length,
    byKind: kindRows.map((row) => ({
      kind: String(row.kind),
      count: Number(row.count ?? 0),
      credits: Number(row.credits ?? 0),
    })),
    transactions: transactionRows.map(mapTransaction),
    jobs: jobRows.map(mapJob),
  };
}
