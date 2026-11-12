// @vitest-environment node
/**
 * The deletion notice the Terms promise (review M4): one email to each approved deployment company a withdrawn job was
 * sent to, in fixed words, carrying nothing of the site. OFFLINE: the real withdrawal against the fake Firestore.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/pipelineCompanyRecheck", () => ({ recheckCaptureInBackground: vi.fn(), askPipelineToRecheckCapture: vi.fn() }));

const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
const { withdrawalNoticeIsCurrent, WITHDRAWAL_COMPANY_SUBJECT } = await import("../utils/withdrawalCompanyNotice");

const ID = "req-wd";
const PLANTED = ["SITE-NAME-PLANT", "123 PLANT STREET", "owner-plant@site.example", "+1 555 0100 PLANT", "Pat Plantsubmitter",
  "SENTENCE-PLANT stack the cartons"];
const company = (tag: string, extra: Record<string, unknown> = {}) => ({ status: "approved", partnerRole: "deployment",
  company: `${tag} Robotics`, email: `${tag.toLowerCase()}@co.example`, name: `${tag} Person`, ...extra });

beforeEach(() => {
  state.docs.clear();
  state.docs.set(`inboundRequests/${ID}`, { requestId: ID,
    contact: { email: PLANTED[2], phone: PLANTED[3], firstName: PLANTED[4] },
    request: { buyerType: "site_operator", siteName: PLANTED[0], siteLocation: PLANTED[1], taskStatement: PLANTED[5],
      consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: "2026-11-12T10:00:00.000Z" } },
    public_task_listing: { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: "2026-11-12T10:00:00.000Z",
      details: { title: "Pallet handling opportunity" } } });
  state.docs.set("robotTeamAccess/north", company("North"));
  state.docs.set("robotTeamAccess/south", company("South"));
  state.docs.set("robotTeamAccess/tech", company("Tech", { partnerRole: "technology" }));
  state.docs.set("robotTeamAccess/gone", company("Gone", { status: "declined" }));
  state.docs.set("robotTeamAccess/void", company("Void"));
  state.docs.set("robotTeamAccess/unsent", company("Unsent"));
  const send = (id: string, companyId: string, sentAtIso: string, extra: Record<string, unknown> = {}) =>
    state.docs.set(`inboundRequests/${ID}/companySends/${id}`, { companyId, sentAtIso, sentBy: "system", ...extra });
  send("s1", "north", "2026-11-12T11:00:00.000Z");
  send("s2", "north", "2026-11-13T11:00:00.000Z");
  send("s3", "south", "2026-11-12T12:00:00.000Z");
  send("s4", "tech", "2026-11-12T12:00:00.000Z");
  send("s5", "gone", "2026-11-12T12:00:00.000Z");
  send("s6", "void", "2026-11-12T12:00:00.000Z", { voidedAtIso: "2026-11-12T13:00:00.000Z" });
});

const rows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));

describe("the withdrawal's deletion notice to companies", () => {
  it("queues one fixed email to each approved deployment company the job was sent to, and only those", async () => {
    await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "signed_owner_link", authorize: () => undefined });
    const notices = rows().filter(row => row.kind === "job_withdrawn_company");
    expect(notices.map(row => row.key).sort()).toEqual([`captureOutbox/${ID}:job_withdrawn_company:north`, `captureOutbox/${ID}:job_withdrawn_company:south`]);
    const north = notices.find(row => row.to === "north@co.example")!;
    expect(north).toMatchObject({ status: "pending", subject: WITHDRAWAL_COMPANY_SUBJECT,
      body: "A site has withdrawn a job you were sent on November 12, 2026: Pallet handling opportunity. It has left your job library. "
        + "If you saved its video or its simulation, delete your copy now." });
    // Plant and prove: nothing of the site reaches any notice.
    const text = JSON.stringify(notices);
    for (const planted of PLANTED) expect(text, planted).not.toContain(planted);
  });

  it("is queued once per job and company: a second withdrawal call adds nothing", async () => {
    await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "signed_owner_link", authorize: () => undefined });
    const first = rows().length;
    await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "signed_owner_link", authorize: () => undefined });
    expect(rows()).toHaveLength(first);
  });

  it("never uses free text for the title", async () => {
    const record = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    record.public_task_listing.details.title = "Acme at 123 PLANT STREET";
    await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "signed_owner_link", authorize: () => undefined });
    for (const row of rows().filter(item => item.kind === "job_withdrawn_company")) {
      expect(row.body).toContain(": Work assessment opportunity.");
      expect(row.body).not.toContain("PLANT");
    }
  });

  it("is sent whatever the company's optional-updates choice, and not to a company no longer approved", async () => {
    state.docs.set("robotTeamAccess/north", company("North", { newJobAlertsOptIn: false, updatePreferences: { newJobAlerts: false } }));
    const entry = (companyId: string) => ({ kind: "job_withdrawn_company", requestId: ID, idempotencyKey: `${ID}:job_withdrawn_company:${companyId}` });
    expect(await withdrawalNoticeIsCurrent(entry("north"))).toBe(true);
    state.docs.set("robotTeamAccess/north", company("North", { status: "declined" }));
    expect(await withdrawalNoticeIsCurrent(entry("north"))).toBe(false);
    state.docs.set("robotTeamAccess/north", company("North", { partnerRole: "technology" }));
    expect(await withdrawalNoticeIsCurrent(entry("north"))).toBe(false);
    expect(await withdrawalNoticeIsCurrent({ kind: "job_withdrawn_company", requestId: ID })).toBe(false);
    expect(await withdrawalNoticeIsCurrent({ kind: "listing_live", requestId: ID })).toBe(true);
  });
});
