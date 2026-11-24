// @vitest-environment node
/**
 * Every code the Pipeline can send about a job's simulation has words here (sweep of the Pipeline's codes, 2026-11-24).
 *
 * `contracts/pipeline/website-pipeline-codes.v1.json` is the Pipeline's `docs/webapp_handoff/website-pipeline-codes.v1.json`
 * byte for byte (`npm run pipeline:mirrors:verify`); the Pipeline's `tests/test_website_pipeline_codes.py` writes it from
 * the code that sends each one. Before it, the stress tests found codes with no words one at a time: the site read a
 * general "stopped" or "still working" card and staff got an unknown-code alert. A new code fails here until it is worded.
 *
 * - Each Atlas preview reason it lists is known (`atlasPreviewReasonKnown`), in every state it lists.
 * - A privacy, rights or money stop is said as that: never as still being worked on and never with the general card.
 * - A refusal the same inputs repeat is not reopened by the clock, so it is never said as still being worked on.
 * - Each preparation status code it lists raises no unknown-code alert (`unknownPreparationCodes`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/unknownPipelineCode", () => ({ noteUnknownPipelineCode: vi.fn(async () => true),
  noteUnknownPipelineCodes: vi.fn(async () => undefined) }));

const outcome = await import("../utils/taskPreparationOutcome");
const { unknownPreparationCodes } = await import("../utils/websitePreparationStatus");

type Row = { class: string; states: string[]; wall: "money" | "privacy_rights" | null; raised_in: string[] };
const fixture = JSON.parse(readFileSync(new URL("../../contracts/pipeline/website-pipeline-codes.v1.json", import.meta.url), "utf8")) as {
  schema_version: string; atlas_preview: { reasons: Record<string, Row>; prefixes: Record<string, Row> };
  preparation_status: { outcome_reasons: string[]; outcome_categories: string[]; outcome_causes: string[]; terminal_reasons: string[] };
};
const reasons = Object.entries(fixture.atlas_preview.reasons);
const digest = `sha256:${"a".repeat(64)}`;
const preview = (state: string, reason: string) => {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-x", revision: 2, state, reason,
    updated_at_epoch: 1, bundle: null, splat_available: false, mesh_available: false, claim_ceiling: "development_only",
    scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") } as never;
};
const card = (state: string, reason: string) => outcome.projectAtlasPreparationOutcome(preview(state, reason))!;
const general = (said: { title: string; reason: string }) =>
  (said.title === outcome.PROCESSING_RETRYING_SENTENCES.title && said.reason === outcome.PROCESSING_RETRYING_SENTENCES.reason)
  || (said.title === outcome.PROCESSING_FAILURE_SENTENCES.title && said.reason === outcome.PROCESSING_FAILURE_SENTENCES.reason);
/** Said with the general Atlas card on purpose: the owner's closing of a run has its own card on the job page. */
const OWN_CARD_ELSEWHERE = new Set(["website_run_closed_by_owner"]);

describe("the Pipeline's list of codes", () => {
  it("is the list this test reads", () => {
    expect(fixture.schema_version).toBe("website_pipeline_codes.v1");
    // The codes the stress tests found one at a time are on it.
    for (const code of ["atlas_completion_visual_review_required", "atlas_preview_step_interrupted",
      "atlas_scene_planner_unsafe_frames_invalid", "atlas_source_rotation_unsupported"])
      expect(fixture.atlas_preview.reasons[code], code).toBeDefined();
    expect(reasons.length).toBeGreaterThan(90);
  });
});

describe("each Atlas preview reason the Pipeline can send", () => {
  it.each(reasons)("%s has words of its own", code => {
    expect(outcome.atlasPreviewReasonKnown(code)).toBe(true);
  });

  it.each(reasons.filter(([code, row]) => row.wall !== null && !OWN_CARD_ELSEWHERE.has(code)))(
    "%s is said as the stop it is, in every state it can be stored with", (code, row) => {
      for (const state of row.states) {
        const said = card(state, code);
        expect(said.title, `${state} ${code}`).not.toBe(outcome.PROCESSING_RETRYING_SENTENCES.title);
        expect(general(said), `${state} ${code}`).toBe(false);
        expect(said.actionOwner, `${state} ${code}`).not.toBe("site");
      }
    });

  it.each(reasons.filter(([, row]) => row.class === "deterministic"))(
    "%s is a refusal the same inputs repeat: never said as still being worked on", code => {
      expect(card("needs_input", code).title).not.toBe(outcome.PROCESSING_RETRYING_SENTENCES.title);
    });

  it.each(Object.entries(fixture.atlas_preview.prefixes))("a code named by its prefix %s is known and said as money", prefix => {
    const code = `${prefix}a_later_check`;
    expect(outcome.atlasPreviewReasonKnown(code)).toBe(true);
    expect(card("needs_input", code).reason).toBe(outcome.ACCOUNT_LIMIT_WAIT_SENTENCES.reason);
  });

  it("states no price and names no code in what the site reads", () => {
    for (const [code, row] of reasons) for (const state of row.states) {
      const said = card(state, code);
      const text = `${said.title} ${said.reason} ${said.nextStep}`;
      expect(text, code).not.toMatch(/\$|\bUSD\b|\d+\s*(?:dollars|cents)/i);
      expect(text, code).not.toMatch(/\b[a-z]+_[a-z0-9_]+\b/);
    }
  });
});

