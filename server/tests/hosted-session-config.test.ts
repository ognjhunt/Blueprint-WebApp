// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CreateHostedSessionRequest } from "../types/hosted-session";
import { HostedSessionRuntimeError } from "../utils/hosted-session-runtime";
import {
  normalizeHostedSessionPolicy,
  normalizeRequestedOutputs,
} from "../utils/hosted-session-config";

function baseBody(overrides: Partial<CreateHostedSessionRequest> = {}): CreateHostedSessionRequest {
  return {
    siteWorldId: "site-world-1",
    robotProfileId: "profile-1",
    taskId: "task-1",
    scenarioId: "scenario-1",
    startStateId: "start-1",
    ...overrides,
  };
}

const DEFAULT_OUTPUTS = [
  "start_state",
  "task_summary",
  "scenario",
  "observation_frames",
  "action_trace",
  "step_count",
  "reward_score",
  "success_failure",
  "rollout_video",
  "export_bundle",
];

describe("normalizeRequestedOutputs", () => {
  it("returns the canonical default output set when none are requested", () => {
    expect(normalizeRequestedOutputs(baseBody())).toEqual(DEFAULT_OUTPUTS);
  });

  it("prefers requestedOutputs and trims/filters blank entries", () => {
    expect(
      normalizeRequestedOutputs(baseBody({ requestedOutputs: [" action_trace ", "", "reward_score"] })),
    ).toEqual(["action_trace", "reward_score"]);
  });

  it("falls back to exportModes when requestedOutputs is empty", () => {
    expect(
      normalizeRequestedOutputs(baseBody({ requestedOutputs: [], exportModes: ["export_bundle"] })),
    ).toEqual(["export_bundle"]);
  });

  it("ignores exportModes when requestedOutputs has entries", () => {
    expect(
      normalizeRequestedOutputs(baseBody({ requestedOutputs: ["scenario"], exportModes: ["export_bundle"] })),
    ).toEqual(["scenario"]);
  });
});

describe("normalizeHostedSessionPolicy", () => {
  it("returns an empty policy when no policy is supplied", () => {
    expect(normalizeHostedSessionPolicy(baseBody())).toEqual({});
  });

  it("passes through a policy that has no robot-team test submission", () => {
    const policy = { someFlag: true } as CreateHostedSessionRequest["policy"];
    expect(normalizeHostedSessionPolicy(baseBody({ policy }))).toEqual({ someFlag: true });
  });

  it("rejects a non-object robot-team test submission", () => {
    const policy = { robotTeamTestSubmission: "not-an-object" } as CreateHostedSessionRequest["policy"];
    expect(() => normalizeHostedSessionPolicy(baseBody({ policy }))).toThrowError(HostedSessionRuntimeError);
    try {
      normalizeHostedSessionPolicy(baseBody({ policy }));
    } catch (error) {
      expect((error as HostedSessionRuntimeError).code).toBe("invalid_robot_team_test_submission");
    }
  });

  it("requires at least one selected modality on a robot-team test submission", () => {
    const policy = { robotTeamTestSubmission: {} } as CreateHostedSessionRequest["policy"];
    try {
      normalizeHostedSessionPolicy(baseBody({ policy }));
      throw new Error("expected normalizeHostedSessionPolicy to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HostedSessionRuntimeError);
      expect((error as HostedSessionRuntimeError).code).toBe("robot_team_test_modality_required");
    }
  });
});
