// @vitest-environment node
/**
 * Audit N14: the site's job page in its workspace said "Book it on your task
 * page" before Blueprint had recommended anything. The workspace task now says
 * whether a bookable pilot exists (`pilotRecommended`), and it is true exactly
 * when the owner booking route (`POST /api/task-listings/owner/:token/book`)
 * would accept a new booking.
 *
 * Nothing here is a hand-built job record. The job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`); the site saves it through
 * the real `POST /api/workspace/claim` and reads it through the real
 * `GET /api/workspace`. The recommendation is written as the recommendation
 * route writes it, with evidence from the real `verifyRecommendationEvidence`
 * on the shared synthetic qualified run (`pilot-recommendation-route.test.ts`
 * records one end to end).
 *
 * Substituted: Firebase persistence, ID-token verification, outbound email
 * delivery, Slack, analytics and model calls.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import { syntheticQualifiedRun } from "./helpers/recommendation-evidence";
import { completeSupplyAgreement } from "./helpers/supply-agreement";
import type { WorkspaceSnapshot } from "../../client/src/types/workspace";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore, storageAdmin: null,
    authAdmin: { verifyIdToken: async () => { throw new Error("No ID tokens in this journey"); } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../utils/captureOutbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/captureOutbox")>()),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in this journey"); }) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()),
  notifySlackInboundRequest: vi.fn(async () => undefined),
  sendSlackMessage: vi.fn(async () => ({ sent: false })),
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/intakeOpsNotice")>()),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));

const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const doc = (path: string): any => state.docs.get(path);

beforeAll(async () => {
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in this journey");
    return originalFetch(input, init);
  });
  // One at a time: these route modules import one another.
  const { default: intake } = await import("../routes/inbound-request");
  const { default: workspace } = await import("../routes/workspace");
  const { default: listings } = await import("../routes/task-listings");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/task-listings", listings);
  // Substitutes Firebase's verified token, never the workspace's own checks.
  app.use("/api/workspace", (req, res, nextHandler) => {
    res.locals.firebaseUser = { uid: String(req.headers["x-fixture-user"] || ""),
      email: String(req.headers["x-fixture-email"] || ""), email_verified: true };
    nextHandler();
  }, workspace);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => { state.docs.clear(); });

/** A site starts a job on the public form, exactly as the browser sends it, and saves it to its account. */
async function startAndClaim() {
  const jobId = `booking-job-${++sequence}`;
  const email = `${jobId}@example.test`;
  const started = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email })) });
  expect(started.status, await started.clone().text()).toBe(201);
  const { captureUrl } = await started.json() as { captureUrl: string };
  const { createSiteClaimToken } = await import("../utils/request-review-auth");
  const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
  const uid = `site-owner-${jobId}`;
  state.docs.set(`users/${uid}`, { buyerType: "site_operator", email, acceptedTerms: true,
    termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  const workspace = (path: string, body?: unknown) => fetch(`${base}/api/workspace${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-fixture-user": uid, "x-fixture-email": email },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const claimed = await workspace("/claim", { token: createSiteClaimToken(jobId) });
  expect(claimed.status, await claimed.clone().text()).toBe(200);
  return { jobId, token: captureUrl.split("/capture-upload/")[1], workspace };
}

async function workspaceTask(read: (path: string) => Promise<Response>, jobId: string) {
  const response = await read("");
  expect(response.status, await response.clone().text()).toBe(200);
  const snapshot = await response.json() as WorkspaceSnapshot;
  const task = snapshot.tasks.find(item => item.id === jobId);
  expect(task).toBeDefined();
  return task!;
}

function book(token: string, recommendationId: string) {
  return fetch(`${base}/api/task-listings/owner/${token}/book`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, authorized: true }) });
}

/** As the recommendation route writes it: the real verifier's evidence on a qualified run. */
async function recommend(jobId: string, overrides: Record<string, unknown> = {}) {
  const { passMarkForJob, verifyRecommendationEvidence } = await import("../utils/pilotRecommendationEvidence");
  const run = syntheticQualifiedRun(jobId, `run-${jobId}`);
  const verified = verifyRecommendationEvidence({ run, requestId: jobId, passMark: passMarkForJob({}, null) });
  if (!verified.ok) throw new Error(`Synthetic qualified run did not qualify: ${verified.refusal}`);
  state.docs.set(`evaluationRuns/${run.runId}`, run as never);
  state.docs.set(`robotTeams/${run.teamId}`, { id: run.teamId, name: "Fixture team", status: "engaged",
    supplyAgreement: completeSupplyAgreement() });
  state.docs.set(`inboundRequests/${jobId}`, { ...doc(`inboundRequests/${jobId}`), pilot_recommendation: {
    id: `rec-${jobId}`, teamName: "Fixture team", teamId: run.teamId, evaluationRunId: run.runId,
    evidence: verified.evidence, ...overrides } });
  return `rec-${jobId}`;
}

describe("the workspace offers a booking only when there is one to make", () => {
  it("says no pilot is bookable before Blueprint recommends one, as the booking route does", async () => {
    const { jobId, token, workspace } = await startAndClaim();
    expect((await workspaceTask(workspace, jobId)).pilotRecommended).toBe(false);
    expect((await book(token, "rec-none")).status).toBe(404);
  });

  it("offers the booking once a qualified pilot is recommended, and the booking route accepts it", async () => {
    const { jobId, token, workspace } = await startAndClaim();
    const recommendation = await recommend(jobId);
    expect((await workspaceTask(workspace, jobId)).pilotRecommended).toBe(true);
    expect((await book(token, recommendation)).status).toBe(200);
  });

  it.each([
    ["awaiting review after a brief change", { reviewRequired: true }],
    ["without evaluation evidence", { evidence: undefined }],
  ])("offers no booking for a recommendation %s, which the booking route refuses", async (_label, overrides) => {
    const { jobId, token, workspace } = await startAndClaim();
    const recommendation = await recommend(jobId, overrides);
    expect((await workspaceTask(workspace, jobId)).pilotRecommended).toBe(false);
    expect((await book(token, recommendation)).status).not.toBe(200);
  });
});