describe("the words for the codes the sweep found", () => {
  const ours = "Nothing is needed from you. Your video is saved.";
  it("a privacy step on our side is said as privacy, waiting or ended", () => {
    for (const state of ["needs_input", "failed"]) for (const code of ["atlas_privacy_screen_unavailable",
      "website_atlas_provider_retention_decision_required", "provider_terms_not_configured_or_changed"])
      expect(card(state, code)).toMatchObject({ title: "Building the simulation of your site is paused on our side",
        reason: "A privacy step on our side has to be finished before it can go on.", nextStep: ours, actionOwner: "blueprint" });
  });
  it("a rights stop is said as the permission on record not covering the step, waiting or ended", () => {
    for (const state of ["needs_input", "failed"]) for (const code of ["website_atlas_pose_disclosure_not_authorized",
      "website_atlas_source_owner_mismatch", "website_atlas_consent_expired"])
      expect(card(state, code)).toMatchObject({ reason: "The permission on record for your video does not cover this step.",
        actionOwner: "none" });
    expect(card("failed", "atlas_runtime_authority_or_policy_changed")).toMatchObject({
      title: "Building the simulation of your site is paused",
      reason: "The permission on record for your video, or one of our own spending approvals, does not cover this step.", actionOwner: "none" });
  });
  it("a money stop is said as money, and promises no resumption the Pipeline does not make", () => {
    expect(card("needs_input", "atlas_runtime_budget_insufficient_for_pose_and_generation")).toMatchObject({
      title: "Your job is paused on our side", reason: "Your job is paused on our side for a spending limit.", nextStep: ours,
      actionOwner: "blueprint" });
    for (const code of ["atlas_runtime_price_review_expired", "paid_resource_admission_not_admitted", "paid_resource_a_later_blocker",
      "meta_sam_submission_requires_reconciliation"])
      expect(card("needs_input", code)).toMatchObject({ title: "Your job is paused on our side",
        reason: "Work on your job is paused on our side by one of our own spending checks.", nextStep: ours });
    // The Google Cloud budget's own policy file: the same money wait as its other codes.
    expect(card("needs_input", "gcp_monthly_budget_policy_invalid")).toMatchObject({
      reason: "Your job is paused on our side for a spending limit.", nextStep: "It resumes by itself; nothing is needed from you." });
  });
  it("a review refusal the same inputs repeat, and a stop the Pipeline names for itself, are a step on our side", () => {
    for (const code of ["atlas_scene_planner_intervals_invalid", "atlas_automation_frames_not_selected",
      "atlas_background_review_required", "atlas_preserved_completion_not_admitted"])
      expect(card("needs_input", code)).toMatchObject({ reason: "A step on our side has to be finished before it can go on." });
    // Read by the Pipeline as a wall by its words, though neither guards one: ours in either state.
    for (const code of ["atlas_scene_planner_context_budget_exceeded", "atlas_observed_room_privacy_selection_invalid"])
      expect(card("failed", code)).toMatchObject({ reason: "A step on our side has to be finished before it can go on." });
  });
  it("our own setup is said as setup on our side", () => {
    for (const code of ["website_atlas_api_key_missing", "website_atlas_api_base_url_missing", "website_atlas_runtime_policy_required"])
      expect(card("needs_input", code)).toMatchObject({ reason: "A setup step on our side has to be finished before it can go on.",
        actionOwner: "blueprint" });
  });
});

describe("each preparation status code the Pipeline can send", () => {
  const status = (terminal: string | null, out: Record<string, unknown> | null) => ({
    schema_version: "website_preparation_status.v7", state: terminal ? "failed_terminal" : "failed_retryable",
    terminal_reason: terminal, outcome: out, question: null, robot_fit: null, robot_fit_precheck: null }) as never;
  const finding = (reason: string, extra: Record<string, unknown> = {}) => ({ reason, category: "insufficient_evidence",
    basis: "missing_evidence", robot_id: null, evidence_digest: digest, ...extra });
  const { outcome_reasons, outcome_categories, outcome_causes, terminal_reasons } = fixture.preparation_status;

  it.each(terminal_reasons)("terminal reason %s raises no unknown-code alert", reason => {
    expect(unknownPreparationCodes(status(reason, null))).toEqual([]);
  });
  it.each(outcome_reasons)("outcome reason %s raises no unknown-code alert", reason => {
    expect(unknownPreparationCodes(status(null, finding(reason)))).toEqual([]);
  });
  it.each(outcome_categories)("outcome category %s raises no unknown-code alert", category => {
    expect(unknownPreparationCodes(status(null, finding("task_evidence_incomplete", { category })))).toEqual([]);
  });
  it.each(outcome_causes)("the cause %s of a preparation that is not possible has words", cause => {
    expect(unknownPreparationCodes(status(null, finding(outcome.PREPARATION_NOT_POSSIBLE_REASON, { cause })))).toEqual([]);
    expect(outcome.preparationNotPossible(cause, digest).reason).not.toBe(outcome.PREPARATION_NOT_POSSIBLE_SENTENCES.general);
  });
});
