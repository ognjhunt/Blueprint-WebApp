import { describe, expect, it, vi } from "vitest";
import {
  buildFounderIssueExceptionDigest,
  maybePostFounderException,
  type FounderVisibilityState,
} from "./founder-exceptions.js";

describe("founder exception dedupe", () => {
  it("suppresses duplicate blocked-issue alerts for the same issue within the cooldown window", async () => {
    let state: FounderVisibilityState | null = null;
    const postSlackDigest = vi.fn(async () => ({ ok: true }));
    const digest = buildFounderIssueExceptionDigest(
      {
        id: "iss-city-launch",
        title: "City Launch Weekly",
        status: "blocked",
        priority: "high",
      },
      "City Launch Agent",
      "Ops",
    );

    expect(digest).not.toBeNull();

    const deps = {
      readState: async () => state,
      writeState: async (next: FounderVisibilityState) => {
        state = next;
      },
      resolveSlackTargets: async () => ({
        exec: "https://hooks.slack.test/exec",
      }),
      postSlackDigest,
      now: new Date("2026-04-03T23:00:00.000Z"),
    };

    expect(await maybePostFounderException(digest!, deps)).toBe(true);
    expect(await maybePostFounderException(digest!, deps)).toBe(false);
    expect(postSlackDigest).toHaveBeenCalledTimes(1);
    expect((state as FounderVisibilityState | null)?.alerts[digest!.fingerprint]?.payloadHash).toBe(JSON.stringify(digest!.sections));
  });

  it("suppresses evidence-backed alerts until the evidence key changes", async () => {
    let state: FounderVisibilityState | null = null;
    const postSlackDigest = vi.fn(async () => ({ ok: true }));
    const baseDigest = {
      fingerprint: "founder-exception:queue:ops-review",
      category: "Queue Threshold",
      lane: "Ops" as const,
      title: "Founder Exception | Queue Threshold | Ops",
      sections: [
        { heading: "What Changed", items: ["ops-review crossed a configured founder visibility threshold."] },
      ],
      requireEvidence: true,
    };

    const deps = {
      readState: async () => state,
      writeState: async (next: FounderVisibilityState) => {
        state = next;
      },
      resolveSlackTargets: async () => ({
        exec: "https://hooks.slack.test/exec",
      }),
      postSlackDigest,
      now: new Date("2026-04-03T23:05:00.000Z"),
    };

    expect(await maybePostFounderException({ ...baseDigest, evidenceKey: "queue:ops-review:v1" }, deps)).toBe(true);
    expect(await maybePostFounderException({ ...baseDigest, evidenceKey: "queue:ops-review:v1" }, deps)).toBe(false);
    expect(await maybePostFounderException({ ...baseDigest, evidenceKey: "queue:ops-review:v2" }, deps)).toBe(true);
    expect(postSlackDigest).toHaveBeenCalledTimes(2);
  });
});
