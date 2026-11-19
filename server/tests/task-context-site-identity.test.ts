// @vitest-environment node
/**
 * The Pipeline never receives the site's identity (`websiteTaskContext.ts`, data minimisation): the task context it
 * reads carries the site's own words with its name, organisation, contact names, typed address, email, phone and any
 * street address removed, for a job created under that rule. What this pins:
 * - a brief whose text holds nothing of the site projects byte for byte as it did before the rule, with the same
 *   digest, for a new job and an old one alike (the expected values below were produced by the projection on
 *   origin/main before this change, from the same fixtures);
 * - a job created before the rule keeps its context as typed, byte for byte, whatever its text holds, so nothing bound
 *   to its digest (its grant, the Pipeline's sealed context) changes while it is in flight;
 * - a new job's sentence, answers, object details and success definition reach the Pipeline without the site's
 *   identity, and nothing else in the context moves;
 * - on a new job, a confirmation that only accepts our proposals still names the sealed parent (the lineage holds);
 * - the upload manifest carries the same cleaned sentence.
 */
import { describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import * as F from "./helpers/taskContextIdentityFixtures";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});

const { projectWebsiteTaskContext, confirmationParentContextDigests, taskContextSiteIdentity, manifestTaskDescription,
  TASK_CONTEXT_IDENTITY_FIELD } = await import("../utils/websiteTaskContext");
const { projectWebsiteCaptureRights } = await import("../utils/websiteCaptureRights");

/** The projection on origin/main (6d7351517), before the rule, on the fixtures: its exact JSON and digest. */
const BEFORE = {
  plain: { digest: "sha256:c18461dc98336de516230533b650b32ba33e0af7c634c927f4217b45c882ea7c",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"Move the blue tray from the counter to the back shelf, 3 times an hour.\",\"task_family\":\"rigid_pick_and_place\",\"confirmed\":false,\"confirmed_at\":null,\"operator_answers\":{\"where\":\"Back room\",\"how_often\":\"3 times an hour\"},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"operator_task_details\":{\"item_weight\":\"about 2 kg\",\"item_make_model\":\"house tray\"},\"success_criteria\":{\"successDefinition\":\"Tray on the shelf\",\"successRate\":90,\"cycleTimeSeconds\":30,\"unknown\":false},\"task_evidence_provenance\":{\"item_details\":\"owner_stated_unverified\",\"success_criteria\":\"owner_stated_target\",\"success_rate_unit\":\"percent\",\"cycle_time_unit\":\"seconds\",\"physical_measurements_verified\":false},\"context_digest\":\"sha256:c18461dc98336de516230533b650b32ba33e0af7c634c927f4217b45c882ea7c\"}" },
  plainPreparation: { digest: "sha256:de3587c8f4c307e1646ad8d1c7c5b0196f385935b772631fc1da5b20ef3e89c9",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"purpose\":\"scene_preparation\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"Move the blue tray from the counter to the back shelf, 3 times an hour.\",\"task_family\":\"rigid_pick_and_place\",\"confirmed\":false,\"confirmed_at\":null,\"operator_answers\":{\"where\":\"Back room\",\"how_often\":\"3 times an hour\"},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"operator_task_details\":{\"item_weight\":\"about 2 kg\",\"item_make_model\":\"house tray\"},\"success_criteria\":{\"successDefinition\":\"Tray on the shelf\",\"successRate\":90,\"cycleTimeSeconds\":30,\"unknown\":false},\"task_evidence_provenance\":{\"item_details\":\"owner_stated_unverified\",\"success_criteria\":\"owner_stated_target\",\"success_rate_unit\":\"percent\",\"cycle_time_unit\":\"seconds\",\"physical_measurements_verified\":false},\"context_digest\":\"sha256:de3587c8f4c307e1646ad8d1c7c5b0196f385935b772631fc1da5b20ef3e89c9\"}" },
  foldable: { digest: "sha256:7269821eb4019cbaf57669663475df5d0d98290e3efd012ab58deffdc654456e",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"  Move the caf\u00e9 trays  to the back shelf ,then wipe the counter .  \",\"task_family\":\"general_task\",\"confirmed\":false,\"confirmed_at\":null,\"operator_answers\":{\"where\":\"Cr\u00e8me room  (north side)\"},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"context_digest\":\"sha256:7269821eb4019cbaf57669663475df5d0d98290e3efd012ab58deffdc654456e\"}" },
  parent: { digest: "sha256:8af7f39dd5ea7c461be43abf8caca13f27f2c00b18480c5bda5601d490af14b6",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"purpose\":\"scene_preparation\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"Stack the 12 kg cartons onto the pallet by the dock.\",\"task_family\":\"general_task\",\"confirmed\":false,\"confirmed_at\":null,\"operator_answers\":{},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"context_digest\":\"sha256:8af7f39dd5ea7c461be43abf8caca13f27f2c00b18480c5bda5601d490af14b6\"}" },
  confirmed: { digest: "sha256:fd431ea25537f1cc57d0039cc3e24c625766506789a0e0e6362e01307761f8cd",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"purpose\":\"scene_preparation\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"Stack the 12 kg cartons onto the pallet by the dock.\",\"task_family\":\"general_task\",\"confirmed\":true,\"confirmed_at\":\"2026-11-13T09:00:00.000Z\",\"operator_answers\":{\"where\":\"By the dock\"},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"confirmation_parent_context_digest\":\"sha256:8af7f39dd5ea7c461be43abf8caca13f27f2c00b18480c5bda5601d490af14b6\",\"context_digest\":\"sha256:fd431ea25537f1cc57d0039cc3e24c625766506789a0e0e6362e01307761f8cd\"}" },
  identityRaw: { digest: "sha256:83acfd65b380ff8a505c15aab0e0860b44ba822b19c8d8308b19f7decbe76f84",
    json: "{\"schema_version\":\"website_site_task_context.v1\",\"purpose\":\"scene_preparation\",\"request_id\":\"capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"scene_id\":\"site-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"capture_id\":\"walkthrough-capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10\",\"description\":\"Stack 12 kg cartons onto the pallet at Zorblax Provisions, 4417 Marrowbone Avenue, Glimmerton. Ask Thaddeus Vexworthy on +1 (628) 555-0199 or thaddeus.vexworthy@zorblax-plant.example. Overflow to 88 Brindle Road.\",\"task_family\":\"general_task\",\"confirmed\":false,\"confirmed_at\":null,\"operator_answers\":{\"where\":\"Dock 2 at Zorblax Provisions\",\"contact\":\"Thaddeus on +1 (628) 555-0199\",\"shifts\":\"2 shifts\"},\"unresolved\":[],\"capture_rights\":{\"derived_scene_generation_allowed\":true,\"data_licensing_allowed\":false,\"capture_contributor_payout_eligible\":false,\"consent_status\":\"granted\",\"consent_revoked\":false,\"consent_scope\":[\"derived_scene_generation\",\"robot_evaluation\"],\"statement_version\":\"2026-11-12.v4\",\"recorded_at_iso\":\"2026-11-12T10:00:00.000Z\"},\"operator_task_details\":{\"item_weight\":\"about 12 kg\",\"item_make_model\":\"Quillfeather Holdings own-brand carton\"},\"success_criteria\":{\"successDefinition\":\"Pallet wrapped; Thaddeus signs it off\",\"successRate\":95,\"cycleTimeSeconds\":40,\"unknown\":false},\"task_evidence_provenance\":{\"item_details\":\"owner_stated_unverified\",\"success_criteria\":\"owner_stated_target\",\"success_rate_unit\":\"percent\",\"cycle_time_unit\":\"seconds\",\"physical_measurements_verified\":false},\"context_digest\":\"sha256:83acfd65b380ff8a505c15aab0e0860b44ba822b19c8d8308b19f7decbe76f84\"}" },
} as const;

