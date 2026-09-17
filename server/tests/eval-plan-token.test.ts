// @vitest-environment node
/**
 * The plan a team saw, pinned so confirm reserves it and not something else.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEvalPlanToken, verifyEvalPlanToken } from "../utils/evalPlanToken";

const FOR = { teamId: "team-1", checkpointId: "ckpt-1" };
const LINES = [
  { sceneId: "site-a", costUsd: 25 },
  { sceneId: "site-b", costUsd: 25 },
];

afterEach(() => vi.useRealTimers());

describe("a plan token round-trips for the team and checkpoint it was issued for", () => {
  it("returns the lines it signed", () => {
    const token = createEvalPlanToken({ ...FOR, lines: LINES });
    expect(verifyEvalPlanToken(token, FOR)).toEqual(LINES);
  });

  it("refuses a token replayed against a different team", () => {
    const token = createEvalPlanToken({ ...FOR, lines: LINES });
    expect(verifyEvalPlanToken(token, { ...FOR, teamId: "team-2" })).toBeNull();
  });

  it("refuses a token replayed against a different checkpoint", () => {
    const token = createEvalPlanToken({ ...FOR, lines: LINES });
    expect(verifyEvalPlanToken(token, { ...FOR, checkpointId: "ckpt-2" })).toBeNull();
  });

  it("refuses a token whose lines were edited", () => {
    const token = createEvalPlanToken({ ...FOR, lines: LINES });
    const [encoded, signature] = token.split(".");
    const json = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    json.lines.push({ sceneId: "site-c", costUsd: 25 });
    const tampered = `${Buffer.from(JSON.stringify(json), "utf-8").toString("base64url")}.${signature}`;
    expect(verifyEvalPlanToken(tampered, FOR)).toBeNull();
  });

  it("refuses an expired plan, because supply moves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
    const token = createEvalPlanToken({ ...FOR, lines: LINES, ttlSeconds: 60 });
    vi.setSystemTime(new Date("2026-09-17T00:02:00Z"));
    expect(verifyEvalPlanToken(token, FOR)).toBeNull();
  });

  it("returns an empty list for a plan that selected nothing", () => {
    const token = createEvalPlanToken({ ...FOR, lines: [] });
    expect(verifyEvalPlanToken(token, FOR)).toEqual([]);
  });

  it("rejects a malformed token rather than throwing", () => {
    expect(verifyEvalPlanToken("not-a-token", FOR)).toBeNull();
    expect(verifyEvalPlanToken("", FOR)).toBeNull();
  });
});
