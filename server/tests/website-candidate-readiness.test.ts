// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({dbAdmin: null, storageAdmin: null, default: {}}));
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { candidateReadinessSchema, loadJobCandidateReadiness, omitPublishedCandidates,
  readCandidateReadinessCompanion, CANDIDATE_READINESS_MAX_BYTES, type CandidateReadinessDeps } from "../utils/websiteCandidateReadiness";
import type { WebsitePreparationReceipt } from "../utils/websitePreparationStatus";
import type { JobManagedEvidenceSummary } from "../../client/src/types/jobMarketplace";
const hash = "sha256:" + "a".repeat(64);
const selector = {request_id: "development-job", scene_id: "site-development-job", capture_id: "walkthrough-development-job",
  completion_marker_generation: "19", producer_delivery_key: hash, source_payload_sha256: "b".repeat(64), task_context_digest: hash};
const status = {...selector, revision: 3, status_digest: hash, state: "preparing"} as WebsitePreparationReceipt;
function fixture() {
  const row = {candidate_id: "public-policy", display_name: "Public robot policy", configuration_digest: hash,
    policy_kind: "checkpoint", compatibility: "not_evaluated", known_reasons: ["prepared_robot_policy_registration_missing"]};
  const value = {...selector, schema_version: "website_candidate_readiness.v1", claim_ceiling: "candidate_preparation_only",
    compatibility: "not_evaluated", preparation_revision: 3, preparation_status_digest: hash, catalog_digest: hash,
    registry_digest: hash, profile_digest: hash, profile_source: "operator_defaults", candidate_count: 2,
    candidates: [row, {...row, candidate_id: "blueprint-script", display_name: "Blueprint scripted baseline", policy_kind: "scripted", known_reasons: []}],
    readiness_digest: ""};
  value.readiness_digest = crossRuntimeArtifactDigest(value, "readiness_digest"); return value;
}
const deps = (value: unknown): CandidateReadinessDeps => ({proof: vi.fn(async () => ({selector, status})), read: vi.fn(async () => value)});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});
describe("read-only candidate preparation", () => {
  it("keeps every stable ID, distinguishes scripts and emits no score/authority/host metadata", async () => {
    const d = deps(fixture()); const result = await loadJobCandidateReadiness(selector.request_id, selector.capture_id, d);
    expect(d.proof).toHaveBeenCalledTimes(2); expect(result.state).toBe("available");
    if (result.state !== "available") throw Error();
    expect(result.candidates.map(row => row.candidateId)).toEqual(["public-policy", "blueprint-script"]);
    expect(result.candidates[1]).toMatchObject({compatibility: "not_evaluated", kind: "scripted_baseline", notes: []});
    expect(result.candidates[0].notes).toEqual(["The matching robot, tools and camera setup still need preparation."]);
    for (const key of ["task_context", "registry_digest", "score", "campaign", "launch", "budget", "known_reasons"])
      expect(JSON.stringify(result)).not.toContain(key);
  });
  it.each(["foreign-source", "digest", "count", "duplicate", "oversize", "unknown-field", "endpoint", "score"])("refuses %s without leaking rows", async attack => {
    const raw = fixture() as any;
    if (attack === "foreign-source") raw.capture_id = "walkthrough-another";
    if (attack === "digest") raw.catalog_digest = "sha256:" + "c".repeat(64);
    if (attack === "count") raw.candidate_count = 1;
    if (attack === "duplicate") raw.candidates[1].candidate_id = raw.candidates[0].candidate_id;
    if (attack === "oversize") {raw.candidates = Array.from({length: 257}, (_, i) => ({...raw.candidates[0], candidate_id: `c${i}`})); raw.candidate_count = 257;}
    if (attack === "unknown-field") raw.launch_descriptor = {secret: "PRIVATE"};
    if (attack === "endpoint") raw.candidates[0].display_name = "https://private.invalid/?token=PRIVATE";
    if (attack === "score") raw.candidates[0].score = 1;
    if (attack !== "digest") raw.readiness_digest = crossRuntimeArtifactDigest(raw, "readiness_digest");
    const result = await loadJobCandidateReadiness(selector.request_id, selector.capture_id, deps(raw));
    expect(result.state).toBe("unavailable"); expect(JSON.stringify(result)).not.toContain("PRIVATE"); expect(result).not.toHaveProperty("candidates");
  });
  it("rechecks current recording and refuses source changes or withdrawn permission", async () => {
    for (const ended of [false, true]) {
      const d = deps(fixture()); vi.mocked(d.proof).mockResolvedValueOnce({selector, status}).mockImplementationOnce(async () => {
        if (ended) throw Error("PRIVATE owner revoked");
        return {selector: {...selector, completion_marker_generation: "20"}, status};
      });
      expect((await loadJobCandidateReadiness(selector.request_id, selector.capture_id, d)).state).toBe("unavailable");
    }
  });
  it("current genuine publication replaces the same IDs; history does not suppress preparation", async () => {
    const preview = await loadJobCandidateReadiness(selector.request_id, selector.capture_id, deps(fixture()));
    const evidence = [{current: true, screening: {candidates: [{candidateId: "public-policy"}]}},
      {current: false, screening: {candidates: [{candidateId: "blueprint-script"}]}}] as JobManagedEvidenceSummary[];
    const result = omitPublishedCandidates(preview, evidence);
    expect(result.state === "available" && result.candidates.map(row => row.candidateId)).toEqual(["blueprint-script"]);
  });
  it("does not require or imply provider credentials when no catalog finding exists", async () => {
    const value = fixture(); value.candidates[0].policy_kind = "hosted"; value.candidates[0].known_reasons = [];
    value.readiness_digest = crossRuntimeArtifactDigest(value, "readiness_digest");
    const result = await loadJobCandidateReadiness(selector.request_id, selector.capture_id, deps(value));
    expect(result.state === "available" && result.candidates[0]).toMatchObject({compatibility: "not_evaluated", notes: []});
  });
});
function signedTransport() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "synthetic-secret");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "http://127.0.0.1:9999/api/live-pipeline/intake");
}
it("strict companion schema keeps v4 and execution fields out", () => {
  expect(candidateReadinessSchema.parse(fixture()).candidates).toHaveLength(2);
  expect(candidateReadinessSchema.safeParse({...fixture(), state: "completed"}).success).toBe(false);
});
it("bounded signed transport rejects oversized or duplicate-key payloads", async () => {
  signedTransport();
  for (const payload of [" ".repeat(CANDIDATE_READINESS_MAX_BYTES + 1), '{"schema_version":"x","schema_version":"y"}']) {
    const fetcher = vi.fn(async () => new Response(payload)); vi.stubGlobal("fetch", fetcher);
    await expect(readCandidateReadinessCompanion(selector, new AbortController().signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/website-candidate-readiness"); expect(init.redirect).toBe("error");
    expect(init.headers).toHaveProperty("x-blueprint-pipeline-signature");
  }
});

it("reports a complete-list overflow instead of silently displaying a subset", async () => {
  signedTransport(); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({detail: "website_candidate_readiness_bound_exceeded"}), {status: 503})));
  const result = await loadJobCandidateReadiness(selector.request_id, selector.capture_id,
    {...deps(null), read: readCandidateReadinessCompanion});
  expect(result).toMatchObject({state: "unavailable", message: expect.stringContaining("complete candidate list exceeds")});
  expect(result).not.toHaveProperty("candidates");
});
