// @vitest-environment node
/**
 * Publication v4: v3 plus, on a learned-policy candidate, how far its graded episodes got along the
 * pick-and-place ladder (`progress`). Refused on v1 to v3, validated on v4 (closed stage list, ladder
 * order, counts), carried to the site's view, said on the page and in the one email as facts, and never
 * used to rank. A malformed `progress` refuses the whole publication by name, so the Pipeline sends v3.
 *
 * Real contract, ingest, projection, outbox and route over the shared Firestore fake; the email
 * transport and the ops Slack webhook are spies.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";
import pipelineV1 from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";
import pipelineV2 from "./fixtures/pipeline-beta-policy-screening-publication.v2.json";
import pipelineV3 from "./fixtures/pipeline-beta-policy-screening-flagged-publication.v3.json";
import pipelineV4 from "./fixtures/pipeline-beta-policy-screening-progress-publication.v4.json";
import { parseBetaPolicyScreeningPublication, screeningOutcome, screeningPublicationTransition, SCREENING_PROGRESS_GRADER_VERSION,
  SCREENING_PROGRESS_STAGES } from "../utils/betaPolicyScreeningContract";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

const send = vi.hoisted(() => vi.fn());
const slack = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: slack }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { ingestBetaPolicyScreening } = await import("../utils/betaPolicyScreeningIngest");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { projectManagedJobEvidence } = await import("../utils/jobManagedEvaluation");
const { managedEvidenceForSite } = await import("../utils/siteManagedEvidence");
const { projectSimulationProof } = await import("../../client/src/lib/simulationProof");
const router: any = (await import("../routes/internal-beta-policy-screening")).default;

/**
 * The Pipeline's own v4 fixture's bytes (`progress-fixture`, written by the Pipeline from its grader).
 * Change the fixture in both repositories together, and this value in both tests.
 */
const PIPELINE_V4_FIXTURE_SHA256 = "5ad8e51f64357ff520ad2b961c0db169e21ec9f5d82b17583cc04cdd33c75da6";
const NO_POLICY = "The simulation ran, but no policy completed the job in it, so it could not rank them.";
const HOW_FAR = "How far each got: π0.5 carried the object toward where it goes in 2 of 10 tries; GR00T N1.7 moved the object in 1 of 10 tries.";
const SECRET = "test-only-screening-progress-signature";
const scene = createHash("sha256").update("scene-one").digest("hex").slice(0, 24);
const run = (campaign = "campaign-one") => state.docs.get(`taskEvaluationPolicyRuns/${campaign}`) as Record<string, any>;
let job: ReturnType<typeof screeningFixture>;

/** The contract's own example: the ladder with `approached`, 10 graded episodes. */
const WITH_APPROACH = { grader_version: SCREENING_PROGRESS_GRADER_VERSION, episodes_graded: 10, stages: [
  { stage: "approached", episodes: 9 }, { stage: "contact", episodes: 6 }, { stage: "moved", episodes: 5 }, { stage: "lifted", episodes: 4 },
  { stage: "translated", episodes: 2 }, { stage: "placed", episodes: 0 }, { stage: "released_and_settled", episodes: 0 }], mean_score: 0.3714,
  closest_approach_m: { median: 0.0129, min: 0.0 } };
/** A ladder without `approached` (not every episode measured it): it starts at contact. 4 of 60 stages. */
const FROM_CONTACT = { grader_version: SCREENING_PROGRESS_GRADER_VERSION, episodes_graded: 10, stages: [
  { stage: "contact", episodes: 3 }, { stage: "moved", episodes: 1 }, { stage: "lifted", episodes: 0 }, { stage: "translated", episodes: 0 },
  { stage: "placed", episodes: 0 }, { stage: "released_and_settled", episodes: 0 }], mean_score: 0.0667 };
/** Policies in the page's closed mapping, so the page compares them (both run on the Franka arm). */
const IDS = ["pi05_droid", "groot_n17_droid"];

