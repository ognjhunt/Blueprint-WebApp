import type {
  CreateHostedSessionRequest,
  HostedRuntimeSessionConfig,
  HostedSessionRecord,
} from "../types/hosted-session";
import { HostedSessionRuntimeError, type HostedRuntimeResolution } from "./hosted-session-runtime";
import { normalizeRobotTeamTestSubmission } from "../../client/src/lib/robotTeamTestSubmission";

/**
 * Pure request-normalization helpers for hosted session creation.
 *
 * Each function maps an inbound {@link CreateHostedSessionRequest} (plus the
 * resolved runtime for the requested site world) into the validated shape that
 * gets persisted on a {@link HostedSessionRecord}. They contain no I/O and no
 * dependency on route-level mutable state, so they live here rather than in the
 * route module.
 */

export function normalizeRobotProfile(
  body: CreateHostedSessionRequest,
  runtime: HostedRuntimeResolution,
): NonNullable<HostedSessionRecord["robotProfile"]> {
  const selected = runtime.robotProfiles.find((item) => item.id === body.robotProfileId);
  if (!selected) {
    throw new HostedSessionRuntimeError(
      "unsupported_robot_profile",
      `Robot profile ${body.robotProfileId} is not available for this site.`,
    );
  }
  return {
    ...selected,
    ...body.robotProfileOverride,
    observationCameras: body.robotProfileOverride?.observationCameras || selected.observationCameras,
    actionSpace: body.robotProfileOverride?.actionSpace || selected.actionSpace,
    actionSpaceSummary:
      body.robotProfileOverride?.actionSpaceSummary
      || selected.actionSpaceSummary
      || "Bounded robot action vector for hosted rollout execution.",
  };
}

export function normalizeTaskSelection(
  body: CreateHostedSessionRequest,
  runtime: HostedRuntimeResolution,
): NonNullable<HostedSessionRecord["taskSelection"]> {
  const task = runtime.taskCatalog.find((item) => item.id === body.taskId);
  if (!task) {
    throw new HostedSessionRuntimeError("unsupported_task", `Task ${body.taskId} is not available for this site.`);
  }
  return {
    taskText: task.taskText,
    taskId: task.id,
  };
}

export function normalizeRuntimeConfig(
  body: CreateHostedSessionRequest,
  runtime: HostedRuntimeResolution,
): NonNullable<HostedSessionRecord["runtimeConfig"]> {
  if (!runtime.scenarioCatalog.find((item) => item.id === body.scenarioId)) {
    throw new HostedSessionRuntimeError(
      "unsupported_scenario",
      `Scenario ${body.scenarioId} is not available for this site.`,
    );
  }
  if (!runtime.startStateCatalog.find((item) => item.id === body.startStateId)) {
    throw new HostedSessionRuntimeError(
      "unsupported_start_state",
      `Start state ${body.startStateId} is not available for this site.`,
    );
  }
  const requestedBackend = String(body.requestedBackend || runtime.defaultRuntimeBackend || "").trim() || runtime.defaultRuntimeBackend;
  if (
    requestedBackend
    && Array.isArray(runtime.availableRuntimeBackends)
    && runtime.availableRuntimeBackends.length > 0
    && !runtime.availableRuntimeBackends.includes(requestedBackend)
  ) {
    throw new HostedSessionRuntimeError(
      "unsupported_backend",
      `Backend ${requestedBackend} is not available for this site.`,
    );
  }
  return {
    scenarioId: String(body.scenarioId),
    startStateId: String(body.startStateId),
    seed: typeof body.seed === "number" && Number.isFinite(body.seed) ? body.seed : null,
    requestedBackend,
  };
}

export function normalizeRuntimeSessionConfig(
  body: CreateHostedSessionRequest,
  runtime: HostedRuntimeResolution,
): HostedRuntimeSessionConfig {
  const runtimeSessionConfig = body.runtimeSessionConfig || {};
  const normalizeOptional = (value: unknown) => String(value || "").trim() || null;

  return {
    canonical_package_uri:
      normalizeOptional(runtimeSessionConfig.canonical_package_uri)
      || runtime.registeredCanonicalPackageUri
      || runtime.resolvedArtifactCanonicalUri,
    canonical_package_version:
      normalizeOptional(runtimeSessionConfig.canonical_package_version) || runtime.registeredCanonicalPackageVersion,
    prompt: normalizeOptional(runtimeSessionConfig.prompt),
    trajectory: normalizeOptional(runtimeSessionConfig.trajectory),
    presentation_model: normalizeOptional(runtimeSessionConfig.presentation_model),
    debug_mode: runtimeSessionConfig.debug_mode === true,
    unsafe_allow_blocked_site_world:
      runtimeSessionConfig.unsafe_allow_blocked_site_world === true || runtime.allowBlockedSiteWorld === true,
  };
}

export function normalizeRequestedOutputs(body: CreateHostedSessionRequest) {
  if (Array.isArray(body.requestedOutputs) && body.requestedOutputs.length > 0) {
    return body.requestedOutputs.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (Array.isArray(body.exportModes) && body.exportModes.length > 0) {
    return body.exportModes.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return ["start_state", "task_summary", "scenario", "observation_frames", "action_trace", "step_count", "reward_score", "success_failure", "rollout_video", "export_bundle"];
}

export function normalizeHostedSessionPolicy(
  body: CreateHostedSessionRequest,
): HostedSessionRecord["policy"] {
  const policy =
    body.policy && typeof body.policy === "object" && !Array.isArray(body.policy)
      ? { ...(body.policy as Record<string, unknown>) }
      : {};
  if (!Object.prototype.hasOwnProperty.call(policy, "robotTeamTestSubmission")) {
    return policy;
  }

  const submission = normalizeRobotTeamTestSubmission(policy.robotTeamTestSubmission);
  if (!submission) {
    throw new HostedSessionRuntimeError(
      "invalid_robot_team_test_submission",
      "policy.robotTeamTestSubmission must be an object that matches the robot-team test submission schema.",
    );
  }
  if (submission.selectedModalities.length === 0) {
    throw new HostedSessionRuntimeError(
      "robot_team_test_modality_required",
      "Select at least one robot-team test submission modality before creating a hosted session.",
    );
  }

  return {
    ...policy,
    robotTeamTestSubmission: submission,
  };
}
