// @vitest-environment node
/**
 * Publication v3: the set-up flags the Pipeline's own checks recorded travel with a result, a
 * zero-success estimate they may explain says so on the page and in its one email, and a signed
 * payload this release cannot parse is kept, reported once and refused by name.
 *
 * Real contract, ingest, projection, outbox and route over the shared Firestore fake; the email
 * transport and the ops Slack webhook are spies.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import pipelineV1 from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";
import pipelineV2 from "./fixtures/pipeline-beta-policy-screening-publication.v2.json";
import pipelineV3 from "./fixtures/pipeline-beta-policy-screening-flagged-publication.v3.json";
import { parseBetaPolicyScreeningPublication, screeningOutcome, screeningOutcomeCaveat, screeningOutcomeSentence,
  screeningPublicationTransition, type BetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { SETUP_FLAG_UNCLASSIFIED_SENTENCE, screeningSetupNotes, setupFlagSentence } from "../utils/screeningSetupFlagSentences";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";

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
const { projectWebsiteSceneProgression, sceneScreening, sceneScreeningResult } = await import("../utils/websiteSceneProgression");
const { PIPELINE_PAYLOAD_QUARANTINE_COLLECTION, QUARANTINED_PAYLOAD_MAX_CHARS } = await import("../utils/pipelinePayloadQuarantine");
const router: any = (await import("../routes/internal-beta-policy-screening")).default;

/** The fixture's bytes. The Pipeline's `test_beta_policy_screening_publication_flags.py` pins the same value for its copy. */
const PIPELINE_V3_FIXTURE_SHA256 = "1b95db35f7b61b89be966d2512707b3c11e7fa3c6f9f74b0cd5b34604957c8f2";
const ESTIMATE = "Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result.";
const CAVEAT = "Our scene check found a possible set-up cause, so this result may reflect how we set the scene up more than the robots.";
const SECRET = "test-only-screening-flags-signature";
const scene = createHash("sha256").update("scene-one").digest("hex").slice(0, 24);
const run = (campaign = "campaign-one") => state.docs.get(`taskEvaluationPolicyRuns/${campaign}`) as Record<string, any>;
const quarantined = () => [...state.docs.entries()].filter(([path]) => path.startsWith(`${PIPELINE_PAYLOAD_QUARANTINE_COLLECTION}/`));
let job: ReturnType<typeof screeningFixture>;

/** A Pipeline-produced publication, rebound to the fixture job as the Pipeline would name it. */
const rebound = (published: Record<string, any>, change: Record<string, unknown> = {}) => sealScreening({ ...published,
  campaign_id: job.publication.campaign_id, site_id: job.publication.site_id, source: job.publication.source, ...change });
const withRows = (published: Record<string, any>, map: (row: any, index: number) => any, change: Record<string, unknown> = {}) =>
  rebound(published, { candidates: published.candidates.map(map), ...change });
