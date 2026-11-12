// @vitest-environment node
/**
 * The independent site-side review's probes (S/review-site/probes/review-probe-site-a.test.ts, P1 to P4), ported as
 * asserting tests of the fixed behaviour (review M1, M2, M3; P4 was already sound and stays pinned).
 */
import { describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { teamJobAccess, loadCompanyJobAccess } = await import("../utils/teamJobAccess");
const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
const { JOB_SHARED_LISTING_VERSION, recordingConsentWrite } = await import("../utils/jobSharedListing");
const { introductionMadeSiteCopy, notifySummarySharedIfVisible } = await import("../utils/taskLifecycleNotifications");
const { jobSharingOf } = await import("../utils/siteAnswer");
const { introduceSentence } = await import("../../client/src/lib/siteIntroductions");

const v4Job = () => ({ request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-11-12.v4",
  recorded_at_iso: "2026-11-12T10:00:00.000Z", recorded_by: "signed_owner_link" } },
  contact: { email: "owner@site.example" },
  public_task_listing: { enabled: true, consentVersion: JOB_SHARED_LISTING_VERSION, approvedAtIso: "2026-11-12T10:00:00.000Z",
    details: { title: "Packing opportunity", taskFamily: "Packing", siteType: "", region: "", objects: "", cycleTarget: "",
      pilotTiming: "", pilotBudget: "", opportunity: "open" } },
  summary_shared_notice: { owed: true },
  capture_privacy_screen: { proceeded: true, eligibility: "eligible" } });

describe("P1 (M1): 'Deployment companies we approve can now see your job' follows the whole rule", () => {
  it("is not sent, nor owed into the outbox, while the job has no sentence, and the page says preparing", async () => {
    sharedFakeFirestoreState.docs.clear();
    sharedFakeFirestoreState.docs.set("inboundRequests/req-p1", v4Job());
    expect(teamJobAccess(v4Job() as never).listed).toBe(true);
    expect((await loadCompanyJobAccess("req-p1")).access).toMatchObject({ listed: false, reason: "no_job_sentence" });
    expect(await taskLifecycleNotificationIsCurrent({ kind: "listing_live", requestId: "req-p1", idempotencyKey: "req-p1:listing_live:summary-1" })).toBe(false);
    expect(await notifySummarySharedIfVisible("req-p1")).toMatchObject({ enqueued: false, reason: "not_visible" });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
    expect(jobSharingOf(v4Job(), (await loadCompanyJobAccess("req-p1")).access)).toMatchObject({ state: "preparing" });
    // With its sentence, the same job is visible and the email may go.
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-p1", { requestId: "req-p1", summary: "Pack the boxes" });
    expect(await taskLifecycleNotificationIsCurrent({ kind: "listing_live", requestId: "req-p1", idempotencyKey: "req-p1:listing_live:summary-1" })).toBe(true);
  });
});

describe("P2 (M2): the site's 'Meet {company}' email never claims an answer it was not given", () => {
  it("says the stored answer's label, or no answer", () => {
    expect(introductionMadeSiteCopy({ name: "Robo Co", contactName: "Casey", email: "c@robo.example" }, "https://x/job", "Tested it: can do").body)
      .toContain("Robo Co answered Tested it: can do about your job");
    expect(introductionMadeSiteCopy({ name: "Robo Co", contactName: "Casey", email: "c@robo.example" }, "https://x/job").body)
      .not.toContain("answered Interested");
  });
});

describe("P3 (M3): the sentence beside 'Introduce us' says the address goes too", () => {
  it("names the address", () => {
    expect(introduceSentence("Company A")).toBe("We give Company A your name, address and contact details, and give you theirs.");
  });
});

describe("P4: accepting v4 on the job page (unchanged, pinned)", () => {
  const older = (version: string) => ({ request: { buyerType: "site_operator",
    consent_attestation: { granted: true, statement_version: version, recorded_at_iso: "2026-11-01T00:00:00.000Z" } },
    workspace_task: { paused: true }, terms_acceptance: { termsVersion: "2026-11-02.1" } });
  it("v3 then v4 upgrades, keeps the older grant, writes no site words, lifts the pause; withdrawn is held; an old tab shares nothing", () => {
    const write = recordingConsentWrite({ record: older("2026-11-11.v3"), statementVersion: "2026-11-12.v4", atIso: "2026-11-12T12:00:00.000Z",
      taskStatement: "Pack boxes at 12 Elm St for ACME", hasCurrentGrant: true, canGrantInitial: true, revoked: false }) as any;
    expect(write).toMatchObject({ outcome: "upgraded", unpause: true });
    expect(JSON.stringify(write.listing)).not.toMatch(/Elm|ACME/);
    expect(recordingConsentWrite({ record: older("2026-11-11.v3"), statementVersion: "2026-11-12.v4", atIso: "x", taskStatement: null,
      hasCurrentGrant: false, canGrantInitial: false, revoked: true })).toEqual({ outcome: "held" });
    expect((recordingConsentWrite({ record: { request: { buyerType: "site_operator" } }, statementVersion: "2026-11-11.v3", atIso: "x",
      taskStatement: null, hasCurrentGrant: false, canGrantInitial: true, revoked: false }) as any).listing).toBeNull();
  });
});
