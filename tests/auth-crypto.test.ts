import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  randomToken,
  signSession,
  verifyPassword,
  verifySession,
} from "@/lib/auth/crypto";

function payload(overrides: Partial<Parameters<typeof signSession>[0]> = {}) {
  return {
    sub: "7e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
    version: 1,
    iat: Date.now(),
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

describe("password hashing", () => {
  it("verifies the original password and rejects another", async () => {
    const encoded = await hashPassword("correct-horse-42");
    expect(encoded.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correct-horse-42", encoded)).resolves.toBe(true);
    await expect(verifyPassword("correct-horse-43", encoded)).resolves.toBe(false);
  });

  it("uses a fresh salt for every hash", async () => {
    const first = await hashPassword("same-password-1");
    const second = await hashPassword("same-password-1");
    expect(first).not.toBe(second);
    await expect(verifyPassword("same-password-1", first)).resolves.toBe(true);
    await expect(verifyPassword("same-password-1", second)).resolves.toBe(true);
  });

  it("rejects malformed encoded hashes", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt$bad$values")).resolves.toBe(false);
  });
});

describe("local session tokens", () => {
  it("signs and verifies a session", async () => {
    const token = await signSession(payload());
    const verified = await verifySession(token);
    expect(verified?.sub).toBe(payload().sub);
    expect(verified?.version).toBe(1);
  });

  it("rejects a token with a modified payload", async () => {
    const token = await signSession(payload());
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify(payload({ sub: "00000000-0000-4000-8000-000000000000" })),
      "utf8",
    ).toString("base64url");
    await expect(verifySession(`${forgedBody}.${signature}`)).resolves.toBeNull();
  });

  it("rejects a token with a modified signature", async () => {
    const token = await signSession(payload());
    const [body, signature] = token.split(".");
    const changed = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    await expect(verifySession(`${body}.${changed}`)).resolves.toBeNull();
  });

  it("rejects expired and malformed tokens", async () => {
    const expired = await signSession(payload({ exp: Date.now() - 1_000 }));
    await expect(verifySession(expired)).resolves.toBeNull();
    await expect(verifySession(undefined)).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
    await expect(verifySession("only-a-body")).resolves.toBeNull();
    await expect(verifySession("a.b.c")).resolves.toBeNull();
  });

  it("creates opaque reset tokens and stable hashes", () => {
    const token = randomToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(randomToken()));
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
