import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: authState.user }, error: null }),
    },
  }),
}));

import { proxy } from "../proxy";

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

function redirectTarget(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  authState.user = null;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});

describe("proxy with Supabase auth", () => {
  it("redirects anonymous visitors from protected routes", async () => {
    const response = await proxy(request("/projects"));
    expect(response.status).toBe(307);
    expect(redirectTarget(response).pathname).toBe("/login");
  });

  it("redirects signed-in users away from login, register and forgot-password", async () => {
    authState.user = { id: "user-1" };
    for (const path of ["/login", "/register", "/forgot-password"]) {
      const response = await proxy(request(path));
      expect(response.status, path).toBe(307);
      expect(redirectTarget(response).pathname).toBe("/");
    }
  });

  it("keeps the reset page reachable while the recovery session exists", async () => {
    authState.user = { id: "user-1" };
    const response = await proxy(request("/reset-password"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
