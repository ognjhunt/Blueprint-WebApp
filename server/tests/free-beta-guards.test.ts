// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { canDispatchFreeBetaRun } from "../utils/freeBeta";
import { hasCurrentRecordingConsent, RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { successRateBand, wilsonLowerBound, SUCCESS_RATE_BAND_CLAIM } from "../utils/successRateConfidence";
import { createCaptureUploadToken, verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { createRequestReviewToken, verifyRequestReviewToken } from "../utils/request-review-auth";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});
vi.mock("../agents/workflows", () => ({ decideDispatchForRequest: () => ({ dispatch: true, channel: "self_capture_upload" }) }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../utils/robotTeamBalance", () => ({ releaseReservation: vi.fn(), settleReservation: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("../utils/robotTeamNotifications", () => ({ notifyTeamOfRunOutcome: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("../utils/agentRunNotificationRecovery", () => ({ reconcileAgentRunNotifications: vi.fn() }));
const { authorizeCaptureUpload } = await import("../utils/captureUploadAuthorization");
const { markRunStarted, listRequestedRuns } = await import("../utils/agentEvalRuns");

beforeEach(() => sharedFakeFirestoreState.docs.clear());
afterEach(() => vi.unstubAllEnvs());
const grant = { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-01-01T00:00:00Z" };

describe("free beta authority", () => {
  it.each([null, undefined, {}, { ...grant, granted: false }, { ...grant, statement_version: "stale" },
    { ...grant, recorded_at_iso: "invalid" }, { ...grant, revoked_at_iso: "2026-01-02" }])("refuses an invalid recording grant: %j", value => {
    expect(hasCurrentRecordingConsent(value)).toBe(false);
  });
  it("rechecks recording consent after a link is issued", async () => {
    const request = { request: { consent_attestation: { ...grant } } };
    sharedFakeFirestoreState.docs.set("inboundRequests/request", request);
    expect((await authorizeCaptureUpload("request")).allowed).toBe(true);
    request.request.consent_attestation.granted = false;
    expect((await authorizeCaptureUpload("request")).holdReason).toBe("recording_consent_required");
  });
  it.each(["private", undefined, "unknown"])("never starts a queued %s run", async evaluationPurpose => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run", {
      runId: "run", evaluationPurpose, quotedUsd: 99, state: "requested", episodesRun: null,
      moneyResolved: false, dispatchPending: true, requestedAtIso: new Date().toISOString(),
      settlementDueAtMs: Date.now() + 100_000, executionAdmission: { digestSha256: "digest" },
    });
    expect(await listRequestedRuns()).toEqual([]);
    expect(await markRunStarted({ runId: "run", pipelineRunId: "pipeline", executionAdmissionDigest: "digest" })).toBe(false);
    expect(sharedFakeFirestoreState.docs.get("evaluationRuns/run")?.dispatch).toBeUndefined();
  });
  it("requires an explicit free purpose and admission", () => {
    expect(canDispatchFreeBetaRun({ evaluationPurpose: "pilot", quotedUsd: 99, executionAdmission: { digestSha256: "d" } })).toBe(false);
    expect(canDispatchFreeBetaRun({ evaluationPurpose: "pilot", quotedUsd: 0 })).toBe(false);
    expect(canDispatchFreeBetaRun({ evaluationPurpose: "pilot", quotedUsd: 0, executionAdmission: { digestSha256: "d" } })).toBe(false);
    expect(canDispatchFreeBetaRun({ evaluationPurpose: "pilot", quotedUsd: 0, executionAdmission: { digestSha256: "d", envelope: { funding: {
      payer: "blueprint", customer_price_usd: 0, cap_usd: 10, max_attempts: 1,
      approved_by: "operator", approval_digest: "sha256:" + "a".repeat(64), expires_at_iso: "2100-01-01T00:00:00Z",
    } } } })).toBe(true);
  });
});

describe("production capability signing", () => {
  const aliases = ["BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET", "BLUEPRINT_SESSION_UI_TOKEN_SECRET", "PIPELINE_SYNC_TOKEN"];
  beforeEach(() => { vi.stubEnv("NODE_ENV", "production"); for (const key of aliases) vi.stubEnv(key, ""); });
  it("refuses missing signing configuration", () => {
    expect(() => createCaptureUploadToken({ requestId: "r", sceneId: "s", captureId: "c" })).toThrow(/secret is required/);
    expect(() => createRequestReviewToken("r")).toThrow(/secret is required/);
  });
  it.each(aliases)("supports %s without accepting tampering or expiry", alias => {
    vi.stubEnv(alias, "isolated-test-secret");
    const params = { requestId: "r", sceneId: "s", captureId: "c", scope: "film" as const };
    const token = createCaptureUploadToken(params);
    expect(verifyCaptureUploadToken(token)?.scope).toBe("film");
    expect(verifyCaptureUploadToken(token + "x")).toBeNull();
    expect(verifyCaptureUploadToken(createCaptureUploadToken({ ...params, ttlSeconds: -1 }))).toBeNull();
    expect(verifyRequestReviewToken(createRequestReviewToken("r"), "r")).not.toBeNull();
    expect(verifyRequestReviewToken(createRequestReviewToken("r", -1), "r")).toBeNull();
  });
});

describe("confidence claims", () => {
  it.each([[34, null], [35, "ninety"], [72, "ninety"], [73, "ninetyfive"], [380, "ninetyfive"], [381, "ninetynine_plus"]])(
    "uses the correct boundary for %s successes", (trials, band) => expect(successRateBand(Number(trials), Number(trials))).toBe(band));
  it("never awards a probability above the Wilson lower bound", () => {
    for (let trials = 1; trials <= 1000; trials++) {
      for (const successes of [0, trials, Math.floor(trials * .95), Math.floor(trials * .99)]) {
        const band = successRateBand(successes, trials);
        if (band) expect(wilsonLowerBound(successes, trials)).toBeGreaterThanOrEqual(SUCCESS_RATE_BAND_CLAIM[band]);
      }
    }
  });
});
