// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import {
  deriveJobStage, JOB_STAGES, JOB_STAGE_LABELS, type JobFacts, type SceneHold, type TeamAccessReason,
} from "../utils/jobConsoleStage";
import { buildJobTimeline, projectJobFacts, type RawJobInputs } from "../utils/jobConsoleFacts";
import { teamJobAccess } from "../utils/teamJobAccess";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

const INVITE = "Invite approved robot teams to evaluate this job";

/** `teamAccess` as `teamJobAccess` reports a job it closes (still listed only for the last two checks). */
function closedTo(reason: TeamAccessReason, sceneHold: SceneHold | null = null): JobFacts["teamAccess"] {
  return { listed: reason === "recording_consent_missing" || reason === "scene_not_runnable",
    evaluationAvailable: false, reason, sceneHold };
}

function facts(overrides: DeepPartial<JobFacts> = {}): JobFacts {
  const base: JobFacts = {
    requestId: "job-1",
    createdAtIso: "2026-10-01T00:00:00.000Z",
    siteName: "Dock 4",
    siteLocation: "Austin, TX",
    company: "Acme",
    claimed: true,
    archived: false,
    brief: { state: "confirmed", unresolvedGates: 0 },
    capture: { state: "covered", missingViews: [] },
    listing: { state: "live" },
    teamAccess: { listed: true, evaluationAvailable: true, reason: null, sceneHold: null },
    evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] },
    runs: { queued: 0, running: 0, reported: 0, noResult: 0, passing: 0, belowTarget: 0, best: null },
    recommendation: { state: "none", recommendationId: null, teamId: null, teamName: null, evaluationRunId: null },
    booking: { state: "none", startsAt: null },
    withdrawal: { state: "none" },
    opsNotice: null,
    lastActivityIso: null,
  };
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = (base as unknown as Record<string, unknown>)[key];
    merged[key] = value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object"
      ? { ...(current as object), ...(value as object) }
      : value;
  }
  return merged as unknown as JobFacts;
}

