// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { HostedSessionLaunchBlockerDetail, HostedSessionRecord } from "../types/hosted-session";
import { HostedSessionRuntimeError } from "../utils/hosted-session-runtime";
import {
  appendCanonicalPackageMismatch,
  buildFailureDiagnostic,
  hostedAccessStatus,
  hostedRuntimeEntitlementIds,
  hostedSessionEntitlementIds,
  isHostedAccessError,
  selectLaunchReadinessBlockerCode,
} from "../utils/hosted-session-route-helpers";

describe("hosted-session route helpers", () => {
  it("maps only hosted-access runtime errors to protected route statuses", () => {
    const unauthorized = new HostedSessionRuntimeError("unauthorized", "Missing authenticated user.");
    const denied = new HostedSessionRuntimeError("session_access_denied", "Session access denied.");
    const notFound = new HostedSessionRuntimeError("site_not_found", "Site world not found.");

    expect(isHostedAccessError(unauthorized)).toBe(true);
    expect(isHostedAccessError(denied)).toBe(true);
    expect(isHostedAccessError(notFound)).toBe(false);
    expect(isHostedAccessError(new Error("plain error"))).toBe(false);

    expect(hostedAccessStatus(unauthorized)).toBe(401);
    expect(hostedAccessStatus(denied)).toBe(403);
  });

  it("preserves entitlement candidate order for session and runtime launch checks", () => {
    const session = {
      site: {
        siteWorldId: "sw-chi-01",
        scene_id: "scene-1",
        capture_id: "capture-1",
        site_submission_id: "submission-1",
      },
      siteModel: {
        siteWorldId: "siteworld-1",
        sceneId: "scene-model-1",
        captureId: "capture-model-1",
      },
    } as HostedSessionRecord;
    const runtime = {
      siteWorldId: "runtime-siteworld-1",
      scene_id: "runtime-scene-1",
      capture_id: "runtime-capture-1",
      site_submission_id: "runtime-submission-1",
    };

    expect(hostedSessionEntitlementIds(session)).toEqual([
      "sw-chi-01",
      "scene-1",
      "capture-1",
      "submission-1",
      "siteworld-1",
      "scene-model-1",
      "capture-model-1",
    ]);
    expect(hostedRuntimeEntitlementIds(runtime, "requested-siteworld-1")).toEqual([
      "requested-siteworld-1",
      "runtime-siteworld-1",
      "runtime-scene-1",
      "runtime-capture-1",
      "runtime-submission-1",
    ]);
  });

  it("selects the existing route blocker-code preference for launch-readiness failures", () => {
    const accessBlocker: HostedSessionLaunchBlockerDetail = {
      code: "access_1",
      message: "A provisioned hosted-session entitlement is required for protected site-world launch.",
      source: "access",
    };
    const runtimeHandleBlocker: HostedSessionLaunchBlockerDetail = {
      code: "runtime_handle_missing",
      message: "A live runtime handle is required for runtime-only launch.",
      source: "runtime",
    };

    expect(
      selectLaunchReadinessBlockerCode({
        sessionMode: "runtime_only",
        blockerDetails: [accessBlocker, runtimeHandleBlocker],
      }),
    ).toBe("runtime_handle_missing");
    expect(
      selectLaunchReadinessBlockerCode({
        sessionMode: "presentation_demo",
        blockerDetails: [accessBlocker, runtimeHandleBlocker],
      }),
    ).toBe("access_1");
    expect(
      selectLaunchReadinessBlockerCode({
        sessionMode: "runtime_only",
        blockerDetails: [],
      }),
    ).toBe("session_not_launchable");
  });

  it("builds failure diagnostics from runtime-style errors without losing traceback or exit code detail", () => {
    const error = Object.assign(
      new Error("Runtime request failed before receiving a response\nTraceback (most recent call last):\nboom\nexit code 42"),
      {
        code: "runtime_render_failed",
        detail: "Runtime render failed\nTraceback (most recent call last):\nboom\nexit code 42",
        statusCode: 504,
      },
    );

    expect(
      buildFailureDiagnostic({
        source: "runtime",
        operation: "render",
        error,
        fallbackCode: "render_failed",
        fallbackSummary: "Render failed.",
        occurredAt: "2026-03-12T00:00:00.000Z",
      }),
    ).toEqual({
      source: "runtime",
      operation: "render",
      code: "runtime_render_failed",
      summary: "Runtime render failed",
      detail: "Runtime render failed\nTraceback (most recent call last):\nboom\nexit code 42",
      traceback: "Traceback (most recent call last):\nboom\nexit code 42",
      rawDetail: "Runtime render failed\nTraceback (most recent call last):\nboom\nexit code 42",
      exitCode: 42,
      statusCode: 504,
      occurredAt: "2026-03-12T00:00:00.000Z",
    });
  });

  it("appends canonical package mismatch details only when registered and resolved URIs differ", () => {
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "reset",
      error: new Error("Runtime session did not materialize a renderable world snapshot in time."),
      fallbackCode: "runtime_snapshot_not_ready",
      fallbackSummary: "Runtime snapshot was not ready.",
      statusCode: 504,
      occurredAt: "2026-03-12T00:00:00.000Z",
    });
    const session = {
      siteModel: {
        registeredCanonicalPackageUri: "gs://runtime/registered/site_world_spec.json",
        resolvedArtifactCanonicalUri: "gs://bucket/site_world_spec.json",
      },
      launchContext: {},
    } as HostedSessionRecord;

    const appended = appendCanonicalPackageMismatch(diagnostic, session);
    expect(appended.detail).toContain("Runtime session did not materialize");
    expect(appended.detail).toContain("runtime_registered=gs://runtime/registered/site_world_spec.json");
    expect(appended.detail).toContain("resolved_artifact=gs://bucket/site_world_spec.json");
    expect(appended.rawDetail).toBe(appended.detail);

    expect(
      appendCanonicalPackageMismatch(diagnostic, {
        siteModel: {
          registeredCanonicalPackageUri: "gs://bucket/site_world_spec.json",
          resolvedArtifactCanonicalUri: "gs://bucket/site_world_spec.json",
        },
        launchContext: {},
      } as HostedSessionRecord),
    ).toBe(diagnostic);
  });
});
