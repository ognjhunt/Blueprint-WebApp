// OFFLINE: pure projection of the site task context; no store, provider or Pipeline call.
// Lead decision 2026-11-07: a confirmation records consent and the site's answers to the screening gates.
// Neither changes what the task is or any preparation artifact, unless an answer corrects our proposal.
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { draftBrief, type SiteTaskBriefRecord } from "../utils/siteTaskBrief";
import { preparationGrantFollowsBrief } from "../utils/preparationGrantTask";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  confirmationParentContextDigests, preparationGrantContextDigest, projectWebsiteCaptureRights, projectWebsiteTaskContext,
} from "../utils/websiteTaskContext";

const purpose = "scene_preparation" as const;
const record = { request: { consent_attestation: { statement_version: "2026-11-01.v1", recorded_at_iso: "2026-11-06T10:00:00.000Z",
  accepted: true, granted: true } } };
const rights = projectWebsiteCaptureRights(record);

/** A navigation job drafted from the site's own description: Blueprint proposed the task shape from it. */
function drafted(): SiteTaskBriefRecord {
  return { ...draftBrief({ requestId: "synthetic-aisle", summary: "Walk down the aisle to its far end without touching the shelves.",
    proposed: [{ fieldId: "taskShape", value: "single", basis: "description", reading: "One walk, one goal." }] }),
  draftedAtIso: "2026-11-06T12:00:00.000Z", taskFamily: "general_task" };
}

/** The site's one click on its review (`confirmBrief`): our description-based proposals become its answers. */
function confirmed(brief: SiteTaskBriefRecord, change: Partial<SiteTaskBriefRecord> = {}): SiteTaskBriefRecord {
  const answers = Object.fromEntries(brief.proposed.filter(answer => answer.basis === "description")
    .map(answer => [answer.fieldId, answer.value]));
  return { ...brief, confirmedAtIso: "2026-11-07T14:30:45.016Z", confirmedBy: "site-owner", operatorAnswers: answers,
    operatorUnknown: [], successCriteria: { successDefinition: null, successRate: null, cycleTimeSeconds: null, unknown: true },
    unresolved: brief.unresolved.filter(fieldId => !answers[fieldId]), taskFamily: "general_task", ...change };
}

function grantFor(context: { context_digest: string; capture_id: string }) {
  return { purpose, task_context_digest: context.context_digest, capture_id: context.capture_id };
}

describe("a brief confirmed after its preparation names the parent that preparation sealed", () => {
  it("the library shape: accepting our proposal and marking nothing unknown keeps the sealed parent, byte for byte", () => {
    const brief = drafted();
    const sealed = projectWebsiteTaskContext(brief, rights, { purpose });
    expect(sealed).toMatchObject({ confirmed: false, confirmed_at: null, operator_answers: {}, task_family: "general_task" });
    expect(sealed.unresolved.length).toBeGreaterThan(0);
    expect("success_criteria" in sealed).toBe(false);
    const site = confirmed(brief);
    const withGrant = { ...record, website_scene_sponsorship: grantFor(sealed) };
    expect(preparationGrantContextDigest(withGrant)).toBe(sealed.context_digest);
    const current = projectWebsiteTaskContext(site, rights, { purpose, preparationGrantContextDigest: preparationGrantContextDigest(withGrant) });
    // The answers, the unknown gates and the empty success criteria changed; the task did not.
    expect(current).toMatchObject({ confirmed: true, confirmed_at: "2026-11-07T14:30:45.016Z", operator_answers: { taskShape: "single" },
      unresolved: [], success_criteria: { unknown: true }, task_family: "general_task", description: sealed.description });
    // The parent it names is the digest the preparation sealed, the same string, inside this context's own seal.
    expect(current.confirmation_parent_context_digest).toBe(sealed.context_digest);
    const { context_digest: digest, ...content } = current;
    expect(canonicalArtifactDigest(content, "context_digest")).toBe(digest);
    expect(confirmationParentContextDigests(site, rights, { purpose })).toContain(sealed.context_digest);
    // The preparation grant issued for the parent follows it.
    expect(preparationGrantFollowsBrief({ ...grantFor(sealed), authority_digest: "x" }, { brief: site, record })).toBe(true);
  });

  it("a gate the site marks unknown is still the same task", () => {
    const brief = drafted();
    const sealed = projectWebsiteTaskContext(brief, rights, { purpose });
    const site = confirmed(brief, { operatorUnknown: [brief.unresolved[0]] });
    expect(projectWebsiteTaskContext(site, rights, { purpose, preparationGrantContextDigest: sealed.context_digest })
      .confirmation_parent_context_digest).toBe(sealed.context_digest);
  });

  it.each([
    ["a corrected answer", { operatorAnswers: { taskShape: "multiple" } }],
    ["a stated success definition", { successCriteria: { successDefinition: "Reaches the far end", successRate: null,
      cycleTimeSeconds: null, unknown: false } }],
    ["a stated success rate", { successCriteria: { successDefinition: null, successRate: 90, cycleTimeSeconds: null, unknown: false } }],
    ["an edited summary", { summary: "Walk down the other aisle." }],
    ["item details", { operatorTaskDetails: { item_weight: "2 kg" } }],
  ] as const)("%s is task content: no parent is named and the grant does not follow", (_name, change) => {
    const brief = drafted();
    const sealed = projectWebsiteTaskContext(brief, rights, { purpose });
    const site = confirmed(brief, change as Partial<SiteTaskBriefRecord>);
    const current = projectWebsiteTaskContext(site, rights, { purpose, preparationGrantContextDigest: sealed.context_digest });
    expect("confirmation_parent_context_digest" in current).toBe(false);
    expect(confirmationParentContextDigests(site, rights, { purpose })).not.toContain(sealed.context_digest);
    expect(preparationGrantFollowsBrief({ ...grantFor(sealed), authority_digest: "x" }, { brief: site, record })).toBe(false);
  });

  it("a job prepared after its confirmation keeps today's context and digest", () => {
    const site = confirmed(drafted());
    const today = projectWebsiteTaskContext(site, rights, { purpose });
    expect("confirmation_parent_context_digest" in today).toBe(false);
    // Its grant names the confirmed context itself, which is no parent of it.
    expect(projectWebsiteTaskContext(site, rights, { purpose, preparationGrantContextDigest: today.context_digest }))
      .toEqual(today);
  });

  it("a confirmation that changed nothing but the confirmation names no parent: it is recognised from the context", () => {
    const brief = { ...drafted(), operatorAnswers: {}, operatorUnknown: [] };
    const sealed = projectWebsiteTaskContext(brief, rights, { purpose });
    const site = { ...brief, confirmedAtIso: "2026-11-07T14:30:45.016Z" };
    expect(confirmationParentContextDigests(site, rights, { purpose })).toContain(sealed.context_digest);
    expect("confirmation_parent_context_digest" in projectWebsiteTaskContext(site, rights,
      { purpose, preparationGrantContextDigest: sealed.context_digest })).toBe(false);
  });
});
