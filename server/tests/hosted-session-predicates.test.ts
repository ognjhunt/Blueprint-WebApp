// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { HostedSessionRecord } from "../types/hosted-session";
import {
  isPublicDemoSession,
  isPublicDemoSiteWorldId,
  isReusablePresentationSession,
  isSessionExpired,
  normalizeSessionMode,
  presentationSessionKey,
  sessionUsesPresentationDemo,
} from "../utils/hosted-session-predicates";

function session(parts: {
  sessionMode?: HostedSessionRecord["sessionMode"];
  status?: HostedSessionRecord["status"];
  uid?: string;
  siteWorldId?: string;
  expiresAt?: string | null;
}): HostedSessionRecord {
  return {
    sessionMode: parts.sessionMode ?? "presentation_demo",
    status: parts.status ?? "running",
    createdBy: { uid: parts.uid ?? "user-1" },
    site: { siteWorldId: parts.siteWorldId ?? "world-1" },
    presentationRuntime: parts.expiresAt === undefined ? undefined : { expiresAt: parts.expiresAt },
  } as unknown as HostedSessionRecord;
}

describe("normalizeSessionMode", () => {
  it("returns presentation_demo only for the exact literal, else runtime_only", () => {
    expect(normalizeSessionMode("presentation_demo")).toBe("presentation_demo");
    expect(normalizeSessionMode("runtime_only")).toBe("runtime_only");
    expect(normalizeSessionMode("anything-else")).toBe("runtime_only");
    expect(normalizeSessionMode(undefined)).toBe("runtime_only");
    expect(normalizeSessionMode(null)).toBe("runtime_only");
  });
});

describe("sessionUsesPresentationDemo", () => {
  it("is true only for presentation_demo sessions", () => {
    expect(sessionUsesPresentationDemo(session({ sessionMode: "presentation_demo" }))).toBe(true);
    expect(sessionUsesPresentationDemo(session({ sessionMode: "runtime_only" }))).toBe(false);
  });
});

describe("isSessionExpired", () => {
  it("is true when the presentation runtime expiry is in the past", () => {
    expect(isSessionExpired(session({ expiresAt: new Date(Date.now() - 10_000).toISOString() }))).toBe(true);
  });

  it("is false for a future expiry or no expiry", () => {
    expect(isSessionExpired(session({ expiresAt: new Date(Date.now() + 100_000).toISOString() }))).toBe(false);
    expect(isSessionExpired(session({ expiresAt: null }))).toBe(false);
    expect(isSessionExpired(session({}))).toBe(false);
  });
});

describe("isReusablePresentationSession", () => {
  const uid = "user-1";
  const world = "world-1";
  const future = new Date(Date.now() + 100_000).toISOString();

  it("is true for a live, owned, matching presentation demo session", () => {
    expect(
      isReusablePresentationSession(session({ uid, siteWorldId: world, expiresAt: future }), uid, world),
    ).toBe(true);
  });

  it("is false on any disqualifying condition", () => {
    expect(
      isReusablePresentationSession(session({ sessionMode: "runtime_only", uid, siteWorldId: world }), uid, world),
    ).toBe(false);
    expect(isReusablePresentationSession(session({ uid: "other", siteWorldId: world }), uid, world)).toBe(false);
    expect(isReusablePresentationSession(session({ uid, siteWorldId: "other" }), uid, world)).toBe(false);
    expect(
      isReusablePresentationSession(session({ uid, siteWorldId: world, status: "stopped" }), uid, world),
    ).toBe(false);
    expect(
      isReusablePresentationSession(session({ uid, siteWorldId: world, status: "failed" }), uid, world),
    ).toBe(false);
    expect(
      isReusablePresentationSession(
        session({ uid, siteWorldId: world, expiresAt: new Date(Date.now() - 1_000).toISOString() }),
        uid,
        world,
      ),
    ).toBe(false);
  });
});

describe("presentationSessionKey", () => {
  it("joins uid and site world id with a colon", () => {
    expect(presentationSessionKey("u", "w")).toBe("u:w");
  });
});

describe("public demo predicates", () => {
  it("rejects unknown site world ids and null sessions", () => {
    expect(isPublicDemoSiteWorldId("definitely-not-a-demo-world")).toBe(false);
    expect(isPublicDemoSiteWorldId("   ")).toBe(false);
    expect(isPublicDemoSession(null)).toBe(false);
    expect(isPublicDemoSession(session({ siteWorldId: "definitely-not-a-demo-world" }))).toBe(false);
  });
});
