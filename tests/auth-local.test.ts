import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = vi.hoisted(() => {
  const store = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return {
    store,
    cookies: async () => ({
      get: (name: string) =>
        store.has(name) ? { name, value: store.get(name)!.value } : undefined,
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        store.set(name, { value, options });
      },
      delete: (name: string) => {
        store.delete(name);
      },
      getAll: () => [...store.entries()].map(([name, entry]) => ({ name, value: entry.value })),
    }),
  };
});

vi.mock("next/headers", () => ({ cookies: cookieState.cookies }));

import {
  LOCAL_SESSION_COOKIE,
  changeLocalPassword,
  createLocalPasswordReset,
  getLocalSessionUser,
  loginLocal,
  registerLocal,
  resetLocalPassword,
} from "@/lib/auth/local";
import { signSession } from "@/lib/auth/crypto";
import { DEFAULT_CREDITS } from "@/lib/config";
import {
  resetTestDatabase,
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

beforeEach(async () => {
  cookieState.store.clear();
  await resetTestDatabase();
});

async function registerDemo() {
  return registerLocal({
    fullName: "Demo Director",
    email: "Demo@Example.Test",
    password: "demo-flow-1",
  });
}

describe("local registration and login", () => {
  it("creates a profile, credential, welcome grant and signed session", async () => {
    const user = await registerDemo();
    expect(user.email).toBe("demo@example.test");
    expect(user.credits).toBe(DEFAULT_CREDITS);
    expect(user.authMode).toBe("local");

    const session = cookieState.store.get(LOCAL_SESSION_COOKIE);
    expect(session?.value).toContain(".");
    expect(session?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });

    const current = await getLocalSessionUser();
    expect(current?.id).toBe(user.id);
    expect(current?.email).toBe("demo@example.test");

    const ledger = await testDatabase().query(
      `SELECT type, amount FROM credit_transactions WHERE owner_id = $1`,
      [user.id],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "grant", amount: DEFAULT_CREDITS });
  });

  it("only marks the session cookie secure when the app URL is https", async () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "http://10.175.11.18:3000";
      await registerDemo();
      expect(cookieState.store.get(LOCAL_SESSION_COOKIE)?.options).toMatchObject({
        secure: false,
      });

      cookieState.store.clear();
      process.env.NEXT_PUBLIC_APP_URL = "https://whisk-flow.example";
      await loginLocal("demo@example.test", "demo-flow-1");
      expect(cookieState.store.get(LOCAL_SESSION_COOKIE)?.options).toMatchObject({
        secure: true,
      });
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });

  it("rejects duplicate accounts regardless of email casing", async () => {
    await registerDemo();
    await expect(
      registerLocal({
        fullName: "Another Director",
        email: "DEMO@example.test",
        password: "another-pass-1",
      }),
    ).rejects.toMatchObject({ status: 409, code: "email_in_use" });
  });

  it("logs in with a normalized email and rejects a wrong password", async () => {
    const user = await registerDemo();
    cookieState.store.clear();

    await expect(loginLocal("DEMO@EXAMPLE.TEST", "wrong-password-1")).rejects.toMatchObject({
      status: 401,
    });
    const loggedIn = await loginLocal("DEMO@EXAMPLE.TEST", "demo-flow-1");
    expect(loggedIn.id).toBe(user.id);
    expect((await getLocalSessionUser())?.id).toBe(user.id);
  });

  it("rejects tampered, expired and version-mismatched session cookies", async () => {
    const user = await registerDemo();
    const token = cookieState.store.get(LOCAL_SESSION_COOKIE)!.value;

    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    cookieState.store.set(LOCAL_SESSION_COOKIE, { value: tampered });
    await expect(getLocalSessionUser()).resolves.toBeNull();

    const expired = await signSession({
      sub: user.id,
      version: 1,
      iat: Date.now() - 120_000,
      exp: Date.now() - 60_000,
    });
    cookieState.store.set(LOCAL_SESSION_COOKIE, { value: expired });
    await expect(getLocalSessionUser()).resolves.toBeNull();

    const wrongVersion = await signSession({
      sub: user.id,
      version: 99,
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    cookieState.store.set(LOCAL_SESSION_COOKIE, { value: wrongVersion });
    await expect(getLocalSessionUser()).resolves.toBeNull();
  });
});

describe("local password recovery and change", () => {
  it("resets a password, invalidates old sessions and consumes the token", async () => {
    const user = await registerDemo();
    const reset = await createLocalPasswordReset("DEMO@EXAMPLE.TEST");
    expect(reset.token).toBeTruthy();
    expect(reset.expiresAt).toBeTruthy();

    await resetLocalPassword(reset.token!, "new-password-2");
    expect(cookieState.store.get(LOCAL_SESSION_COOKIE)?.value).toBe("");

    await expect(loginLocal("demo@example.test", "demo-flow-1")).rejects.toMatchObject({
      status: 401,
    });
    const loggedIn = await loginLocal("demo@example.test", "new-password-2");
    expect(loggedIn.id).toBe(user.id);

    await expect(resetLocalPassword(reset.token!, "another-password-3")).rejects.toMatchObject({
      status: 400,
      code: "invalid_reset_token",
    });
  });

  it("does not reveal whether an email exists", async () => {
    const reset = await createLocalPasswordReset("missing@example.test");
    expect(reset).toEqual({ token: null, expiresAt: null });
  });

  it("changes a password and invalidates the previous session version", async () => {
    const user = await registerDemo();
    const oldToken = cookieState.store.get(LOCAL_SESSION_COOKIE)!.value;

    await expect(
      changeLocalPassword(user.id, "wrong-current-1", "new-password-2"),
    ).rejects.toMatchObject({ status: 400, code: "invalid_password" });

    await changeLocalPassword(user.id, "demo-flow-1", "new-password-2");
    const newToken = cookieState.store.get(LOCAL_SESSION_COOKIE)!.value;
    expect(newToken).not.toBe(oldToken);

    cookieState.store.set(LOCAL_SESSION_COOKIE, { value: oldToken });
    await expect(getLocalSessionUser()).resolves.toBeNull();
    cookieState.store.set(LOCAL_SESSION_COOKIE, { value: newToken });
    await expect(getLocalSessionUser()).resolves.toMatchObject({ id: user.id });

    await expect(loginLocal("demo@example.test", "demo-flow-1")).rejects.toMatchObject({
      status: 401,
    });
    await expect(loginLocal("demo@example.test", "new-password-2")).resolves.toMatchObject({
      id: user.id,
    });
  });
});
