import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { mapAuthError } from "./map-auth-error";

// mapAuthError is the part of the sign-in/sign-up action flow pure
// enough to unit test directly — signIn/signUp themselves call
// redirect() (a Next.js control-flow throw) and a real Supabase client,
// which belong in integration/E2E coverage instead. These focus on the
// honesty contract: only branch on fields Supabase's AuthError really
// carries, and never claim more than the SDK told us (no
// account-enumeration leak on either sign-in or sign-up).
describe("mapAuthError", () => {
  it("reports rate limiting from a 429 status", () => {
    const error = new AuthError("Request rate limit reached", 429, "over_request_rate_limit");
    expect(mapAuthError(error, "signIn")).toBe("Too many attempts. Wait a moment and try again.");
  });

  it("reports rate limiting from an email-send rate-limit code even without a matching status", () => {
    const error = new AuthError("Email rate limit exceeded", undefined, "over_email_send_rate_limit");
    expect(mapAuthError(error, "signUp")).toBe("Too many attempts. Wait a moment and try again.");
  });

  it("reports a network/server failure for a retryable fetch error", () => {
    const error = new AuthError("fetch failed", undefined, undefined);
    error.name = "AuthRetryableFetchError";
    expect(mapAuthError(error, "signIn")).toBe("Could not reach the server. Check your connection and try again.");
  });

  it("gives a specific message for an unconfirmed email on sign-in", () => {
    const error = new AuthError("Email not confirmed", 400, "email_not_confirmed");
    expect(mapAuthError(error, "signIn")).toBe(
      "Confirm your email before signing in. Check your inbox for the confirmation link from Crado.",
    );
  });

  it("does not disclose account existence for invalid sign-in credentials", () => {
    const error = new AuthError("Invalid login credentials", 400, "invalid_credentials");
    expect(mapAuthError(error, "signIn")).toBe("Could not sign in. Check your email and password.");
  });

  it("surfaces the real password-policy message on a weak sign-up password", () => {
    const error = new AuthError("Password should be at least 8 characters.", 422, "weak_password");
    expect(mapAuthError(error, "signUp")).toBe("Password should be at least 8 characters.");
  });

  it("falls back to a generic, non-enumerating message for an unrecognized sign-up error", () => {
    const error = new AuthError("Something else went wrong", 500, "unexpected_failure");
    expect(mapAuthError(error, "signUp")).toBe("Could not create an account with those details.");
  });
});
