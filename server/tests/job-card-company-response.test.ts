// @vitest-environment node
/**
 * "Respond about this job" on a job card reaches a person at Blueprint: when an
 * approved company first responds on a job whose site asked Blueprint to find a
 * deployment company, the owner is rung once, with the job, the company's
 * stored name and the answer's headline. Neither the site nor the company is
 * contacted. OFFLINE: the real route against the fake Firestore; Slack, email
 * and the signed-in account are fakes.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { JOB_CARD_ANSWER_STATEMENT, JOB_CARD_ANSWER_STATEMENT_VERSION } from "../../client/src/lib/jobCardAnswerConsent";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const seams = vi.hoisted(() => ({
  user: { uid: "user-1", email: "lee@robots.example", email_verified: true } as Record<string, unknown>,
  company: "Northwind Automation" as string,
  sendSlackMessage: vi.fn(async (_text: string) => ({ sent: true })),
  sendEmail: vi.fn(async () => { throw new Error("No email is sent from tests"); }),
}));
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (_req: unknown, res: { locals: Record<string, unknown> }, next: () => void) => {
  res.locals.firebaseUser = seams.user; next();
} }));
vi.mock("../utils/robotTeamEarlyAccess", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/robotTeamEarlyAccess")>(),
  getAccessRecordForEmail: vi.fn(async () => ({ status: "approved", company: seams.company })),
}));
vi.mock("../utils/slack", async importOriginal => ({ ...await importOriginal<typeof import("../utils/slack")>(),
  sendSlackMessage: seams.sendSlackMessage }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));

const router = (await import("../routes/site-worlds")).default;
const { loadSiteAnswer } = await import("../utils/siteAnswer");

let server: Server;
let baseUrl: string;
const ID = "req-respond";

function job(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID,
    contact: { email: "owner@example.com" },
    request: { buyerType: "site_operator", capture_mode: "self_capture" },
    capture_coverage: { covers_scene: true },
    walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`, job_estimates: {
      object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11, object_surface: "matte",
      pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: [], cycle_seconds: null, basis: "A person stacks cartons from the conveyor onto a pallet." } },
    public_task_listing: { enabled: true, consentVersion: JOB_CARD_ANSWER_STATEMENT_VERSION, approvedAtIso: "2026-11-11T10:00:00.000Z",
      approvedBy: "signed_owner_link", details: anonymizedOpportunityDraft("Stack cartons onto the pallet") },
    introduction_request: { requested_at_iso: "2026-11-11T10:00:00.000Z", requested_by: "signed_owner_link",
      statement_version: JOB_CARD_ANSWER_STATEMENT_VERSION, statement_text: JOB_CARD_ANSWER_STATEMENT },
    ...extra,
  };
}
const put = (record: Record<string, unknown>) => sharedFakeFirestoreState.docs.set(`inboundRequests/${ID}`, record);
async function respond(body: Record<string, unknown> = { state: "interested", inputs: "We palletize cartons with a UR20." }) {
  const response = await fetch(`${baseUrl}/api/site-worlds/tasks/${ID}/interest`, { method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: "csrf_token=respond-test", "x-csrf-token": "respond-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
const bells = () => seams.sendSlackMessage.mock.calls.map(([text]) => String(text));

beforeEach(async () => {
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.slack.invalid/test");
  seams.sendSlackMessage.mockClear();
  seams.sendEmail.mockClear();
  seams.user = { uid: "user-1", email: "lee@robots.example", email_verified: true };
  seams.company = "Northwind Automation";
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack cartons from the conveyor onto the pallet",
    confirmedAtIso: null });
  const app = express();
  app.use(express.json());
  app.use("/api/site-worlds", router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("POST /api/site-worlds/tasks/:taskId/interest", () => {
  it("rings Blueprint once when a company first responds on a job whose site asked to find one", async () => {
    put(job());
    const first = await respond();
    expect(first.status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get(`inboundRequests/${ID}/robotTeamInterest/${[...sharedFakeFirestoreState.docs.keys()]
      .find(key => key.startsWith(`inboundRequests/${ID}/robotTeamInterest/`))!.split("/").pop()}`)).toMatchObject({ company: "Northwind Automation" });
    expect(bells()).toHaveLength(1);
    const headline = (await loadSiteAnswer(ID))!.headline;
    expect(headline).toMatch(/^Most likely to fit: /);
    expect(bells()[0]).toContain(`\`${ID}\``);
    expect(bells()[0]).toContain("Company: Northwind Automation (is interested)");
    expect(bells()[0]).toContain(`Answer: ${headline}`);
    expect(bells()[0]).not.toMatch(/owner@example\.com|lee@robots\.example|conveyor/);
    // A person makes the introduction: no email to the site or the company.
    expect(seams.sendEmail).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.startsWith("captureOutbox/"))).toBe(false);
  });

  it("does not ring again when the same company responds again, even with other inputs or from a colleague", async () => {
    put(job());
    await respond();
    await respond({ state: "declined", inputs: "On reflection the reach is too short." });
    seams.user = { uid: "user-2", email: "kim@robots.example", email_verified: true };
    await respond();
    expect(bells()).toHaveLength(1);
    // Another company is its own first response.
    seams.user = { uid: "user-3", email: "ana@other.example", email_verified: true };
    seams.company = "Contoso Robotics";
    expect((await respond()).status).toBe(200);
    expect(bells()).toHaveLength(2);
    expect(bells()[1]).toContain("Company: Contoso Robotics");
  });

  it("does not ring for a job whose site did not ask to find a deployment company", async () => {
    put(job({ introduction_request: undefined }));
    expect((await respond()).status).toBe(200);
    expect(bells()).toHaveLength(0);
  });
});