/** The same result as publication v2: what the Pipeline sends a release that does not accept v3 (`as_v2`). */
const asV2 = (published: Record<string, any>, change: Record<string, unknown> = {}) => {
  const { scene_feasibility: _scene, ...rest } = published;
  return rebound(rest, { schema_version: "beta_policy_screening_publication.v2", candidates: published.candidates.map(
    ({ observation_quality_flags: _o, setup_quality_flags: _s, scene_check_flags: _c, ...row }: any) => row), ...change });
};
/** What the job page shows the site for the stored run. */
function siteView(campaign = "campaign-one") {
  const stored = run(campaign);
  const result = state.docs.get(`captureTaskEvaluationRuns/${stored.result_record_id}`) as Record<string, any>;
  const projected = projectManagedJobEvidence(campaign, stored, result, "job-one", stored.job_evidence_binding.brief_digest,
    stored.job_task_context_digest, stored.job_source_fingerprint)!;
  return managedEvidenceForSite(projected);
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

describe("the v3 wire contract, mirrored from the Pipeline", () => {
  it("reads the Pipeline's own v3 fixture byte for byte, digest included", () => {
    const raw = readFileSync(new URL("./fixtures/pipeline-beta-policy-screening-flagged-publication.v3.json", import.meta.url));
    // Change the fixture in both repositories together, and this value in both tests.
    expect(createHash("sha256").update(raw).digest("hex")).toBe(PIPELINE_V3_FIXTURE_SHA256);
    const parsed = parseBetaPolicyScreeningPublication(JSON.parse(raw.toString("utf8")))!;
    expect(parsed).not.toBeNull();
    expect(parsed.schema_version).toBe("beta_policy_screening_publication.v3");
    expect(parsed.publication_digest).toBe(crossRuntimeArtifactDigest(pipelineV3, "publication_digest"));
    if (parsed.schema_version !== "beta_policy_screening_publication.v3") throw new Error("unreachable");
    expect(parsed.scene_feasibility).toEqual({ status: "flagged",
      flags: ["robot_rigid_pick_place_unreachable:carry", "scripted_carry_path_not_found"] });
    expect(parsed.candidates.map(row => [row.episodes_scored, row.episodes_succeeded])).toEqual([[10, 0], [10, 0]]);
    expect(parsed.candidates[0].scene_check_flags).toEqual(parsed.scene_feasibility.flags);
    expect(parsed.candidates[0].observation_quality_flags).toContain("droid_wrist_task_pixels_below_threshold");
    expect(parsed.candidates[1].setup_quality_flags).toEqual(["g1_goal_marker_not_in_initial_view", "g1_scene_floor_estimated"]);
  });

  it.each([["v1", pipelineV1], ["v2", pipelineV2], ["v3", pipelineV3]] as const)(
    "ingests a Pipeline %s publication for the job", async (version, published) => {
      const publication = rebound(published);
      expect(parseBetaPolicyScreeningPublication(publication)).not.toBeNull();
      expect(await ingestBetaPolicyScreening(publication)).toEqual({ status: "created", run_id: "campaign-one",
        publication_digest: publication.publication_digest, revision: publication.revision });
      expect(run().publication_digest).toBe(publication.publication_digest);
      // Stored as sent, and read back by the same strict contract.
      expect(siteView().screening!.candidates).toHaveLength(publication.candidates.length);
      expect(run().screening_outcome_caveat).toBe(version === "v3" ? "scene_setup" : null);
    });

  it("stays strict: flags only on v3, typed, sorted, and a verdict that matches them", () => {
    const flagged = rebound(pipelineV3);
    const row = flagged.candidates[0];
    const refused = (value: Record<string, any>) => expect(parseBetaPolicyScreeningPublication(sealScreening(value))).toBeNull();
    // v2 has no field for a flag, and v3 requires the campaign's verdict.
    refused({ ...asV2(pipelineV3), candidates: [row, ...asV2(pipelineV3).candidates.slice(1)] });
    refused({ ...asV2(pipelineV3), scene_feasibility: { status: "unknown", flags: [] } });
    const { scene_feasibility: _scene, ...withoutVerdict } = flagged as Record<string, any>;
    refused(withoutVerdict);
    refused({ ...flagged, scene_feasibility: { status: "flagged", flags: [] } });
    refused({ ...flagged, scene_feasibility: { status: "clear", flags: ["scripted_carry_path_not_found"] } });
    refused({ ...flagged, scene_feasibility: { status: "broken", flags: [] } });
    refused({ ...flagged, set_up_note: "free text" });
    for (const flags of [[], ["b_code", "a_code"], ["a_code", "a_code"], ["Free text: /workspace/secret"], ["a:b:c:d:e"],
      ["robot_reach_insufficient:place:1.086m_vs_0.990m"]]) {
      refused({ ...flagged, candidates: [{ ...row, observation_quality_flags: flags }, ...flagged.candidates.slice(1)] });
    }
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...flagged, scene_feasibility: { status: "clear", flags: [] } }))).not.toBeNull();
  });

  it("lets a later revision state the flags of a result this site already holds, and still take the v2 form", () => {
    const held = asV2(pipelineV3, { revision: 7 });
    const flagged = rebound(pipelineV3, { revision: 8 });
    const later = { ...flagged, generated_at: new Date(Date.parse(held.generated_at) + 1000).toISOString() };
    // A finished campaign accepted as v2: its v3 revision adds the flags, never a count.
    expect(screeningPublicationTransition(held, sealScreening(later))).toBe("updated");
    // The Pipeline's v2 form of a still later revision is taken too (its fallback after a refusal).
    expect(screeningPublicationTransition(sealScreening(later), asV2(pipelineV3, { revision: 9, generated_at: later.generated_at }))).toBe("updated");
    // The evidence itself is as fixed as ever.
    const recount = withRows(pipelineV3, (row, index) => index ? row : { ...row, episodes_succeeded: 1, episodes_failed: 9, success_rate: 0.1 },
      { revision: 9, generated_at: later.generated_at });
    expect(() => screeningPublicationTransition(sealScreening(later), recount)).toThrow("screening_revision_conflict");
    // One revision with two digests is still refused: the Pipeline never rewrites a revision it sent.
    expect(() => screeningPublicationTransition(held, rebound(pipelineV3, { revision: 7 }))).toThrow("screening_revision_conflict");
  });
});