const rights = projectWebsiteCaptureRights(F.RIGHTS_RECORD);
const NEW_JOB = { ...F.IDENTITY_RECORD, [TASK_CONTEXT_IDENTITY_FIELD]: true };
const OLD_JOB = F.IDENTITY_RECORD;

describe("a brief whose text holds nothing of the site", () => {
  it.each([["a new job", NEW_JOB], ["an old job", OLD_JOB]])("projects byte for byte as before the rule, with the same digest: %s",
    async (_name, record) => {
      const siteIdentity = await taskContextSiteIdentity(record);
      const project = (brief: typeof F.PLAIN_BRIEF, evidence: Record<string, unknown> = {}) =>
        JSON.stringify(projectWebsiteTaskContext(brief, rights, { siteIdentity, ...evidence }));
      expect(project(F.PLAIN_BRIEF)).toBe(BEFORE.plain.json);
      expect(project(F.PLAIN_BRIEF, { purpose: "scene_preparation", captureId: `walkthrough-${F.REQUEST_ID}` }))
        .toBe(BEFORE.plainPreparation.json);
      // Accents, doubled and edge spaces: the cleaning never folds or tidies a text it removes nothing from.
      expect(project(F.FOLDABLE_BRIEF)).toBe(BEFORE.foldable.json);
      expect(project(F.PROPOSED_BRIEF, { purpose: "scene_preparation" })).toBe(BEFORE.parent.json);
      // A confirmed successor still names the parent its grant was issued for, and the parent is still recognised.
      expect(project(F.CONFIRMED_BRIEF, { purpose: "scene_preparation", preparationGrantContextDigest: BEFORE.parent.digest }))
        .toBe(BEFORE.confirmed.json);
      expect(confirmationParentContextDigests(F.CONFIRMED_BRIEF, rights, { siteIdentity, purpose: "scene_preparation" }))
        .toContain(BEFORE.parent.digest);
      for (const [key, value] of Object.entries(BEFORE)) if (key !== "identityRaw")
        expect(JSON.parse(value.json).context_digest).toBe(value.digest);
    });
});

