// @vitest-environment node
/**
 * The production redirect guard.
 *
 * The redirect exists so a live pipeline can be exercised without mailing the
 * leads in it, and its whole danger is outliving that exercise. These tests pin
 * the two halves of that bargain: in production it engages only inside a
 * declared window, and when the window is absent, unparseable, closed, or
 * suspiciously long, mail goes to its real recipients rather than being held.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function resolve(to: string) {
  const { resolveTestRedirect } = await import("../utils/email");
  return resolveTestRedirect(to);
}

const LEAD = "operator@warehouse.example";
const INBOX = "tester@blueprint.example";

describe("outside production", () => {
  it("redirects on the target address alone", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT", INBOX);

    expect(await resolve(LEAD)).toEqual({ to: INBOX, redirectedFrom: LEAD });
  });

  it("leaves mail alone when no target is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT", "");

    expect(await resolve(LEAD)).toEqual({ to: LEAD });
  });

  it("does not stamp a subject when the mail was already going to the inbox", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT", INBOX);

    // No `redirectedFrom`, so `sendEmail` leaves the subject as written.
    expect(await resolve(INBOX)).toEqual({ to: INBOX });
  });
});

describe("in production", () => {
  const NOW = new Date("2026-09-11T12:00:00.000Z");

  function armUntil(value: string) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT", INBOX);
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL", value);
  }

  it("redirects inside a declared window", async () => {
    armUntil("2026-09-13T12:00:00.000Z");

    expect(await resolve(LEAD)).toEqual({ to: INBOX, redirectedFrom: LEAD });
  });

  it("lets mail through when the window is not declared", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT", INBOX);
    vi.stubEnv("BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL", "");

    // The target alone is not enough here. Setting it and believing mail is
    // being held is the exact mistake this guard exists to make impossible.
    expect(await resolve(LEAD)).toEqual({ to: LEAD });
  });

  it("lets mail through once the window has closed", async () => {
    armUntil("2026-09-11T11:59:59.000Z");

    // Fail open to sending, not closed to silence: delivering mail is the
    // system's job and the redirect is the exception to it.
    expect(await resolve(LEAD)).toEqual({ to: LEAD });
  });

  it("refuses a window further out than fourteen days", async () => {
    armUntil("2026-12-31T00:00:00.000Z");

    // A date far enough out is a boolean flag wearing a timestamp.
    expect(await resolve(LEAD)).toEqual({ to: LEAD });
  });

  it("accepts a window at the fourteen-day edge", async () => {
    armUntil("2026-09-25T12:00:00.000Z");

    expect(await resolve(LEAD)).toEqual({ to: INBOX, redirectedFrom: LEAD });
  });

  it("refuses a window it cannot parse", async () => {
    armUntil("next friday");

    expect(await resolve(LEAD)).toEqual({ to: LEAD });
  });
});