describe("what the site reads", () => {
  it("says the caveat with the outcome, on the page and in the one email, when no try succeeded in a flagged scene", async () => {
    const publication = rebound(pipelineV3);
    expect(screeningOutcome(publication)).toBe("estimate");
    expect(screeningOutcomeCaveat(publication)).toBe("scene_setup");
    await ingestBetaPolicyScreening(publication);
    // The outcome kind is unchanged; the caveat travels beside it.
    expect(run()).toMatchObject({ screening_outcome: "estimate", screening_outcome_caveat: "scene_setup", outcome_notification_pending: true,
      outcome_notification_intent: { outcome: "estimate", event_id: `estimate-${scene}`, caveat: "scene_setup",
        counts: { ran: 2, total: 2, scored: 20 } } });
    const counts = "In the simulation, 2 of 2 candidates ran, with 20 episodes scored against the job's success criteria.";
    const page = siteView();
    expect(page).toMatchObject({ outcome: "estimate", outcomeCaveat: "scene_setup", summary: `${ESTIMATE} ${CAVEAT} ${counts}` });
    expect(screeningOutcomeSentence("estimate", "scene_setup")).toBe(`${ESTIMATE} ${CAVEAT}`);
    expect(CAVEAT).toMatch(/\bmay\b/);
    // The page still shows the counts and their range exactly as measured.
    expect(page.screening!.candidates[0]).toMatchObject({ scored: 10, succeeded: 0, failed: 10,
      successRange: { lowerPercent: 0, upperPercent: 28, confidencePercent: 95 } });
    // Each flag as one plain sentence; no code reaches the site.
    expect(page.screening!.setupNotes).toEqual([
      "In our scene check, the robot arm could not reach every point on the way from where the object starts to where the job places it.",
      "Our scene check could not find a path for a robot arm to carry the object from where it starts to where the job places it.",
      "Before the run, the robot's wrist camera showed too little of the job's object or its target.",
      "Before the run, the scene hid part of the job's object or its target in a camera view.",
      "Before the run, our check of what the robot's cameras could see of the job's object and its target did not pass.",
      "At the start, the humanoid robot's camera did not have its goal in view.",
      "The floor the humanoid robot stood on in the simulation was a flat stand-in, not the floor measured from your video.",
    ]);
    const codes = [...publication.candidates.flatMap((row: any) => [...(row.observation_quality_flags ?? []),
      ...(row.setup_quality_flags ?? []), ...(row.scene_check_flags ?? [])]), "scene_feasibility", "scene_check_flags"];
    for (const code of codes) expect(JSON.stringify(page)).not.toContain(code);

    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    const notice = state.docs.get(`captureOutbox/job-one:evaluation_outcome:estimate-${scene}`) as Record<string, string>;
    expect(notice).toMatchObject({ status: "sent", subject: "Your simulation estimate is ready", to: "owner@example.com" });
    expect(notice.body.startsWith(`${ESTIMATE} ${CAVEAT} ${counts} Nothing is needed from you.`)).toBe(true);
    expect(notice.body).toMatch(/never certifies physical performance or safety/);
    expect(notice.body.slice(0, notice.body.indexOf("on your private job page"))).not.toMatch(/[a-z]_[a-z]|sha256|\bflag/i);

    // The job page's headline says the same sentence.
    const progression = projectWebsiteSceneProgression({ state: "completed" },
      sceneScreeningResult(sceneScreening([{ id: "campaign-one", run: run() }], run().team_namespace)));
    expect(progression).toEqual({ state: "evaluated", outcomeCaveat: "scene_setup" });
    const headline = projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, site_task_brief_confirmed_at: "2026-11-01T00:00:00Z",
      hasStoredCapture: true, stage: null, scenePreviewReady: true, sceneProgression: progression } as never)).headline;
    expect(headline.startsWith(`${ESTIMATE} ${CAVEAT}`)).toBe(true);

    // A later revision of a run already told (here: the shared budget moved) is not a second email.
    await ingestBetaPolicyScreening(rebound(pipelineV3, { revision: pipelineV3.revision + 1,
      budget: { ...pipelineV3.budget, committed_upper_bound_usd: "1.88", spent_upper_bound_usd: "1.88" } }));
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("gives an email not queued yet the caveat a later revision adds, and never sends a delivered one again", async () => {
    const counts = "In the simulation, 2 of 2 candidates ran, with 20 episodes scored against the job's success criteria.";
    const key = `captureOutbox/job-one:evaluation_outcome:estimate-${scene}`;
    // The result arrives as v2 (no flags); its v3 revision lands before the outbox pump queued the email.
    await ingestBetaPolicyScreening(asV2(pipelineV3));
    expect(run()).toMatchObject({ outcome_notification_pending: true, screening_outcome_caveat: null });
    expect(run().outcome_notification_intent.caveat).toBeUndefined();
    await ingestBetaPolicyScreening(rebound(pipelineV3, { revision: pipelineV3.revision + 1 }));
    expect(run()).toMatchObject({ screening_outcome: "estimate", screening_outcome_caveat: "scene_setup", outcome_notification_pending: true,
      outcome_notification_intent: { outcome: "estimate", event_id: `estimate-${scene}`, caveat: "scene_setup" } });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    // The email says what the page says.
    expect((state.docs.get(key) as Record<string, string>).body.startsWith(`${ESTIMATE} ${CAVEAT} ${counts}`)).toBe(true);
    expect(siteView().summary).toBe(`${ESTIMATE} ${CAVEAT} ${counts}`);
    // A still later revision that drops the flags (the Pipeline's v2 form) changes nothing already sent.
    await ingestBetaPolicyScreening(asV2(pipelineV3, { revision: pipelineV3.revision + 2 }));
    expect(run()).toMatchObject({ outcome_notification_pending: false, outcome_notification_intent: { caveat: "scene_setup" } });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);

    // The other order: the uncaveated email was delivered before the v3 revision arrived. It is never sent again.
    state.docs.delete(key); state.docs.delete("taskEvaluationPolicyRuns/campaign-one");
    for (const path of [...state.docs.keys()]) if (path.startsWith("captureTaskEvaluationRuns/") || path.startsWith(key)) state.docs.delete(path);
    send.mockClear();
    await ingestBetaPolicyScreening(asV2(pipelineV3));
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    const delivered = (state.docs.get(key) as Record<string, string>).body;
    expect(delivered.startsWith(`${ESTIMATE} ${counts}`)).toBe(true);
    await ingestBetaPolicyScreening(rebound(pipelineV3, { revision: pipelineV3.revision + 1 }));
    expect(run()).toMatchObject({ screening_outcome_caveat: "scene_setup", outcome_notification_pending: false });
    expect(run().outcome_notification_intent.caveat).toBeUndefined();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect((state.docs.get(key) as Record<string, string>).body).toBe(delivered);
    expect(siteView().summary).toBe(`${ESTIMATE} ${CAVEAT} ${counts}`);
  });

  it.each(["v3 with nothing flagged", "v2"])("says today's sentence, unchanged, for zero successes with no flag (%s)", async shape => {
    const plain = shape === "v2" ? asV2(pipelineV3) : withRows(pipelineV3,
      ({ observation_quality_flags: _o, setup_quality_flags: _s, scene_check_flags: _c, ...row }) => row,
      { scene_feasibility: { status: "unknown", flags: [] } });
    expect(screeningOutcome(plain)).toBe("estimate");
    expect(screeningOutcomeCaveat(plain)).toBeNull();
    await ingestBetaPolicyScreening(plain);
    expect(run().screening_outcome_caveat).toBeNull();
    expect(run().outcome_notification_intent.caveat).toBeUndefined();
    const counts = "In the simulation, 2 of 2 candidates ran, with 20 episodes scored against the job's success criteria.";
    const page = siteView();
    expect(page.summary).toBe(`${ESTIMATE} ${counts}`);
    expect(page.outcomeCaveat).toBeUndefined();
    expect(page.screening!.setupNotes).toBeUndefined();
    await deliverOutbox();
    const notice = state.docs.get(`captureOutbox/job-one:evaluation_outcome:estimate-${scene}`) as Record<string, string>;
    expect(notice.body.startsWith(`${ESTIMATE} ${counts} Nothing is needed from you.`)).toBe(true);
    expect(notice.body).not.toMatch(/scene check|set-up/i);
    const progression = projectWebsiteSceneProgression({ state: "completed" },
      sceneScreeningResult(sceneScreening([{ id: "campaign-one", run: run() }], run().team_namespace)));
    expect(progression).toEqual({ state: "evaluated" });
  });

  it("does not soften a result that has a success, or one whose flags belong to a candidate that did not score", () => {
    // One try succeeded: the scene evidently allows the job, so the estimate is said plainly. The notes still show.
    const succeeded = withRows(pipelineV3, (row, index) => index ? row
      : { ...row, episodes_succeeded: 1, episodes_failed: 9, success_rate: 0.1 });
    expect(screeningOutcomeCaveat(succeeded)).toBeNull();
    expect(screeningOutcomeSentence("estimate", screeningOutcomeCaveat(succeeded))).toBe(ESTIMATE);
    expect(screeningSetupNotes(succeeded).length).toBeGreaterThan(0);
    // The flagged candidate never ran; the one that scored zero has no flag of its own.
    const unscored = { status: "blocked", blockers: ["beta_screening_static_preflight_blocked"], episodes_scored: 0, episodes_failed: 0,
      success_rate: null, session_result_digest: null, episodes_void: 0 };
    const other = withRows(pipelineV3, (row, index) => index
      ? (({ setup_quality_flags: _setup, ...plain }) => plain)(row)
      : (({ observation_quality_flags: _observation, ...flaggedOnly }) => ({ ...flaggedOnly, ...unscored }))(row));
    expect(parseBetaPolicyScreeningPublication(other)).not.toBeNull();
    expect(screeningOutcome(other)).toBe("estimate");
    expect(screeningOutcomeCaveat(other)).toBeNull();
    // A caveat never attaches to another outcome, and an unknown stored value is no caveat.
    expect(screeningOutcomeSentence("held_setup", "scene_setup")).toBe(screeningOutcomeSentence("held_setup"));
    expect(screeningOutcomeSentence("estimate", null)).toBe(ESTIMATE);
    // A publication that names a flagged scene without naming any candidate's flags speaks for every scored one.
    const campaignOnly = withRows(pipelineV3, ({ observation_quality_flags: _o, setup_quality_flags: _s, scene_check_flags: _c, ...row }) => row);
    expect(screeningOutcomeCaveat(campaignOnly)).toBe("scene_setup");
    // Two campaigns gave the scene an estimate and only one carries the caveat: the headline says the estimate plainly.
    const estimate = { run_kind: "beta_policy_screening", team_namespace: "team", state: "completed", screening_outcome: "estimate" };
    expect(sceneScreening([{ id: "a", run: { ...estimate, screening_outcome_caveat: "scene_setup" } }, { id: "b", run: estimate }], "team")
      .estimateCaveat).toBeUndefined();
    expect(sceneScreening([{ id: "a", run: { ...estimate, screening_outcome_caveat: "scene_setup" } }], "team").estimateCaveat).toBe("scene_setup");
  });

  it("renders a code this release does not know as the generic sentence, never the code", async () => {
    const unknown = withRows(pipelineV3, (row, index) => index ? (({ setup_quality_flags: _setup, ...plain }) => plain)(row)
      : { ...(({ observation_quality_flags: _observation, ...plain }) => plain)(row), scene_check_flags: ["future_scene_check_code:phase_9"] },
    { scene_feasibility: { status: "flagged", flags: ["future_scene_check_code:phase_9"] } });
    expect(setupFlagSentence("future_scene_check_code:phase_9")).toBe(SETUP_FLAG_UNCLASSIFIED_SENTENCE);
    expect(SETUP_FLAG_UNCLASSIFIED_SENTENCE).toBe("Our scene check raised a point we could not classify.");
    // A known code keeps its sentence under any qualifier, and an inherited property name is not a code.
    expect(setupFlagSentence("robot_rigid_pick_place_unreachable:lower")).toBe(setupFlagSentence("robot_rigid_pick_place_unreachable"));
    expect(setupFlagSentence("constructor")).toBe(SETUP_FLAG_UNCLASSIFIED_SENTENCE);
    await ingestBetaPolicyScreening(unknown);
    const page = siteView();
    expect(page.screening!.setupNotes).toEqual([SETUP_FLAG_UNCLASSIFIED_SENTENCE]);
    expect(page.summary.startsWith(`${ESTIMATE} ${CAVEAT}`)).toBe(true);
    expect(JSON.stringify(page)).not.toContain("future_scene_check_code");
  });

  it("names each estimate the scene was built on in its own sentence and leaves the counts and interval as measured", async () => {
    const codes = ["scene_estimate:collider_registration", "scene_estimate:floor", "scene_estimate:level",
      "scene_estimate:review_citations_dropped", "scene_estimate:splat_view_dependence_dropped",
      "scene_estimate:surrounding_views_dropped"];
    const sentences = codes.map(setupFlagSentence);
    expect(new Set(sentences).size).toBe(codes.length);
    expect(sentences).not.toContain(SETUP_FLAG_UNCLASSIFIED_SENTENCE);
    expect(sentences.join(" ")).not.toMatch(/scene_estimate|certif|guarantee/i);
    const plain = withRows(pipelineV3, row => (({ observation_quality_flags: _o, setup_quality_flags: _s, scene_check_flags: _c,
      ...rest }) => rest)(row), { scene_feasibility: { status: "clear", flags: [] } });
    const estimated = withRows(pipelineV3, row => (({ observation_quality_flags: _o, setup_quality_flags: _s, scene_check_flags: _c,
      ...rest }) => rest)(row), { scene_feasibility: { status: "flagged", flags: codes } });
    expect(screeningSetupNotes(estimated)).toEqual(sentences);
    await ingestBetaPolicyScreening(estimated);
    const page = siteView();
    expect(page.screening!.setupNotes).toEqual(sentences);
    expect(JSON.stringify(page)).not.toContain("scene_estimate");
    // Nothing measured is adjusted by an estimate: each row's counts and interval are those of the same run unflagged.
    const measured = (value: typeof plain) => value.candidates.map(row => [row.episodes_scored, row.episodes_succeeded]);
    expect(measured(estimated)).toEqual(measured(plain));
    expect(page.screening!.candidates.map(row => [row.scored, row.succeeded])).toEqual(measured(plain));
  });
});

