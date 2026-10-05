// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn() }));
vi.mock("../agents/private-evidence", () => ({ hydrateAgentEvidence: vi.fn() }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: vi.fn() }));
vi.mock("../utils/taskUpdateCommitment", () => ({ commitTaskUpdate: vi.fn() }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));
import { recordCoverageFinding } from "../utils/captureCoverageReview";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { humanDecisionDigest } from "../utils/human-reply-admission";

beforeEach(() => state.docs.clear());
describe("coverage publication keeps consent and evidence binding together", () => {
  it.each(["current", "revoked", "source_changed", "brief_changed", "privacy_held"])("handles %s authority at commit", async condition => {
    const brief = { summary: "Move boxes" };
    const source = { kind: "browser_pending", key: "retained-source" };
    const binding = { source, capture_id: "capture", brief_digest: humanDecisionDigest(brief) };
    state.docs.set("siteTaskBriefs/request", condition === "brief_changed" ? { summary: "Different task" } : brief);
    state.docs.set("inboundRequests/request", {
      request: { consent_attestation: { granted: condition !== "revoked", statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-01-01T00:00:00Z" } },
      capture_privacy_source_bound_decision: { proceeded: condition !== "privacy_held", capture_id: "capture",
        producer_source: condition === "source_changed" ? { ...source, key: "new-source" } : source },
    });
    const finding = { coversScene: true, missingCoverage: [], supplementWouldFinish: false,
      unreadableReasons: [], confidence: .9, sourceCaptures: [{ capture_id: "parent", bundle_digest: "retained-parent" }] };
    const write = recordCoverageFinding("request", "capture", finding, binding);
    if (condition !== "current") {
      await expect(write).rejects.toThrow();
      expect(state.docs.get("inboundRequests/request")?.capture_coverage).toBeUndefined();
    } else {
      await write;
      expect(state.docs.get("inboundRequests/request")?.capture_coverage).toMatchObject({
        covers_scene: true, binding, source_captures: finding.sourceCaptures,
      });
    }
  });
});
