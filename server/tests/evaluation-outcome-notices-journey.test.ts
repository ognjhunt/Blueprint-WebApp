// @vitest-environment node
/**
 * Audit A (2026-10-18): what a site hears once every evaluation of its job has
 * finished without a pass.
 *
 * A diagnostic, unqualified or unscored run is "ineligible" evidence, and must
 * never be called a failure, so `no_team_passed` still requires none. That left
 * a site whose runs were all ineligible with silence. It now hears one truthful
 * notice: none can support a recommendation yet, and we email when a qualified
 * evaluation finishes. A qualified evaluation that did not pass now says what
 * would change that: how far the closest one fell short of the job's pass mark.
 *
 * The job is not hand-built: it starts from the real `POST /api/inbound-request`
 * with the exact body the public start form sends
 * (`helpers/siteCaptureStartSubmission.ts`). The runs are written as admission
 * and the Pipeline's report write them (the shared synthetic qualified run in
 * `helpers/recommendation-evidence.ts`, made diagnostic or short of the pass
 * mark). The site's notices come from the real `notifyIfNoTeamPassed`, which
 * every run conclusion calls, and are read from the durable outbox; its page
 * reads the real `GET /api/site-task-brief/:token/status`.
 *
 * Substituted: Firebase persistence and Cloud Storage, outbound email delivery,
 * Slack, analytics and model calls.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import { syntheticEpisodeOutcomes, syntheticQualifiedRun } from "./helpers/recommendation-evidence";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket: bucket } = await import("./helpers/fake-upload-bucket");
  return {
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => bucket.bucket },
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
const outbox = (key: string): { kind: string; subject: string; body: string } | undefined => doc(`captureOutbox/${key}`);
const queuedKinds = (jobId: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && (value as { requestId?: string }).requestId === jobId)
  .map(([, value]) => (value as { kind: string }).kind).sort();

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
  const { default: brief } = await import("../routes/site-task-brief");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/site-task-brief", brief);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => { state.docs.clear(); sharedUploadBucket.clear(); });

/** A site starts a job on the public form, exactly as the browser sends it. */
async function startJob() {
  const jobId = `outcome-job-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId, token: captureUrl.split("/capture-upload/")[1] };
}

/** A team evaluation as admission and the Pipeline's report write it: qualified, diagnostic, or short of the pass mark. */
function recordRun(jobId: string, runId: string, kind: "diagnostic" | "short" | "pass") {
  const run = syntheticQualifiedRun(jobId, runId) as Record<string, any>;
  if (kind === "diagnostic") run.result = { ...run.result, evidenceScope: "development_only" };
  if (kind === "short") run.result = { ...run.result, episodeOutcomes: syntheticEpisodeOutcomes(200, 172),
    observed: { ...run.result.observed, episodesSucceeded: 172, successRate: 0.86 } };
  state.docs.set(`evaluationRuns/${runId}`, run);
}

async function concluded(jobId: string, runId: string) {
  const { notifyIfNoTeamPassed } = await import("../utils/taskLifecycleNotifications");
  return notifyIfNoTeamPassed(jobId, runId);
}

async function jobStatus(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json() as { status: { decision: string; headline: string } }).status;
}

describe("when every evaluation of a job has finished without a pass", () => {
  it("tells the site, once, that none can support a recommendation yet, and never calls it a failure", async () => {
    const { jobId, token } = await startJob();
    recordRun(jobId, "run-diagnostic-1", "diagnostic");
    await concluded(jobId, "run-diagnostic-1");
    const notice = outbox(`${jobId}:no_qualified_evaluation`);
    expect(notice?.kind).toBe("no_qualified_evaluation");
    expect(notice?.body).toMatch(/none can support a recommendation yet/);
    expect(notice?.body).toMatch(/We email you when a scored evaluation finishes/);
    expect(`${notice?.subject}\n${notice?.body}`).not.toMatch(/passed|failed|without passing/i);
    // Never the no-pass notice for ineligible evidence.
    expect(queuedKinds(jobId)).not.toContain("no_team_passed");

    // A second diagnostic run is the same state, not a second email.
    recordRun(jobId, "run-diagnostic-2", "diagnostic");
    await concluded(jobId, "run-diagnostic-2");
    expect(queuedKinds(jobId).filter(kind => kind === "no_qualified_evaluation")).toHaveLength(1);

    const status = await jobStatus(token);
    expect(status.decision).toBe("no_qualified_evaluation");
    expect(status.headline).toMatch(/2 runs could not be scored against your pass mark/);
  });

  it("tells the site what would change a qualified evaluation that did not pass", async () => {
    const { jobId, token } = await startJob();
    recordRun(jobId, "run-short", "short");
    await concluded(jobId, "run-short");
    const notice = outbox(`${jobId}:no_team_passed:run-short`);
    expect(notice?.kind).toBe("no_team_passed");
    expect(notice?.body).toMatch(/The closest scored evaluation succeeded in 172 of 200 episodes \(86%\); your pass mark is 90%\./);
    expect(notice?.body).toMatch(/To pass in this simulation, a candidate needs to reach 90%/);
    expect(queuedKinds(jobId)).not.toContain("no_qualified_evaluation");

    const status = await jobStatus(token);
    expect(status.decision).toBe("no_team_passed");
    expect(status.headline).toMatch(/172 of 200 episodes \(86%\); your pass mark is 90%/);
  });

  it("sends neither while a qualified evaluation passed", async () => {
    const { jobId } = await startJob();
    recordRun(jobId, "run-pass", "pass");
    recordRun(jobId, "run-diagnostic", "diagnostic");
    await concluded(jobId, "run-diagnostic");
    expect(queuedKinds(jobId)).not.toContain("no_qualified_evaluation");
    expect(queuedKinds(jobId)).not.toContain("no_team_passed");
  });
});