describe("a signed payload this release cannot parse", () => {
  function post(path: string, value: unknown, options: { signed?: boolean } = {}) {
    const text = JSON.stringify(value), timestamp = new Date().toISOString();
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.signed === false ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) }) };
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      let status = 200;
      const response = { status(code: number) { status = code; return response; },
        json(result: any) { resolve({ status, body: result }); return response; } };
      router.handle({ method: "POST", url: path, body: value, rawBody: text,
        header(name: string) { const key = Object.keys(headers).find(value => value.toLowerCase() === name.toLowerCase()); return key ? headers[key] : undefined; } },
      response, (error?: Error) => reject(error ?? new Error("route_not_matched")));
    });
  }
  /** A publication of a version after this release, sealed by the Pipeline as every publication is. */
  const future = (change: Record<string, unknown> = {}) => sealScreening({ ...rebound(pipelineV3),
    schema_version: "beta_policy_screening_publication.v4", evidence_note: "a field this release does not know", ...change });

  it("is quarantined once, alerted once and refused as schema_not_accepted; nothing is ingested", async () => {
    const payload = future();
    const first = await post("/beta-policy-screening-runs", payload);
    expect(first).toEqual({ status: 422, body: { code: "schema_not_accepted", kind: "beta_policy_screening_publication",
      payload_digest: payload.publication_digest, quarantined: true } });
    expect(run()).toBeUndefined();
    const [[path, kept]] = quarantined();
    expect(path).toBe(`${PIPELINE_PAYLOAD_QUARANTINE_COLLECTION}/beta_policy_screening_publication-${payload.publication_digest.slice(7)}`);
    expect(kept).toMatchObject({ schema_version: "pipeline_payload_quarantine.v1", kind: "beta_policy_screening_publication",
      payload_digest: payload.publication_digest, declared_schema_version: "beta_policy_screening_publication.v4",
      accepted: false, seen_count: 1, payload_truncated: false, payload_json: JSON.stringify(payload) });
    expect(kept.parse_issues.length).toBeGreaterThan(0);
    expect(kept.parse_issues[0]).toMatchObject({ path: "schema_version" });
    expect(kept.alerted_at_iso).toEqual(expect.any(String));
    // The existing ops-alert path: one open alert for this payload digest, one Slack message.
    expect(slack).toHaveBeenCalledTimes(1);
    expect(slack.mock.calls[0][0]).toMatch(/pipeline payload rejected/);
    expect(slack.mock.calls[0][0]).toContain(payload.publication_digest);
    expect(slack.mock.calls[0][0]).not.toContain("a field this release does not know");
    const alerts = [...state.docs.entries()].filter(([key]) => key.startsWith("opsAlerts/"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0][1]).toMatchObject({ status: "open", kind: "pipeline_payload_rejected", event_count: 1 });

    // The Pipeline's retries of the same bytes: the same answer, the same one record, no second alert.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await post("/beta-policy-screening-runs", payload)).toEqual(first);
    }
    expect(quarantined()).toHaveLength(1);
    expect(quarantined()[0][1]).toMatchObject({ seen_count: 4 });
    expect(slack).toHaveBeenCalledTimes(1);
    expect([...state.docs.entries()].filter(([key]) => key.startsWith("opsAlerts/"))[0][1]).toMatchObject({ event_count: 1 });

    // Another payload is another record and another alert.
    const other = future({ revision: payload.revision + 1 });
    expect((await post("/beta-policy-screening-runs", other)).body.payload_digest).toBe(other.publication_digest);
    expect(quarantined()).toHaveLength(2);
    expect(slack).toHaveBeenCalledTimes(2);
    // The same result in a version this release accepts is then ingested as usual: quarantine is not acceptance.
    expect((await post("/beta-policy-screening-runs", asV2(pipelineV3))).status).toBe(201);
    expect(run().screening_outcome).toBe("estimate");
  });

  it("keeps the plain refusals for a payload the Pipeline did not seal or sign", async () => {
    const payload = future();
    // Its own digest does not verify: not a sealed payload, so nothing is kept and the 400 stands.
    expect(await post("/beta-policy-screening-runs", { ...payload, revision: payload.revision + 5 }))
      .toEqual({ status: 400, body: { code: "screening_publication_invalid" } });
    expect(await post("/beta-policy-screening-runs", { ...asV2(pipelineV3), publication_digest: screeningSha("0") }))
      .toEqual({ status: 400, body: { code: "screening_publication_invalid" } });
    expect(await post("/beta-policy-screening-runs", ["not", "an", "object"]))
      .toEqual({ status: 400, body: { code: "screening_publication_invalid" } });
    expect((await post("/beta-policy-screening-runs", payload, { signed: false })).status).toBe(401);
    expect(quarantined()).toHaveLength(0);
    expect(slack).not.toHaveBeenCalled();
  });

  it("stores a bounded copy of a large payload, and asks for a retry when it cannot store one", async () => {
    const large = future({ evidence_note: "x".repeat(QUARANTINED_PAYLOAD_MAX_CHARS) });
    expect((await post("/beta-policy-screening-runs", large)).status).toBe(422);
    const [[, kept]] = quarantined();
    expect(kept.payload_json).toHaveLength(QUARANTINED_PAYLOAD_MAX_CHARS);
    expect(kept).toMatchObject({ payload_truncated: true, payload_chars: JSON.stringify(large).length });

    const lost = future({ revision: 99 });
    const failing = vi.spyOn(sharedFakeFirestore, "runTransaction").mockRejectedValueOnce(new Error("mock_storage_unreachable"));
    expect(await post("/beta-policy-screening-runs", lost)).toEqual({ status: 503, body: { code: "screening_store_unavailable" } });
    failing.mockRestore();
    // The retry the 503 asks for keeps it.
    expect((await post("/beta-policy-screening-runs", lost)).status).toBe(422);
    expect(quarantined()).toHaveLength(2);
  });

  it("does the same for a hold", async () => {
    const hold: Record<string, any> = { schema_version: "beta_policy_screening_hold.v2", hold_id: "hold-from-a-later-release",
      site_id: job.publication.site_id, source: job.publication.source, status: "held", reason_code: "a_reason_this_release_does_not_know",
      revision: 1, generated_at: "2026-11-10T12:00:00Z" };
    hold.hold_digest = crossRuntimeArtifactDigest(hold, "hold_digest");
    const answer = { status: 422, body: { code: "schema_not_accepted", kind: "beta_policy_screening_hold",
      payload_digest: hold.hold_digest, quarantined: true } };
    expect(await post("/beta-policy-screening-holds", hold)).toEqual(answer);
    expect(await post("/beta-policy-screening-holds", hold)).toEqual(answer);
    expect(quarantined().map(([path]) => path)).toEqual([
      `${PIPELINE_PAYLOAD_QUARANTINE_COLLECTION}/beta_policy_screening_hold-${hold.hold_digest.slice(7)}`]);
    expect(slack).toHaveBeenCalledTimes(1);
    expect(await post("/beta-policy-screening-holds", { ...hold, revision: 2 })).toEqual({ status: 400, body: { code: "screening_hold_invalid" } });
    expect(quarantined()).toHaveLength(1);
  });
});