/** The v3 fixture's result as v4, rebound to the fixture job, with mapped ids and each row's progress (undefined: none). */
function v4(progress: Array<unknown> = [WITH_APPROACH, FROM_CONTACT], change: Record<string, unknown> = {}) {
  return sealScreening({ ...pipelineV3, schema_version: "beta_policy_screening_publication.v4",
    campaign_id: job.publication.campaign_id, site_id: job.publication.site_id, source: job.publication.source,
    candidates: pipelineV3.candidates.map((row, index) => ({ ...row, candidate_id: IDS[index],
      ...(progress[index] !== undefined ? { progress: progress[index] } : {}) })), ...change });
}
/** The same result as v3: what the Pipeline sends a release that does not accept v4. */
const asV3 = (change: Record<string, unknown> = {}) => {
  const value = v4([undefined, undefined], change) as Record<string, any>;
  return sealScreening({ ...value, schema_version: "beta_policy_screening_publication.v3" });
};
const accepted = (value: unknown) => parseBetaPolicyScreeningPublication(sealScreening(value)) !== null;
function siteView() {
  const stored = run();
  const result = state.docs.get(`captureTaskEvaluationRuns/${stored.result_record_id}`) as Record<string, any>;
  return managedEvidenceForSite(projectManagedJobEvidence("campaign-one", stored, result, "job-one", stored.job_evidence_binding.brief_digest,
    stored.job_task_context_digest, stored.job_source_fingerprint)!);
}
function post(value: unknown) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) };
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const response = { status(code: number) { status = code; return response; },
      json(result: any) { resolve({ status, body: result }); return response; } };
    router.handle({ method: "POST", url: "/beta-policy-screening-runs", body: value, rawBody: text,
      header(name: string) { const key = Object.keys(headers).find(entry => entry.toLowerCase() === name.toLowerCase()); return key ? headers[key] : undefined; } },
    response, (error?: Error) => reject(error ?? new Error("route_not_matched")));
  });
}