describe("a job created before the rule", () => {
  it("keeps its context as typed, byte for byte, whatever its text holds: nothing bound to its digest changes", async () => {
    expect(await taskContextSiteIdentity(OLD_JOB)).toBeNull();
    const context = projectWebsiteTaskContext(F.IDENTITY_BRIEF, rights,
      { siteIdentity: await taskContextSiteIdentity(OLD_JOB), purpose: "scene_preparation" });
    expect(JSON.stringify(context)).toBe(BEFORE.identityRaw.json);
    expect(context.context_digest).toBe(BEFORE.identityRaw.digest);
  });
});

describe("a job created under the rule", () => {
  const ANY_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;
  const ANY_PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
  const ANY_STREET = /\b\d{1,6}\s+(?:[A-Z][\w'.-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl)\b/;

  it("sends its sentence, answers, object details and success definition without the site's identity", async () => {
    const siteIdentity = await taskContextSiteIdentity(NEW_JOB);
    expect(siteIdentity).not.toBeNull();
    const context = projectWebsiteTaskContext(F.IDENTITY_BRIEF, rights, { siteIdentity, purpose: "scene_preparation" });
    const raw = JSON.stringify(context);
    for (const planted of F.PLANTED) expect(raw.toLowerCase(), planted).not.toContain(planted.toLowerCase());
    for (const pattern of [ANY_EMAIL, ANY_PHONE, ANY_STREET]) expect(raw).not.toMatch(pattern);
    // The job itself is still there: what moves, how heavy, how often, and what counts as done.
    expect(context.description).toMatch(/^Stack 12 kg cartons onto the pallet at the site/);
    expect(context.operator_answers).toEqual({ where: "Dock 2 at the site", contact: "The site on [removed]", shifts: "2 shifts" });
    expect(context.operator_task_details).toEqual({ item_weight: "about 12 kg", item_make_model: "The site own-brand carton" });
    expect(context.success_criteria).toEqual({ successDefinition: "Pallet wrapped; The site signs it off", successRate: 95,
      cycleTimeSeconds: 40, unknown: false });
    // Nothing else in the context moves.
    const before = JSON.parse(BEFORE.identityRaw.json) as Record<string, unknown>;
    const changed = Object.keys({ ...before, ...context }).filter(key =>
      JSON.stringify(before[key]) !== JSON.stringify((context as Record<string, unknown>)[key])).sort();
    expect(changed).toEqual(["context_digest", "description", "operator_answers", "operator_task_details", "success_criteria"]);
  });

  it("a confirmation that only accepts our proposals still names the sealed parent: the lineage holds on the cleaned text", async () => {
    const siteIdentity = await taskContextSiteIdentity(NEW_JOB);
    const proposed = { ...F.PROPOSED_BRIEF, summary: "Stack the cartons onto the pallet at Zorblax Provisions.",
      proposed: [{ fieldId: "where", value: "By the Zorblax dock", basis: "description" }] } as typeof F.PROPOSED_BRIEF;
    const confirmed = { ...proposed, confirmedAtIso: "2026-11-13T09:00:00.000Z", operatorAnswers: { where: "By the Zorblax dock" } };
    const parent = projectWebsiteTaskContext(proposed, rights, { siteIdentity, purpose: "scene_preparation" });
    expect(parent.description).toBe("Stack the cartons onto the pallet at the site.");
    const successor = projectWebsiteTaskContext(confirmed, rights, { siteIdentity, purpose: "scene_preparation",
      preparationGrantContextDigest: parent.context_digest });
    expect(successor).toMatchObject({ confirmed: true, operator_answers: { where: "By the site dock" },
      confirmation_parent_context_digest: parent.context_digest });
    expect(confirmationParentContextDigests(confirmed, rights, { siteIdentity, purpose: "scene_preparation" }))
      .toContain(parent.context_digest);
    expect(JSON.stringify([parent, successor])).not.toMatch(/Zorblax/i);
  });

  it("a text that was nothing but the site's identity reads [removed], never empty (the Pipeline needs a description)", async () => {
    const siteIdentity = await taskContextSiteIdentity(NEW_JOB);
    const context = projectWebsiteTaskContext({ ...F.PLAIN_BRIEF, summary: "at 4417 Marrowbone Avenue" }, rights, { siteIdentity });
    expect(context.description).toBe("[removed]");
  });

  it("the upload manifest carries the same cleaned sentence; an old job's goes as typed", async () => {
    state.docs.clear();
    state.docs.set(`inboundRequests/new-job`, NEW_JOB);
    state.docs.set(`inboundRequests/old-job`, OLD_JOB);
    const cleaned = await manifestTaskDescription("new-job", F.IDENTITY_BRIEF.summary);
    expect(cleaned).toBe(projectWebsiteTaskContext(F.IDENTITY_BRIEF, rights,
      { siteIdentity: await taskContextSiteIdentity(NEW_JOB) }).description);
    expect(await manifestTaskDescription("old-job", F.IDENTITY_BRIEF.summary)).toBe(F.IDENTITY_BRIEF.summary);
    expect(await manifestTaskDescription("new-job", F.PLAIN_BRIEF.summary)).toBe(F.PLAIN_BRIEF.summary);
  });
});
