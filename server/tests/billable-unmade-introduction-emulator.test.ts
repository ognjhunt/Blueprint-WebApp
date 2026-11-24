// @vitest-environment node
/**
 * Owner, 2026-11-23: a billable event counts only once its introduction is made (the company's email was sent); one
 * recorded but not made is shown to staff apart. Real transactions in the Firestore emulator; the mail provider is
 * replaced by a fake that answers like a provider 503 (an unknown outcome). Nothing is delivered and no schedulers run.
 *
 * The site presses Introduce us; the delivery pass gets the 503; the site withdraws; a pass 61 s later. The company's
 * email stays `unknown` and the site's held, so the event has no made time: the staff totals show 0 billable and 1 not
 * made, and the event itself is left exactly as recorded.
 *
 * Run (takes the emulator lock):
 *   flock /tmp/blueprint-audit-emulators.lock npx -y firebase-tools@13.35.1 emulators:exec --only firestore \
 *     --project demo-blueprint-billable --config firebase.json \
 *     "BLUEPRINT_BILLABLE_EMULATOR_TEST=1 npx vitest run server/tests/billable-unmade-introduction-emulator.test.ts"
 */
import { createHash } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { currentTermsAcceptance, sharedCompanyClip, sharedJobFields } from "./helpers/sharedJob";

const enabled = process.env.BLUEPRINT_BILLABLE_EMULATOR_TEST === "1";
const send = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  if (process.env.BLUEPRINT_BILLABLE_EMULATOR_TEST !== "1")
    return { default: { firestore: { FieldValue: { serverTimestamp: () => null } } }, dbAdmin: null, authAdmin: null, storageAdmin: null };
  if (!/^127\.0\.0\.1:\d+$/.test(String(process.env.FIRESTORE_EMULATOR_HOST)) || process.env.GCLOUD_PROJECT !== "demo-blueprint-billable")
    throw new Error("The demo-blueprint-billable Firestore emulator is required");
  const { default: admin } = await import("firebase-admin");
  const app = admin.initializeApp({ projectId: "demo-blueprint-billable" }, "billable-unmade-introduction");
  return { default: admin, dbAdmin: admin.firestore(app), authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", async importOriginal => ({ ...await importOriginal<typeof import("../utils/email")>(), sendEmail: send }));
// The Pipeline is never called from this test.
vi.mock("../utils/pipelineCompanyRecheck", () => ({ recheckCaptureInBackground: vi.fn() }));

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const ID = `billable-unmade-${process.pid}`;
const CAPTURE = `walkthrough-${ID}`;
const COMPANY_EMAIL = "contact@north.example";
const COMPANY = createHash("sha256").update(COMPANY_EMAIL).digest("hex");
const SITE_EMAIL = "owner@site.example";
const START = Date.parse("2026-11-23T15:00:00.000Z");

afterAll(async () => { if (enabled) await db!.terminate(); });

describe.skipIf(!enabled)("an introduction whose company email has an unknown outcome, then the job is withdrawn", () => {
  it("leaves 0 billable events and 1 recorded but not made, and the event as recorded", async () => {
    // A fixture key, never a production one: the introduction seals both sides' details at rest.
    vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.useFakeTimers({ toFake: ["Date"], now: START });
    const store = db!;
    const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");
    // The fixture's site holds a name, so its page shows the sentence of 2026-11-12 (`introductionStatementVersionFor`).
    const { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION: INTRODUCTION_REQUEST_STATEMENT_VERSION } = await import("../../client/src/lib/siteIntroductions");
    await store.collection("inboundRequests").doc(ID).set({ requestId: ID,
      ...sharedJobFields(ID, { siteName: "A site", siteLocation: "Somewhere" }),
      contact: { email: SITE_EMAIL, firstName: "Sam", lastName: "Site", company: "A site" },
      company_aliases: { [COMPANY]: "A" } });
    await store.collection("siteTaskBriefs").doc(ID).set({ summary: "Stack cartons onto the pallet",
      confirmedAtIso: "2026-11-12T10:00:00.000Z" });
    const { COMPANY_CLIP_FIELD } = await import("../utils/websiteCompanyClip");
    await store.collection("captureUploadSessions").doc(CAPTURE).set({ [COMPANY_CLIP_FIELD]: sharedCompanyClip(CAPTURE) });
    await store.collection("robotTeamAccess").doc(COMPANY).set({ partnerRole: "deployment", status: "approved",
      termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: "uid-north", name: "Person North", email: COMPANY_EMAIL,
      company: "North Robotics", website: "https://north.example", newJobAlertsOptIn: false });
    await store.collection("inboundRequests").doc(ID).collection("robotTeamInterest").doc(COMPANY).set({ state: "interested",
      recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, company: "North Robotics", email: COMPANY_EMAIL,
      inputs: "We do this every day.", updatedAtIso: "2026-11-23T14:00:00.000Z" });
    await store.collection("inboundRequests").doc(ID).collection("companySends").doc(`system-${COMPANY}`).set({
      companyId: COMPANY, sentAtIso: "2026-11-13T00:00:00.000Z", sentBy: "system" });

    // Totals before: whatever other jobs the emulator holds, measured so this job's events are read as a difference.
    const { loadJobTotals } = await import("../utils/ownerTotals");
    const before = await loadJobTotals(new Date(START), store);

    // 1. The site presses Introduce us.
    const { requestIntroduction } = await import("../utils/jobIntroductions");
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
      { decrypt: async value => String(value ?? "").trim() })).toMatchObject({ ok: true });

    // 2. The delivery pass: the provider answers 503, which may have sent the email (an unknown outcome).
    send.mockResolvedValue({ sent: false, provider: "resend", messageId: null, outcome: "unknown", failure: "unknown",
      error: { statusCode: 503, name: "application_error", message: "Service unavailable" } });
    const { deliverOutbox } = await import("../utils/captureOutbox");
    await deliverOutbox({ limit: 50 });

    // 3. The site withdraws.
    const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
    await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "site", authorize: () => undefined });

    // 4. A delivery pass 61 s later; the provider answers again.
    send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
    vi.setSystemTime(START + 61_000);
    await deliverOutbox({ limit: 50 });

    const rows = (await store.collection("captureOutbox").where("requestId", "==", ID).get()).docs.map(doc => doc.data());
    const status = (kind: string) => rows.filter(row => row.kind === kind).map(row => row.status);
    expect(status("introduction_made_company")).toEqual(["unknown"]);
    expect(status("introduction_made_site")).toEqual(["held"]);
    const event = (await store.collection("billableEvents").doc(`introduction-${ID}-${COMPANY}`).get()).data();
    // The event is left as recorded: never voided, never stamped made, never rewritten.
    expect(event).toEqual({ kind: "introduction", requestId: ID, companyId: COMPANY, atIso: new Date(START).toISOString(),
      priceUsd: null, status: "recorded_no_price" });

    const after = await loadJobTotals(new Date(START + 61_000), store);
    expect({ billable: after.billableEvents! - before.billableEvents!,
      notMade: (after as Record<string, any>).billableEventsNotMade - ((before as Record<string, any>).billableEventsNotMade ?? 0) })
      .toEqual({ billable: 0, notMade: 1 });
    const { billableEventsCsv } = await import("../utils/ownerTotals");
    expect((await billableEventsCsv(store)).split("\r\n"))
      .toContain(`"introduction-${ID}-${COMPANY}","${ID}","${COMPANY}","${new Date(START).toISOString()}","","recorded_no_price"`);
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});