describe("deriveJobStage", () => {
  it("labels every stage", () => {
    for (const stage of JOB_STAGES) expect(JOB_STAGE_LABELS[stage]).toBeTruthy();
  });

  describe("before any team asks", () => {
    it("asks Blueprint to draft a brief when nothing has arrived", () => {
      const result = deriveJobStage(facts({ brief: { state: "none" }, capture: { state: "none" }, listing: { state: "none" } }));
      expect(result).toMatchObject({ stage: "intake", actionOwner: "blueprint", nextAction: "Draft the task brief from the intake" });
    });

    it("tracks a queued brief review as Blueprint's", () => {
      const result = deriveJobStage(facts({ brief: { state: "review_pending" }, capture: { state: "none" } }));
      expect(result.stage).toBe("intake");
      expect(result.nextAction).toMatch(/Brief review is queued/);
    });

    it("waits on the site to confirm a draft brief and film", () => {
      const result = deriveJobStage(facts({ brief: { state: "draft" }, capture: { state: "none" } }));
      expect(result).toMatchObject({ stage: "brief_review", actionOwner: "site" });
    });

    it("waits on the site to film once the brief is confirmed", () => {
      expect(deriveJobStage(facts({ capture: { state: "none" } }))).toMatchObject({
        stage: "capture", actionOwner: "site", nextAction: "Waiting on site to film the work area" });
    });

    it("asks Blueprint to review coverage of an uploaded capture", () => {
      expect(deriveJobStage(facts({ capture: { state: "uploaded" } }))).toMatchObject({ stage: "capture", actionOwner: "blueprint" });
    });

    it("names the missing views when coverage is short", () => {
      const result = deriveJobStage(facts({ capture: { state: "coverage_short", missingViews: ["shelf end", "dock door", "aisle 3", "aisle 4"] } }));
      expect(result).toMatchObject({ stage: "capture", actionOwner: "site" });
      expect(result.nextAction).toBe("Waiting on site to add views: shelf end, dock door, aisle 3");
    });

    it("flags a failed scene for Blueprint", () => {
      expect(deriveJobStage(facts({ capture: { state: "scene_failed" } }))).toMatchObject({ stage: "capture", actionOwner: "blueprint" });
    });

    it("waits on the site to publish, re-approve or resume the public card", () => {
      const card = (state: JobFacts["listing"]["state"]) =>
        deriveJobStage(facts({ listing: { state }, teamAccess: closedTo("not_listed") }));
      expect(card("none")).toMatchObject({ stage: "listing", actionOwner: "site",
        nextAction: "Kept private: waiting on site to publish the public card" });
      expect(card("hidden")).toMatchObject({ stage: "listing", actionOwner: "site", nextAction: "Public card hidden by the site" });
      expect(card("review_required").nextAction).toBe("Waiting on site to re-approve the public card");
      expect(card("paused").nextAction).toBe("Listing paused by the site");
      // Switched on but not a grant teams can be shown: the card flag alone never opens a job.
      expect(card("live")).toMatchObject({ stage: "listing", actionOwner: "site",
        nextAction: "Waiting on site to re-approve the public card (the approval on file is not current)" });
      expect(deriveJobStage(facts({ listing: { state: "paused" }, teamAccess: closedTo("operator_paused") })))
        .toMatchObject({ stage: "listing", actionOwner: "site", nextAction: "Listing paused by the site" });
    });

    it("asks Blueprint to invite teams only when teams can evaluate the job", () => {
      expect(deriveJobStage(facts({ capture: { state: "scene_ready" } }))).toMatchObject({
        stage: "awaiting_teams", actionOwner: "blueprint", nextAction: INVITE });
      expect(deriveJobStage(facts({ capture: { state: "scene_ready" }, teamAccess: closedTo("rights_needs_review") })).stage)
        .not.toBe("awaiting_teams");
    });
  });

  describe("a job teams cannot evaluate", () => {
    // Every reason `teamJobAccess` gives, with what the console says instead of "invite".
    const byReason: Array<[TeamAccessReason, JobFacts["listing"]["state"], { stage: string; nextAction: string; actionOwner: string }]> = [
      ["not_listed", "none", { stage: "listing", actionOwner: "site", nextAction: "Kept private: waiting on site to publish the public card" }],
      ["operator_paused", "paused", { stage: "listing", actionOwner: "site", nextAction: "Listing paused by the site" }],
      ["kept_private", "live", { stage: "not_open", actionOwner: "blueprint",
        nextAction: "Private under the retired dossier: ask the site whether approved teams may see it" }],
      ["restricted_to_named_teams", "live", { stage: "not_open", actionOwner: "blueprint",
        nextAction: "Retired dossier names only certain teams: ask the site whether every approved team may see it" }],
      ["task_not_yet_supported", "live", { stage: "not_open", actionOwner: "none",
        nextAction: "No action: our simulation cannot score this kind of job yet" }],
      ["development_only", "live", { stage: "not_open", actionOwner: "none",
        nextAction: "No action: a development capture is never opened to teams" }],
      ["rights_needs_review", "live", { stage: "not_open", actionOwner: "blueprint",
        nextAction: "Rights review pending: review the capture's rights and privacy" }],
      ["rights_blocked", "live", { stage: "not_open", actionOwner: "blueprint",
        nextAction: "Rights review blocked the capture: resolve it with the site or request a new capture" }],
      ["recording_consent_missing", "live", { stage: "not_open", actionOwner: "site",
        nextAction: "Waiting on site to grant current recording permission" }],
      ["consent_withdrawn", "live", { stage: "withdrawn", actionOwner: "blueprint",
        nextAction: "Confirm the capture withdrawal reached the Pipeline" }],
      ["not_a_site_job", "none", { stage: "not_open", actionOwner: "none", nextAction: "No action: not a site's job" }],
      ["pipeline_placeholder", "none", { stage: "not_open", actionOwner: "none",
        nextAction: "No action: a Pipeline placeholder, not a site's job" }],
    ];

    it.each(byReason)("%s", (reason, listing, expected) => {
      const result = deriveJobStage(facts({ capture: { state: "scene_ready" }, listing: { state: listing }, teamAccess: closedTo(reason) }));
      expect(result).toMatchObject(expected);
    });

    // `scene_not_runnable`: the specific condition the runnable-scene check is missing.
    const byHold: Array<[SceneHold | null, { stage: string; nextAction: string; actionOwner: string }]> = [
      ["brief_unconfirmed", { stage: "brief_review", actionOwner: "site", nextAction: "Waiting on site to confirm the brief" }],
      ["clarification_review", { stage: "brief_review", actionOwner: "blueprint", nextAction: "Review the site's written clarification" }],
      ["screening_call", { stage: "brief_review", actionOwner: "blueprint", nextAction: "Book the screening call" }],
      ["not_now", { stage: "not_open", actionOwner: "none", nextAction: "No action: screening said not now, so no scene is built" }],
      ["unscreened", { stage: "brief_review", actionOwner: "blueprint",
        nextAction: "No screening decision on file: re-screen the confirmed brief" }],
      ["unclaimed", { stage: "capture", actionOwner: "site",
        nextAction: "Waiting on site to save the job to an account (the scene is built only for a claimed site)" }],
      ["scene_not_built", { stage: "capture", actionOwner: "none", nextAction: "Waiting on the Pipeline to build the scene" }],
      ["scene_not_proven", { stage: "capture", actionOwner: "none", nextAction: "Waiting on the Pipeline's runnable-scene proof" }],
      ["gates_open", { stage: "brief_review", actionOwner: "site", nextAction: "Waiting on site to answer the brief's open questions" }],
      [null, { stage: "not_open", actionOwner: "blueprint",
        nextAction: "Scene not proven runnable: check the job's screening and scene records" }],
    ];

    it.each(byHold)("scene_not_runnable: %s", (hold, expected) => {
      const result = deriveJobStage(facts({ capture: { state: "covered" }, teamAccess: closedTo("scene_not_runnable", hold) }));
      expect(result).toMatchObject(expected);
    });

    it("never asks anyone to invite teams to a closed job, at any stage", () => {
      const variants: Array<DeepPartial<JobFacts>> = [
        {},
        { runs: { reported: 2, belowTarget: 2 } },
        { runs: { noResult: 1 } },
        { evaluations: { total: 1, pendingAdmission: 1, admitted: 0, pending: [{ requestId: "e", teamName: "Nova", setupName: null }] } },
      ];
      const holds: Array<SceneHold | null> = byHold.map(([hold]) => hold);
      for (const [reason] of byReason) {
        for (const variant of variants) {
          const result = deriveJobStage(facts({ ...variant, capture: { state: "scene_ready" }, teamAccess: closedTo(reason) }));
          expect(result.stage).not.toBe("awaiting_teams");
          expect(result.nextAction).not.toMatch(/invite/i);
        }
      }
      for (const hold of holds) {
        const result = deriveJobStage(facts({ runs: { reported: 1, belowTarget: 1 }, teamAccess: closedTo("scene_not_runnable", hold) }));
        expect(result.nextAction).not.toMatch(/invite/i);
      }
      // A closed answer with no reason still fails closed.
      expect(deriveJobStage(facts({ teamAccess: { listed: false, evaluationAvailable: false, reason: null, sceneHold: null } })))
        .toMatchObject({ stage: "not_open", actionOwner: "blueprint" });
    });

    it("names what closed the job instead of inviting another team after a failed run", () => {
      expect(deriveJobStage(facts({ runs: { reported: 2, belowTarget: 2 }, listing: { state: "paused" }, teamAccess: closedTo("operator_paused") })))
        .toMatchObject({ stage: "no_passing_run", actionOwner: "site",
          nextAction: "No passing evaluation yet (2 runs below the pass mark). Listing paused by the site" });
      expect(deriveJobStage(facts({ runs: { noResult: 1 }, teamAccess: closedTo("scene_not_runnable", "scene_not_proven") })))
        .toMatchObject({ stage: "no_passing_run", actionOwner: "none",
          nextAction: "No passing evaluation yet (1 run without a result). Waiting on the Pipeline's runnable-scene proof" });
    });

    it("keeps the evaluation loop's step and flags the closure when teams are already engaged", () => {
      const pending = { total: 1, pendingAdmission: 1, admitted: 0, pending: [{ requestId: "e", teamName: "Nova", setupName: null }] };
      const admission = deriveJobStage(facts({ evaluations: pending, teamAccess: closedTo("rights_needs_review") }));
      expect(admission).toMatchObject({ stage: "admission", nextAction: "Admit evaluation for Nova", actionOwner: "blueprint" });
      expect(admission.attention).toEqual(["Not open to teams: the rights review has not cleared the capture"]);
      expect(deriveJobStage(facts({ runs: { reported: 1, passing: 1 }, teamAccess: closedTo("operator_paused") })).attention)
        .toEqual(["Not open to teams: paused by the site"]);
      expect(deriveJobStage(facts({ runs: { running: 1 }, teamAccess: closedTo("scene_not_runnable", "scene_not_proven") })).attention)
        .toEqual(["Not open to teams: the scene is not proven runnable"]);
      expect(deriveJobStage(facts({ evaluations: { ...pending, pendingAdmission: 0, admitted: 1, pending: [] },
        teamAccess: closedTo("development_only") })).attention).toEqual(["Not open to teams: a development capture"]);
      // Open jobs carry no such line.
      expect(deriveJobStage(facts({ evaluations: pending })).attention).toEqual([]);
    });

    it("keeps the site's earlier steps ahead of the closed answer", () => {
      const closed = { teamAccess: closedTo("scene_not_runnable", "scene_not_built") };
      expect(deriveJobStage(facts({ ...closed, capture: { state: "uploaded" } })))
        .toMatchObject({ stage: "capture", nextAction: "Review capture coverage", attention: [] });
      expect(deriveJobStage(facts({ ...closed, brief: { state: "draft" }, capture: { state: "none" } })))
        .toMatchObject({ stage: "brief_review", nextAction: "Waiting on site to confirm the brief and film the work area" });
      expect(deriveJobStage(facts({ withdrawal: { state: "requested" }, teamAccess: closedTo("consent_withdrawn") })))
        .toMatchObject({ stage: "withdrawn", nextAction: "Confirm the capture withdrawal reached the Pipeline" });
      expect(deriveJobStage(facts({ archived: true, teamAccess: closedTo("operator_paused") })).stage).toBe("closed");
    });
  });

  describe("evaluation loop", () => {
    it("names the team awaiting admission and counts the rest", () => {
      const result = deriveJobStage(facts({
        listing: { state: "none" },
        evaluations: { total: 2, pendingAdmission: 2, admitted: 0, pending: [
          { requestId: "eval-1", teamName: "Atlas Robotics", setupName: "Arm v2" },
          { requestId: "eval-2", teamName: null, setupName: null },
        ] },
      }));
      expect(result).toMatchObject({ stage: "admission", actionOwner: "blueprint",
        nextAction: "Admit evaluation for Atlas Robotics (+1 more)" });
    });

    it("falls back to a generic team label", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 1, admitted: 0,
        pending: [{ requestId: "eval-1", teamName: null, setupName: null }] } }));
      expect(result.nextAction).toBe("Admit evaluation for the requesting team");
    });

    it("waits while runs are queued or running", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 0, admitted: 1, pending: [] },
        runs: { queued: 1, running: 2 } }));
      expect(result).toMatchObject({ stage: "evaluating", actionOwner: "none", nextAction: "Evaluation in progress (2 running, 1 queued)" });
    });

    it("waits for an admitted run that is not recorded yet", () => {
      expect(deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 0, admitted: 1, pending: [] } })))
        .toMatchObject({ stage: "evaluating", nextAction: "Admitted; waiting for the run to be recorded" });
    });

    it("asks for a recommendation with passing runs counted", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 2, pendingAdmission: 1, admitted: 1, pending: [
        { requestId: "eval-2", teamName: "B", setupName: null }] }, runs: { reported: 3, passing: 2, belowTarget: 1 } }));
      expect(result).toMatchObject({ stage: "recommend", actionOwner: "blueprint", nextAction: "Recommend a team (2 passing runs)" });
      expect(result.attention).toContain("1 evaluation request awaiting admission");
    });

    it("reports when no run passed", () => {
      expect(deriveJobStage(facts({ runs: { reported: 2, belowTarget: 2 } }))).toMatchObject({
        stage: "no_passing_run", nextAction: "No passing evaluation yet (2 runs below the pass mark): invite or admit another team" });
      expect(deriveJobStage(facts({ runs: { noResult: 1 } })).nextAction).toMatch(/1 run without a result/);
    });

    it("lets a pending admission lead when nothing has passed", () => {
      expect(deriveJobStage(facts({ runs: { reported: 1, belowTarget: 1 }, evaluations: { total: 2, pendingAdmission: 1,
        admitted: 1, pending: [{ requestId: "e", teamName: "Nova", setupName: null }] } })).stage).toBe("admission");
    });
  });

  describe("recommendation and booking", () => {
    const recommended = { state: "recommended" as const, recommendationId: "rec_1", teamId: "team-1", teamName: "Atlas", evaluationRunId: "run_1" };

    it("waits on the site to book a recommendation", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, runs: { reported: 1, passing: 1 } })))
        .toMatchObject({ stage: "awaiting_booking", actionOwner: "site", nextAction: "Waiting on site to book Atlas" });
    });

    it("asks Blueprint to review a recommendation after the brief changed", () => {
      expect(deriveJobStage(facts({ recommendation: { ...recommended, state: "review_required" } })))
        .toMatchObject({ stage: "recommendation_review", actionOwner: "blueprint" });
    });

    it("asks Blueprint to schedule a booked pilot", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "awaiting_coordination" } })))
        .toMatchObject({ stage: "coordination", nextAction: "Schedule pilot with Atlas" });
    });

    it("reconciles a booking whose job changed", () => {
      expect(deriveJobStage(facts({ recommendation: { ...recommended, state: "review_required" }, booking: { state: "awaiting_coordination" } })).nextAction)
        .toMatch(/Reconcile the changed job/);
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "booked" } })).nextAction)
        .toMatch(/Reconcile the booking/);
    });

    it("shows a scheduled pilot's date", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "scheduled", startsAt: "2026-11-02T15:00:00.000Z" } })))
        .toMatchObject({ stage: "scheduled", actionOwner: "none", nextAction: "Pilot scheduled for 2026-11-02" });
    });
  });

  describe("overrides and attention", () => {
    it("puts withdrawal above every downstream state", () => {
      const result = deriveJobStage(facts({ withdrawal: { state: "cleanup_pending" }, booking: { state: "scheduled" },
        recommendation: { state: "recommended" } }));
      expect(result).toMatchObject({ stage: "withdrawn", actionOwner: "blueprint", nextAction: "Confirm capture withdrawal cleanup" });
      expect(deriveJobStage(facts({ withdrawal: { state: "legal_hold" } })).actionOwner).toBe("none");
      expect(deriveJobStage(facts({ withdrawal: { state: "complete" } })).actionOwner).toBe("none");
    });

    it("closes an archived job", () => {
      expect(deriveJobStage(facts({ archived: true, runs: { reported: 1, passing: 1 } })).stage).toBe("closed");
    });

    it("surfaces open ops notices and unclaimed jobs without changing the stage", () => {
      const result = deriveJobStage(facts({ claimed: false, opsNotice: { state: "open", summary: "Contact bounced" } }));
      expect(result.stage).toBe("awaiting_teams");
      expect(result.attention).toEqual(["Ops notice: Contact bounced", "Site has not claimed the job in an account"]);
      expect(deriveJobStage(facts({ opsNotice: { state: "resolved", summary: null } })).attention).toEqual([]);
    });
  });
});

