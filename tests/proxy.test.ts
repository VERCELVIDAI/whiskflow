import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function redirectTarget(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!);
}

describe("proxy protected routes", () => {
  it("redirects anonymous visitors from protected studio routes", async () => {
    const response = await proxy(request("/projects/abc?tab=scenes"));
    expect(response.status).toBe(307);
    const target = redirectTarget(response);
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("next")).toBe("/projects/abc");
  });

  it("protects the home page and every workspace page", async () => {
    for (const path of ["/", "/create", "/media", "/templates", "/pricing", "/usage", "/settings", "/help"]) {
      const response = await proxy(request(path));
      expect(response.status, path).toBe(307);
      expect(redirectTarget(response).pathname).toBe("/login");
    }
  });

  it("allows public auth pages for anonymous visitors", async () => {
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password?token=abc"]) {
      const response = await proxy(request(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("allows sample assets and unknown public paths", async () => {
    for (const path of ["/samples/hero-studio.jpg", "/auth/callback?code=abc"]) {
      const response = await proxy(request(path));
      expect(response.status, path).toBe(200);
    }
  });

  it("lets a local session cookie through to studio routes", async () => {
    const response = await proxy(request("/projects", "wf_session=test-session"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect a local session away from auth pages", async () => {
    // A local cookie is only presence-checked by the proxy. Redirecting away
    // from /login when the cookie is stale would create a login loop.
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password"]) {
      const response = await proxy(request(path, "wf_session=test-session"));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("does not treat unrelated cookies as a session", async () => {
    const response = await proxy(request("/create", "theme=dark; another=value"));
    expect(response.status).toBe(307);
    expect(redirectTarget(response).pathname).toBe("/login");
  });
});