beforeEach(() => {
  state.docs.clear();
  job = screeningFixture();
  state.docs.set(job.launch.path, job.launch.record);
  state.docs.set("inboundRequests/job-one", { ...job.job, contact: { email: "encrypted:owner@example.com" } });
  state.docs.set("siteTaskBriefs/job-one", job.brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", job.intake);
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
  slack.mockReset().mockResolvedValue({ sent: true });
  vi.stubEnv("PIPELINE_SYNC_TOKEN", SECRET); vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
});

describe("the v4 wire contract", () => {
  it("reads the Pipeline's own v4 fixture byte for byte, digest included, and carries its progress to the site", async () => {
    const raw = readFileSync(new URL("./fixtures/pipeline-beta-policy-screening-progress-publication.v4.json", import.meta.url));
    expect(createHash("sha256").update(raw).digest("hex")).toBe(PIPELINE_V4_FIXTURE_SHA256);
    const published = JSON.parse(raw.toString("utf8"));
    const parsed = parseBetaPolicyScreeningPublication(published)!;
    expect(parsed).not.toBeNull();
    expect(parsed).toStrictEqual(published);
    expect(parsed.publication_digest).toBe(crossRuntimeArtifactDigest(pipelineV4, "publication_digest"));
    expect(parsed.schema_version).toBe("beta_policy_screening_publication.v4");
    // Both ladders, the distance exactly with `approached`, and none on the known-good control.
    expect(parsed.candidates.map(row => [row.progress?.stages[0].stage ?? null, row.progress?.closest_approach_m ?? null])).toEqual([
      ["approached", { median: 0, min: 0 }], ["approached", { median: 0, min: 0 }], ["approached", { median: 0.12, min: 0.07 }],
      ["contact", null], [null, null]]);
    expect(screeningOutcome(parsed)).toBe("estimate");

    // Ingested for the fixture job: the site's view carries each candidate's progress in the contract's shape.
    await ingestBetaPolicyScreening(sealScreening({ ...published, campaign_id: job.publication.campaign_id,
      site_id: job.publication.site_id, source: job.publication.source }));
    const rows = siteView().screening!.candidates;
    expect(rows.map(row => row.candidateId)).toEqual(["policy-a", "policy-b", "policy-c", "policy-d"]);
    expect(rows.map(row => row.progress)).toEqual(published.candidates.slice(0, 4).map((row: any) => ({
      graded: row.progress.episodes_graded, stages: row.progress.stages, meanScore: row.progress.mean_score,
      ...(row.progress.closest_approach_m ? { closestApproachM: row.progress.closest_approach_m } : {}) })));
    // Policy C reached no stage: it says how close it typically came. A completion elsewhere leaves the line alone.
    const proof = projectSimulationProof({ evaluation: [siteView()], pick: null });
    expect(proof.policyComparison!.rows.map(row => [row.succeeded, row.furthestText])).toEqual([
      [2, "put the object in place and let go"], [0, "carried the object toward where it goes"],
      [0, "did not get within reach of the object; it typically came within about 12 cm of it"], [0, "lifted the object"]]);
    expect(proof.policyComparison!.line).not.toContain("How far each got");
  });

  it("accepts v4 with progress on either ladder, and v4 without any", () => {
    const parsed = parseBetaPolicyScreeningPublication(v4())!;
    expect(parsed).not.toBeNull();
    expect(parsed.schema_version).toBe("beta_policy_screening_publication.v4");
    expect(parsed.candidates.map(row => row.progress)).toEqual([WITH_APPROACH, FROM_CONTACT]);
    expect(parseBetaPolicyScreeningPublication(v4([undefined, undefined]))).not.toBeNull();
    expect(parseBetaPolicyScreeningPublication(v4([FROM_CONTACT, undefined]))).not.toBeNull();
    // Every stage reached by every graded episode; and none reached.
    const all = { ...WITH_APPROACH, stages: WITH_APPROACH.stages.map(entry => ({ ...entry, episodes: 10 })), mean_score: 1 };
    const none = { ...WITH_APPROACH, stages: WITH_APPROACH.stages.map(entry => ({ ...entry, episodes: 0 })), mean_score: 0,
      closest_approach_m: { median: 0.0829, min: 0.0429 } };
    expect(accepted(v4([all, none]))).toBe(true);
    expect(accepted(v4([{ ...WITH_APPROACH, closest_approach_m: { median: 0.05, min: 0.05 } }, FROM_CONTACT]))).toBe(true);
    // The closed list is the contract's, in its order.
    expect(SCREENING_PROGRESS_STAGES).toEqual(["approached", "contact", "moved", "lifted", "translated", "placed", "released_and_settled"]);
    expect(SCREENING_PROGRESS_GRADER_VERSION).toBe("policy_episode_progress.v1");
  });

  it("refuses progress on v1, v2 and v3, and leaves their parsing as it was", () => {
    const row = { ...pipelineV3.candidates[0], progress: WITH_APPROACH };
    expect(accepted({ ...asV3(), candidates: [row, asV3().candidates[1]] })).toBe(false);
    for (const published of [pipelineV1, pipelineV2] as Array<Record<string, any>>) {
      expect(accepted(published)).toBe(true);
      expect(accepted({ ...published, candidates: [{ ...published.candidates[0], progress: WITH_APPROACH }, ...published.candidates.slice(1)] }))
        .toBe(false);
    }
    // A v1 to v3 publication parses to exactly what was sent: nothing is added to it.
    for (const published of [pipelineV1, pipelineV2, pipelineV3]) {
      expect(parseBetaPolicyScreeningPublication(published)).toStrictEqual(published);
    }
  });

  it("refuses a malformed progress as a schema error for the whole publication, never dropping it", () => {
    const stages = WITH_APPROACH.stages;
    const with_ = (change: Record<string, unknown>) => ({ ...WITH_APPROACH, ...change });
    const malformed: Array<[string, unknown]> = [
      ["null", null],
      ["another grader version", with_({ grader_version: "policy_episode_progress.v2" })],
      ["no grader version", (({ grader_version: _version, ...rest }) => rest)(WITH_APPROACH)],
      ["a field it does not know", with_({ label: "got close" })],
      ["a stage field it does not know", with_({ stages: stages.map((entry, index) => (index ? entry : { ...entry, label: "close" })) })],
      ["a stage outside the closed list", with_({ stages: stages.map((entry, index) => (index === 2 ? { ...entry, stage: "grasped" } : entry)) })],
      ["stages out of order", with_({ stages: [stages[0], stages[2], stages[1], ...stages.slice(3)] })],
      ["approached not first", with_({ stages: [...stages.slice(1), stages[0]] })],
      ["a missing stage", with_({ stages: stages.filter(entry => entry.stage !== "lifted") })],
      ["a stage twice", with_({ stages: [stages[0], ...stages] })],
      ["no stages", with_({ stages: [] })],
      ["counts that increase", with_({ stages: stages.map((entry, index) => (index === 3 ? { ...entry, episodes: 6 } : entry)) })],
      ["more than were graded", with_({ stages: stages.map((entry, index) => (index === 0 ? { ...entry, episodes: 11 } : entry)) })],
      ["a negative count", with_({ stages: stages.map((entry, index) => (index === 6 ? { ...entry, episodes: -1 } : entry)) })],
      ["a fractional count", with_({ stages: stages.map((entry, index) => (index === 4 ? { ...entry, episodes: 1.5 } : entry)) })],
      ["no graded episode", { ...with_({ episodes_graded: 0 }), stages: stages.map(entry => ({ ...entry, episodes: 0 })), mean_score: 0 }],
      ["more graded than scored", with_({ episodes_graded: 11, mean_score: 0.3377 })],
      ["a mean above 1", with_({ mean_score: 1.2 })],
      ["a negative mean", with_({ mean_score: -0.1 })],
      ["a mean the counts do not give", with_({ mean_score: 0.5 })],
      ["a mean as text", with_({ mean_score: "0.3714" })],
      // The closest approach (Amendment 1): exactly with `approached`, 0 <= min <= median, metres only.
      ["approached without the closest approach", (({ closest_approach_m: _distance, ...rest }) => rest)(WITH_APPROACH)],
      ["a closest approach whose minimum exceeds its median", with_({ closest_approach_m: { median: 0.01, min: 0.02 } })],
      ["a negative closest approach", with_({ closest_approach_m: { median: -0.01, min: -0.02 } })],
      ["a closest approach without its minimum", with_({ closest_approach_m: { median: 0.01 } })],
      ["a closest approach with a field it does not know", with_({ closest_approach_m: { median: 0.01, min: 0, unit: "m" } })],
      ["a closest approach as text", with_({ closest_approach_m: "1.3 cm" })],
    ];
    for (const [name, value] of malformed) {
      expect(accepted(v4([value, FROM_CONTACT])), name).toBe(false);
    }
    // A ladder without `approached` never carries the distance.
    expect(accepted(v4([WITH_APPROACH, { ...FROM_CONTACT, closest_approach_m: { median: 0.05, min: 0 } }]))).toBe(false);
    // Only on a learned-policy row: never a scripted baseline (the known-good control is one).
    const scripted = v4() as Record<string, any>;
    scripted.candidates[0] = { ...scripted.candidates[0], execution_evidence_kind: "scripted_simulator_state_baseline",
      action_source: "scripted_simulator_state", scripted_rollout_count: 10, learned_policy_rollout_count: 0,
      scripted_controller_invoked: true, candidate_policy_queried: false };
    expect(accepted(scripted)).toBe(false);
    const learned = v4() as Record<string, any>;
    learned.candidates[0] = { ...learned.candidates[0], execution_evidence_kind: "learned_policy", action_source: "learned_policy",
      scripted_rollout_count: 0, learned_policy_rollout_count: 10, scripted_controller_invoked: false, candidate_policy_queried: true };
    expect(accepted(learned)).toBe(true);
  });

  it("answers a sealed v4 with a malformed progress schema_not_accepted, so the Pipeline sends v3, and takes that v3", async () => {
    const malformed = v4([{ ...WITH_APPROACH, stages: [...WITH_APPROACH.stages].reverse() }, FROM_CONTACT]);
    const refused = await post(malformed);
    expect(refused).toEqual({ status: 422, body: { code: "schema_not_accepted", kind: "beta_policy_screening_publication",
      payload_digest: malformed.publication_digest, quarantined: true } });
    expect(run()).toBeUndefined();
    expect((await post(asV3())).status).toBe(201);
    expect(run().screening_outcome).toBe("estimate");
    expect(siteView().screening!.candidates.every(row => !("progress" in row))).toBe(true);
  });

  it("treats progress as a note on a result the site already holds: a later revision may add or drop it, never change a count", () => {
    const held = asV3({ revision: 7 });
    const later = v4(undefined, { revision: 8, generated_at: new Date(Date.parse(held.generated_at) + 1000).toISOString() });
    expect(screeningPublicationTransition(held, later)).toBe("updated");
    expect(screeningPublicationTransition(later, asV3({ revision: 9, generated_at: later.generated_at }))).toBe("updated");
    const recount = v4(undefined, { revision: 9, generated_at: later.generated_at }) as Record<string, any>;
    recount.candidates[0] = { ...recount.candidates[0], episodes_succeeded: 1, episodes_failed: 9, success_rate: 0.1 };
    expect(() => screeningPublicationTransition(later, sealScreening(recount))).toThrow("screening_revision_conflict");
  });
});

describe("what the site reads", () => {
  it("carries progress to the site's view in the contract's shape, and says how far each got on the page and in the one email", async () => {
    const publication = v4();
    expect(screeningOutcome(publication)).toBe("estimate");
    expect(await post(publication)).toMatchObject({ status: 201 });
    const page = siteView();
    expect(page.screening!.candidates.map(row => row.progress)).toEqual([
      { graded: 10, meanScore: 0.3714, stages: WITH_APPROACH.stages, closestApproachM: { median: 0.0129, min: 0 } },
      { graded: 10, meanScore: 0.0667, stages: FROM_CONTACT.stages },
    ]);
    // Only the contract's fields reach the site: no grader version, no wire names.
    expect(JSON.stringify(page)).not.toMatch(/grader_version|policy_episode_progress|episodes_graded|mean_score|closest_approach_m/);
    // Progress changes no count, outcome or summary.
    expect(page.screening!.candidates.map(row => [row.scored, row.succeeded])).toEqual([[10, 0], [10, 0]]);
    const proof = projectSimulationProof({ evaluation: [page], pick: null });
    expect(proof.headline).toBe(NO_POLICY);
    expect(proof.policyComparison!.line).toBe(`${NO_POLICY} ${HOW_FAR}`);
    expect(proof.policyComparison!.winner).toBeNull();

    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    const notice = state.docs.get(`captureOutbox/job-one:evaluation_outcome:estimate-${scene}`) as Record<string, string>;
    expect(notice).toMatchObject({ status: "sent", subject: "The simulation of your job has finished" });
    // The email repeats the page's sentence, word for word, right after the no-completion sentence.
    expect(notice.body.startsWith(`${NO_POLICY} ${HOW_FAR} `)).toBe(true);
    expect(notice.body).not.toMatch(/did best|was ahead|\bahead\b|estimate|episodes|candidates|pilot/i);
    expect(notice.body.slice(0, notice.body.indexOf("on your private job page"))).not.toMatch(/[a-z]_[a-z]|sha256/i);
  });

  it("says how close a policy that reached no stage came, on the page and in the email", async () => {
    const none = { ...WITH_APPROACH, stages: WITH_APPROACH.stages.map(entry => ({ ...entry, episodes: 0 })), mean_score: 0,
      closest_approach_m: { median: 0.0829, min: 0.0429 } };
    await ingestBetaPolicyScreening(v4([none, FROM_CONTACT]));
    const line = projectSimulationProof({ evaluation: [siteView()], pick: null }).policyComparison!.line;
    const said = "How far each got: π0.5 did not get within reach of the object in 10 of 10 tries, and it typically came within about 8 cm of it; "
      + "GR00T N1.7 moved the object in 1 of 10 tries.";
    expect(line).toBe(`${NO_POLICY} ${said}`);
    await deliverOutbox();
    const notice = state.docs.get(`captureOutbox/job-one:evaluation_outcome:estimate-${scene}`) as Record<string, string>;
    expect(notice.body.startsWith(`${NO_POLICY} ${said} `)).toBe(true);
  });

  it("says today's words, unchanged, for the same result without progress", async () => {
    await ingestBetaPolicyScreening(v4([undefined, undefined]));
    const page = siteView();
    expect(page.screening!.candidates.every(row => !("progress" in row))).toBe(true);
    const proof = projectSimulationProof({ evaluation: [page], pick: null });
    expect(proof.policyComparison!.line).toBe(NO_POLICY);
    await deliverOutbox();
    const notice = state.docs.get(`captureOutbox/job-one:evaluation_outcome:estimate-${scene}`) as Record<string, string>;
    expect(notice.body.startsWith(`${NO_POLICY} `)).toBe(true);
    expect(notice.body).not.toContain("How far each got");
  });
});