describe("projectJobFacts", () => {
  function inputs(overrides: Partial<RawJobInputs> = {}): RawJobInputs {
    return {
      requestId: "job-1",
      record: {
        createdAt: "2026-10-01T00:00:00.000Z",
        account_owner_uid: "owner-1",
        request: { buyerType: "site_operator", consent_attestation: { granted: true } },
        workspace_task: { terms: { successRate: 80, cycleTimeSeconds: null } },
        public_task_listing: { enabled: true, wentLiveIso: "2026-10-03T00:00:00.000Z" },
        capture_coverage: { covers_scene: true },
      },
      site: { siteName: "Dock 4", siteLocation: "Austin, TX", company: "Acme" },
      brief: { confirmedAtIso: "2026-10-02T00:00:00.000Z", unresolved: [] },
      captureSession: null,
      evaluationRequests: [],
      runs: [],
      teamNames: new Map([["team-a", "Atlas"], ["team-b", "Nova"]]),
      ...overrides,
    };
  }

  it("projects a covered, live job with no requests", () => {
    const result = projectJobFacts(inputs());
    expect(result).toMatchObject({
      siteName: "Dock 4", claimed: true,
      brief: { state: "confirmed" }, capture: { state: "covered" }, listing: { state: "live" },
      recommendation: { state: "none" }, booking: { state: "none" }, withdrawal: { state: "none" },
    });
    // `enabled: true` alone is not a card grant teams are shown, so the console does not invite them.
    expect(result.teamAccess).toEqual({ listed: false, evaluationAvailable: false, reason: "not_listed", sceneHold: null });
    expect(deriveJobStage(result)).toMatchObject({ stage: "listing", actionOwner: "site" });
  });

  describe("teamAccess: teamJobAccess on the stored record", () => {
    const answers = { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
      deploymentTimeline: "this_quarter", accessWindow: "scheduled" };
    /** Every condition `teamJobAccess` checks, met. */
    function openRecord(): Record<string, any> {
      return {
        createdAt: "2026-10-01T00:00:00.000Z",
        account_owner_uid: "owner-1",
        request: { buyerType: "site_operator", capture_mode: "self_capture",
          consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-01T00:00:00.000Z" } },
        public_task_listing: { enabled: true, consentVersion: "public-task-card-v1", approvedAtIso: "2026-10-01T00:00:00.000Z",
          details: anonymizedOpportunityDraft("Pack cartons into totes") },
        site_task_brief_confirmed_at: "2026-10-02T00:00:00.000Z",
        siteTaskGates: answers,
        site_task_triage: { disposition: "qualified" },
        pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://fixture/scene/world/manifest.json" } },
        evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready", rights_review_status: "cleared" },
      };
    }
    const project = (record: Record<string, any>) => projectJobFacts(inputs({ record, captureSession: null }));
    const without = (change: (record: Record<string, any>) => void) => {
      const record = openRecord();
      change(record);
      return project(record);
    };

    it("opens the job, and only then invites teams", () => {
      const result = project(openRecord());
      expect(result.teamAccess).toEqual({ listed: true, evaluationAvailable: true, reason: null, sceneHold: null });
      expect(teamJobAccess(openRecord()).evaluationAvailable).toBe(true);
      // The rebuilt scene settles the capture even with a coverage review flag still set.
      expect(project({ ...openRecord(), capture_coverage_pending: true }).capture.state).toBe("scene_ready");
      expect(deriveJobStage(result)).toMatchObject({ stage: "awaiting_teams", actionOwner: "blueprint", nextAction: INVITE });
    });

    it("names the runnable-scene condition a job is missing", () => {
      const holds: Array<[string, (record: Record<string, any>) => void, SceneHold | null]> = [
        ["brief not confirmed", r => { delete r.site_task_brief_confirmed_at; }, "brief_unconfirmed"],
        ["clarification awaiting review", r => { r.site_task_triage = { disposition: "needs_conversation" };
          r.site_task_clarification = { state: "review_required" }; }, "clarification_review"],
        ["screening call", r => { r.site_task_triage = { disposition: "needs_conversation" }; }, "screening_call"],
        ["not now", r => { r.site_task_triage = { disposition: "not_now" }; }, "not_now"],
        ["no screening decision", r => { delete r.site_task_triage; }, "unscreened"],
        ["unclaimed, no scene", r => { delete r.account_owner_uid; delete r.pipeline; }, "unclaimed"],
        ["claimed, no scene", r => { delete r.pipeline; }, "scene_not_built"],
        // Blueprint-funded scene preparation needs no account.
        ["unclaimed, scene granted", r => { delete r.account_owner_uid; delete r.pipeline;
          r.website_scene_sponsorship = { purpose: "scene_preparation" }; }, "scene_not_built"],
        ["scene does not launch", r => { r.evaluation_readiness.runtime_launchable = false; }, "scene_not_proven"],
        ["nothing to score", r => { delete r.evaluation_readiness.benchmark_coverage_status; }, "scene_not_proven"],
        ["gate unanswered", r => { r.siteTaskGates = { ...answers, accessWindow: "" }; }, "gates_open"],
      ];
      for (const [label, change, hold] of holds) {
        const result = without(change);
        expect(result.teamAccess, label).toMatchObject({ evaluationAvailable: false, reason: "scene_not_runnable", sceneHold: hold });
        expect(deriveJobStage(result).stage, label).not.toBe("awaiting_teams");
      }
    });

    it("carries every other closed reason through unchanged", () => {
      const reasons: Array<[(record: Record<string, any>) => void, TeamAccessReason]> = [
        [r => { r.public_task_listing.enabled = false; }, "not_listed"],
        [r => { r.workspace_task = { paused: true }; }, "operator_paused"],
        [r => { r.evidence_tier = "development_only"; }, "development_only"],
        [r => { r.evaluation_readiness.rights_review_status = "needs_review"; }, "rights_needs_review"],
        [r => { r.pipeline.rights_review_status = "blocked"; }, "rights_blocked"],
        [r => { r.site_task_scope = { supported: false, reason: "deformable" }; }, "task_not_yet_supported"],
        [r => { r.request.pilotOpportunity = { requested: true, visibility: "private" }; }, "kept_private"],
        // The admin's decrypted view rebuilds `request` without the recording grant: why the stored record is read.
        [r => { delete r.request.consent_attestation; }, "recording_consent_missing"],
      ];
      for (const [change, reason] of reasons) {
        const result = without(change);
        expect(result.teamAccess).toMatchObject({ evaluationAvailable: false, reason, sceneHold: null });
        expect(result.teamAccess.reason).toBe(teamJobAccess((() => { const r = openRecord(); change(r); return r; })()).reason);
      }
    });
  });

  it("counts admitted and pending evaluation requests", () => {
    const result = projectJobFacts(inputs({ evaluationRequests: [
      { id: "eval-1", teamName: "Atlas", record: { workspace_evaluation: { opportunityId: "job-1", setupName: "Arm v2" } } },
      { id: "eval-2", teamName: "Nova", record: { workspace_evaluation: { opportunityId: "job-1" }, free_evaluation_handoff: { runId: "run_free_x" } } },
    ] }));
    expect(result.evaluations).toEqual({ total: 2, pendingAdmission: 1, admitted: 1,
      pending: [{ requestId: "eval-1", teamName: "Atlas", setupName: "Arm v2" }] });
    expect(deriveJobStage(result).nextAction).toBe("Admit evaluation for Atlas");
  });

  it("classifies runs against the job's pass mark and picks the best", () => {
    const result = projectJobFacts(inputs({ runs: [
      { runId: "r1", teamId: "team-a", state: "completed", requestedAtIso: "2026-10-04T00:00:00.000Z",
        result: { evidenceScope: "development_only", observed: { episodesRun: 200, episodesSucceeded: 180, successRate: 0.9, medianCycleSeconds: 12 } } },
      { runId: "r2", teamId: "team-b", state: "completed", requestedAtIso: "2026-10-05T00:00:00.000Z",
        result: { observed: { episodesRun: 200, episodesSucceeded: 80, successRate: 0.4, medianCycleSeconds: 30 } } },
      { runId: "r3", teamId: "team-b", state: "requested", dispatch: { startedAtIso: "2026-10-06T00:00:00.000Z" } },
      { runId: "r4", teamId: "team-b", state: "requested" },
      { runId: "r5", teamId: "team-a", state: "blocked" },
      { runId: "r6", teamId: "team-a", state: "abandoned" },
      { runId: "r7", teamId: "team-a", state: "completed", evaluationPurpose: "private",
        result: { observed: { episodesRun: 200, episodesSucceeded: 200, successRate: 1, medianCycleSeconds: 5 } } },
    ] }));
    expect(result.runs).toMatchObject({ queued: 1, running: 1, reported: 2, noResult: 1, passing: 1, belowTarget: 1 });
    expect(result.runs.best).toMatchObject({ runId: "r1", teamName: "Atlas", successRatePct: 90, meetsTarget: true });
    expect(deriveJobStage(result).nextAction).toBe("Recommend a team (1 passing run)");
  });

  it("never counts a run as passing once the site re-targeted the job after requesting it", () => {
    const passingRun = { runId: "r1", teamId: "team-a", state: "completed", requestedAtIso: "2026-10-04T00:00:00.000Z",
      result: { observed: { episodesRun: 200, episodesSucceeded: 180, successRate: 0.9, medianCycleSeconds: 12 } } };
    const request = (successRate: number) => ({ id: "eval-1", teamName: "Atlas", record: {
      workspace_evaluation: { opportunityId: "job-1", targetSnapshot: { successRate, cycleTimeSeconds: null } },
      free_evaluation_handoff: { runId: "r1" } } });
    const changed = projectJobFacts(inputs({ runs: [passingRun], evaluationRequests: [request(95)] }));
    expect(changed.runs).toMatchObject({ reported: 1, passing: 0, belowTarget: 1 });
    const unchanged = projectJobFacts(inputs({ runs: [passingRun], evaluationRequests: [request(80)] }));
    expect(unchanged.runs).toMatchObject({ reported: 1, passing: 1 });
  });

  it("reads recommendation, booking, coordination and withdrawal from the record", () => {
    const recommendation = { id: "rec_1", teamId: "team-a", teamName: "Atlas", recommendedAtIso: "2026-10-07T00:00:00.000Z", evaluationRunId: "r1" };
    const booked = projectJobFacts(inputs({ record: { ...inputs().record, pilot_recommendation: recommendation,
      pilot_booking: { recommendationId: "rec_1", state: "awaiting_coordination", acceptedAtIso: "2026-10-08T00:00:00.000Z" } } }));
    expect(booked.recommendation).toEqual({ state: "recommended", recommendationId: "rec_1", teamId: "team-a", teamName: "Atlas", evaluationRunId: "r1" });
    expect(booked.booking.state).toBe("awaiting_coordination");
    expect(booked.lastActivityIso).toBe("2026-10-08T00:00:00.000Z");

    const withdrawn = projectJobFacts(inputs({ record: { ...inputs().record, consent_revoked: true,
      capture_withdrawal: { state: "cleanup_retained_legal_hold", requestedAtIso: "2026-10-09T00:00:00.000Z" } } }));
    expect(withdrawn.withdrawal.state).toBe("legal_hold");
    expect(buildJobTimeline(inputs({ record: { ...inputs().record, consent_revoked: true } }), withdrawn).at(-1)).toMatchObject({ key: "withdrawn", done: true });
  });

  it("reads an ops notice defensively", () => {
    expect(projectJobFacts(inputs({ record: { ...inputs().record, ops_notice: { status: "open", message: "Call back" } } })).opsNotice)
      .toEqual({ state: "open", summary: "Call back" });
    expect(projectJobFacts(inputs({ record: { ...inputs().record, ops_notice: "Check contact" } })).opsNotice)
      .toEqual({ state: "open", summary: "Check contact" });
    expect(projectJobFacts(inputs()).opsNotice).toBeNull();
  });

  it("never invents a site name it could not decrypt", () => {
    expect(projectJobFacts(inputs({ site: null })).siteName).toBe("Unreadable site name");
  });

  it("derives brief, capture and listing states from what is recorded", () => {
    const record = { ...inputs().record, capture_coverage: null, public_task_listing: null };
    expect(projectJobFacts(inputs({ record, brief: null })).brief.state).toBe("none");
    expect(projectJobFacts(inputs({ record, brief: { confirmedAtIso: null } })).brief.state).toBe("draft");
    expect(projectJobFacts(inputs({ record: { ...record, briefReviewPending: true } })).brief.state).toBe("review_pending");
    expect(projectJobFacts(inputs({ record })).capture.state).toBe("none");
    expect(projectJobFacts(inputs({ record, captureSession: { immutable_upload_identity: {} } })).capture.state).toBe("uploaded");
    expect(projectJobFacts(inputs({ record, captureSession: { world_reconstruction: { state: "ready" } } })).capture.state).toBe("scene_ready");
    // The Pipeline's report of a rebuilt scene, as `teamJobAccess` reads it.
    expect(projectJobFacts(inputs({ record: { ...record, capture_coverage_pending: true,
      pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://fixture/world/manifest.json" } } } })).capture.state).toBe("scene_ready");
    expect(projectJobFacts(inputs({ record: { ...record, capture_coverage: { covers_scene: false, missing_coverage: ["dock"] } } })).capture)
      .toEqual({ state: "coverage_short", missingViews: ["dock"] });
    expect(projectJobFacts(inputs({ record })).listing.state).toBe("none");
    expect(projectJobFacts(inputs({ record: { ...record, public_task_listing: { enabled: false } } })).listing.state).toBe("hidden");
    expect(projectJobFacts(inputs({ record: { ...record, workspace_task: { paused: true } } })).listing.state).toBe("paused");
  });
});
