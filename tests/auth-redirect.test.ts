import { describe, expect, it } from "vitest";
import { isSignedInRedirectPath, safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/projects/abc?tab=scenes")).toBe("/projects/abc?tab=scenes");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });

  it("defaults to the studio home when no destination is supplied", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example/path")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("reset-password")).toBe("/");
  });

  it("uses a custom fallback when provided", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
  });
});

describe("isSignedInRedirectPath", () => {
  it("covers the sign-in entry pages", () => {
    expect(isSignedInRedirectPath("/login")).toBe(true);
    expect(isSignedInRedirectPath("/register")).toBe(true);
    expect(isSignedInRedirectPath("/forgot-password")).toBe(true);
  });

  it("does not redirect the recovery page", () => {
    expect(isSignedInRedirectPath("/reset-password")).toBe(false);
    expect(isSignedInRedirectPath("/")).toBe(false);
  });
});
