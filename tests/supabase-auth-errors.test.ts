import { describe, expect, it } from "vitest";
import { supabaseAuthErrorMessage } from "@/lib/auth/supabase-errors";

describe("supabaseAuthErrorMessage", () => {
  it("asks unconfirmed users to verify their email", () => {
    expect(supabaseAuthErrorMessage({ code: "email_not_confirmed" }, "login")).toMatch(
      /Confirm your email/i,
    );
  });

  it("keeps invalid credentials generic", () => {
    expect(supabaseAuthErrorMessage({ code: "invalid_credentials" }, "login")).toBe(
      "The email or password is incorrect.",
    );
  });

  it("explains duplicate registration", () => {
    expect(supabaseAuthErrorMessage({ code: "user_already_exists" }, "register")).toMatch(
      /already exists/i,
    );
  });

  it("maps rate limits", () => {
    expect(supabaseAuthErrorMessage({ code: "over_email_send_rate_limit" }, "register")).toMatch(
      /Too many attempts/i,
    );
  });

  it("maps expired recovery sessions", () => {
    expect(supabaseAuthErrorMessage({ code: "refresh_token_not_found" }, "reset")).toMatch(
      /expired/i,
    );
  });

  it("understands older message-only errors", () => {
    expect(
      supabaseAuthErrorMessage({ message: "Email not confirmed" }, "login"),
    ).toMatch(/Confirm your email/i);
    expect(
      supabaseAuthErrorMessage({ message: "Invalid login credentials" }, "login"),
    ).toBe("The email or password is incorrect.");
  });

  it("does not expose unknown provider messages", () => {
    expect(
      supabaseAuthErrorMessage({ code: "unexpected_failure", message: "internal detail" }, "login"),
    ).toBe("The email or password is incorrect.");
    expect(
      supabaseAuthErrorMessage({ code: "unexpected_failure", message: "internal detail" }, "register"),
    ).toBe("We could not create your account. Please try again.");
  });
});
