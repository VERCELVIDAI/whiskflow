import "server-only";
import { cookies } from "next/headers";
import { getDatabase, isUniqueViolation } from "@/lib/db";
import { mapProfile } from "@/lib/data/mappers";
import { AppError, UnauthorizedError } from "@/lib/errors";
import type { AppUser } from "@/lib/types";
import { DEFAULT_CREDITS, appUrl } from "@/lib/config";
import {
  hashPassword,
  hashToken,
  randomToken,
  signSession,
  verifyPassword,
  verifySession,
} from "@/lib/auth/crypto";

export const LOCAL_SESSION_COOKIE = "wf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface LocalCredentialRow {
  user_id: string;
  password_hash: string;
  email_verified: boolean;
  session_version: number;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure cookies are rejected over plain HTTP. Base this on the configured
    // public origin instead of NODE_ENV, so `next start` on http://localhost
    // (or a LAN address) can still sign users in.
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function setLocalSession(userId: string, version = 1): Promise<void> {
  const token = await signSession({
    sub: userId,
    version,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  });
  const store = await cookies();
  store.set(LOCAL_SESSION_COOKIE, token, cookieOptions());
}

export async function clearLocalSession(): Promise<void> {
  const store = await cookies();
  store.set(LOCAL_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function getLocalSessionUser(): Promise<AppUser | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(LOCAL_SESSION_COOKIE)?.value);
  if (!payload) return null;

  const db = await getDatabase();
  const rows = await db.query(
    `SELECT p.*, c.session_version
     FROM profiles p
     JOIN local_credentials c ON c.user_id = p.id
     WHERE p.id = $1
     LIMIT 1`,
    [payload.sub],
  );
  const row = rows[0];
  if (!row) return null;
  const version = Number(row.session_version);
  if (!Number.isInteger(version) || version !== payload.version) return null;
  const profile = mapProfile(row);
  return { ...profile, authMode: "local" };
}

export async function registerLocal(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  const db = await getDatabase();
  const email = input.email.trim().toLowerCase();
  const existing = await db.query(`SELECT id FROM profiles WHERE email = $1 LIMIT 1`, [email]);
  if (existing.length > 0) {
    throw new AppError(409, "email_in_use", "An account already exists for this email.");
  }

  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO profiles (id, email, full_name, plan, credits, reserved_credits)
         VALUES ($1, $2, $3, 'free', $4, 0)`,
        [id, email, input.fullName, DEFAULT_CREDITS],
      );
      await tx.query(
        `INSERT INTO local_credentials (user_id, password_hash, email_verified, session_version)
         VALUES ($1, $2, TRUE, 1)`,
        [id, passwordHash],
      );
      await tx.query(
        `INSERT INTO credit_transactions
           (id, owner_id, type, amount, reserved_delta, balance_after, description, metadata)
         VALUES ($1, $2, 'grant', $3, 0, $4, $5, $6::jsonb)`,
        [
          crypto.randomUUID(),
          id,
          DEFAULT_CREDITS,
          DEFAULT_CREDITS,
          "Welcome credits",
          JSON.stringify({ source: "signup" }),
        ],
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "email_in_use", "An account already exists for this email.");
    }
    throw error;
  }

  await setLocalSession(id, 1);
  return {
    id,
    email,
    fullName: input.fullName,
    avatarUrl: null,
    plan: "free",
    credits: DEFAULT_CREDITS,
    reservedCredits: 0,
    createdAt: new Date().toISOString(),
    authMode: "local",
  };
}

export async function loginLocal(email: string, password: string): Promise<AppUser> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT p.*, c.password_hash, c.session_version
     FROM profiles p
     JOIN local_credentials c ON c.user_id = p.id
     WHERE p.email = $1
     LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row) {
    throw new UnauthorizedError("The email or password is incorrect.");
  }
  const credential: LocalCredentialRow = {
    user_id: String(row.id),
    password_hash: String(row.password_hash),
    email_verified: Boolean(row.email_verified),
    session_version: Number(row.session_version),
  };
  const valid = await verifyPassword(password, credential.password_hash);
  if (!valid) {
    throw new UnauthorizedError("The email or password is incorrect.");
  }
  await setLocalSession(credential.user_id, credential.session_version);
  const profile = mapProfile(row);
  return { ...profile, authMode: "local" };
}

export async function createLocalPasswordReset(email: string): Promise<{
  token: string | null;
  expiresAt: string | null;
}> {
  const db = await getDatabase();
  const rows = await db.query(`SELECT id FROM profiles WHERE email = $1 LIMIT 1`, [
    email.trim().toLowerCase(),
  ]);
  if (rows.length === 0) {
    // Do not reveal whether an account exists.
    return { token: null, expiresAt: null };
  }
  const userId = String(rows[0].id);
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
  await db.query(`DELETE FROM local_password_resets WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  await db.query(
    `INSERT INTO local_password_resets (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, userId, expiresAt],
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function resetLocalPassword(token: string, password: string): Promise<void> {
  const db = await getDatabase();
  const tokenHash = hashToken(token);
  const rows = await db.query(
    `SELECT user_id FROM local_password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  if (rows.length === 0) {
    throw new AppError(400, "invalid_reset_token", "This reset link is invalid or has expired.");
  }
  const userId = String(rows[0].user_id);
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE local_credentials
       SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
       WHERE user_id = $2`,
      [passwordHash, userId],
    );
    await tx.query(`UPDATE local_password_resets SET used_at = NOW() WHERE token_hash = $1`, [
      tokenHash,
    ]);
  });
  await clearLocalSession();
}

export async function verifyLocalPassword(userId: string, password: string): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT password_hash FROM local_credentials WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (rows.length === 0) return false;
  return verifyPassword(password, String(rows[0].password_hash));
}

export async function changeLocalPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!(await verifyLocalPassword(userId, currentPassword))) {
    throw new AppError(400, "invalid_password", "Your current password is incorrect.");
  }
  const passwordHash = await hashPassword(newPassword);
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE local_credentials
     SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING session_version`,
    [passwordHash, userId],
  );
  await setLocalSession(userId, Number(rows[0]?.session_version ?? 2));
}
