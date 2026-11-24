// @vitest-environment node
/**
 * A site's withdrawal that cannot reach the Pipeline is never silent.
 *
 * 1. Readiness: the worker process, which sends the withdrawal notice, reports in its heartbeat whether it has the
 *    Pipeline's address and the signing token; the web process's `/health/ready` and the ops monitor's readiness pass
 *    name it as a blocker from that report, never from the web process's own settings.
 * 2. The alert: a withdrawal the Pipeline has not acknowledged 15 minutes after the site's request is told to the owner
 *    once, naming the cause and how many wait, with nothing that names the site.
 *
 * OFFLINE: the real worker, heartbeat, readiness route and scan against the fake Firestore; the Pipeline is a fake fetch.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  attachRequestMeta: (value: unknown) => value }));
vi.mock("../utils/taskEvaluationLaunchStore", () => ({
  probeTaskEvaluationLaunchStore: async () => ({ ready: true, code: "ok", checked_at_iso: new Date().toISOString() }),
}));

const ADDRESS_SETTINGS = ["CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "CAPTURE_UPLOAD_INTAKE_FORWARD_URL"] as const;

/** Planted in each job record: none of it may reach the owner's alert. */
const SITE = { name: "Harbor Pallet Works", address: "41 Dock Road", email: "ops@harbor-pallet.example", phone: "+1 555 0100" };

function withdrawnJob(id: string, requestedAtIso: string, patch: Record<string, unknown> = {}) {
  return {
    site_name: SITE.name, site_address: SITE.address, contact: { email: SITE.email, phone: SITE.phone },
    consent_revoked: true, future_processing_allowed: false, workspace_task: { paused: true },
    captureWithdrawalPending: true, captureDeletionPending: true,
    capture_withdrawal: { state: "uploads_stopped_cleanup_pending", requestedAtIso, requestedBy: "owner_link", requestId: id,
      sceneId: `site-${id}`, captureId: `walkthrough-${id}`, deletionConfirmed: false, pipelineAcknowledged: false,
      localCleanupVerified: false, providerAcknowledgement: "unknown", retainedAuditRecords: true,
      webappDeletion: { phase: "pending", attempts: 0, nextAttemptAtMs: 0, leaseUntilMs: 0 } },
    ...patch,
  };
}

beforeEach(() => {
  state.docs.clear();
  vi.unstubAllEnvs();
  for (const name of [...ADDRESS_SETTINGS, "CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN"]) vi.stubEnv(name, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/* ----------------------------------------------------------------- 1. readiness names it */

async function readyFromWebProcess() {
  const { default: healthRouter } = await import("../routes/health");
  const app = express();
  app.use(healthRouter);
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/health/ready`);
    return { status: response.status, body: await response.json() as Record<string, any> };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

const NAMED = /withdrawalNotice: .*CAPTURE_LIFECYCLE_PIPELINE_BASE_URL/;

describe("readiness names a withdrawal notice the worker cannot send", () => {
  it("is a blocker when the worker reports no Pipeline address, whatever the web process holds", async () => {
    const { writeWorkerHeartbeat } = await import("../utils/workerHeartbeat");
    // The worker beats with no address and no token.
    await writeWorkerHeartbeat({ env: { CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN: "" } });
    // The web process itself holds both: readiness must not read its own settings as the worker's.
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid/api/live-pipeline");
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "web-token");
    const { status, body } = await readyFromWebProcess();
    expect(status).toBe(503);
    expect(body.checks.withdrawalNotice).toBe(false);
    const named = (body.blockers as string[]).filter(blocker => blocker.startsWith("withdrawalNotice:"));
    expect(named).toHaveLength(1);
    expect(named[0]).toMatch(NAMED);
    expect(named[0]).toMatch(/CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN/);
    expect(named[0]).toMatch(/blueprint-webapp-worker/);
  });

  it("names only the token when the worker has the address but no token", async () => {
    const { writeWorkerHeartbeat } = await import("../utils/workerHeartbeat");
    await writeWorkerHeartbeat({ env: { CAPTURE_UPLOAD_INTAKE_FORWARD_URL: "https://pipeline.invalid/api/live-pipeline/capture-upload-intakes" } });
    const named = ((await readyFromWebProcess()).body.blockers as string[]).filter(blocker => blocker.startsWith("withdrawalNotice:"));
    expect(named).toHaveLength(1);
    expect(named[0]).toMatch(/CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN/);
    expect(named[0]).not.toMatch(/CAPTURE_LIFECYCLE_PIPELINE_BASE_URL/);
  });

  it("is no blocker once the worker reports both, nor while no worker has reported it", async () => {
    const { buildLaunchReadinessWithWorkerFacts } = await import("../utils/launch-readiness");
    const { writeWorkerHeartbeat } = await import("../utils/workerHeartbeat");
    // No worker report yet (or a worker from before this report): nothing is guessed.
    let readiness = await buildLaunchReadinessWithWorkerFacts();
    expect(readiness.blockers.some(blocker => blocker.startsWith("withdrawalNotice:"))).toBe(false);
    expect(readiness.checks.withdrawalNotice).toBe(true);
    await writeWorkerHeartbeat({ env: { CAPTURE_LIFECYCLE_PIPELINE_BASE_URL: "https://pipeline.invalid/api/live-pipeline",
      CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN: "worker-token" } });
    expect(state.docs.get("opsHeartbeats/blueprint-webapp-worker")).toMatchObject({
      withdrawal_notice: { pipeline_address_configured: true, signing_token_configured: true } });
    readiness = await buildLaunchReadinessWithWorkerFacts();
    expect(readiness.blockers.some(blocker => blocker.startsWith("withdrawalNotice:"))).toBe(false);
    expect(readiness.dependencies.launchChecks.withdrawalNotice).toMatchObject({ required: true, ready: true });
    // The report never carries a value: only whether each setting is there.
    expect(JSON.stringify(state.docs.get("opsHeartbeats/blueprint-webapp-worker"))).not.toMatch(/pipeline\.invalid|worker-token/);
  });

  it("is named on the ops monitor's own readiness pass too", async () => {
    const { writeWorkerHeartbeat } = await import("../utils/workerHeartbeat");
    await writeWorkerHeartbeat({ env: {} });
    const slack: string[] = [];
    vi.doMock("../utils/ops-alerts", async importOriginal => ({
      ...await importOriginal<typeof import("../utils/ops-alerts")>(),
      maybeAlertOnLaunchReadinessTransition: async (snapshot: { blockers: string[] }) => { slack.push(...snapshot.blockers); },
    }));
    const { runBetaOpsMonitorPass } = await import("../utils/betaOpsMonitor");
    await runBetaOpsMonitorPass();
    expect(slack.some(blocker => NAMED.test(blocker))).toBe(true);
  });
});

/* ----------------------------------------------------------------- 2. the alert, once per withdrawal */

const MINUTE = 60_000;
const REQUESTED = Date.parse("2026-11-24T02:01:30.000Z");

describe("the owner is told once when a withdrawal has not reached the Pipeline", () => {
  async function forwardOnce(nowMs: number) {
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    const { forwardWebsiteCaptureWithdrawals } = await import("../utils/websiteCaptureWithdrawal");
    await forwardWebsiteCaptureWithdrawals();
    vi.mocked(Date.now).mockRestore();
  }

  it("names 'not configured' and the count, once, with nothing that names the site", async () => {
    state.docs.set("inboundRequests/job-a", withdrawnJob("job-a", new Date(REQUESTED).toISOString()));
    // The real worker tries three times with no address, as it did on the job that showed the gap.
    for (const minute of [0, 1, 2]) await forwardOnce(REQUESTED + minute * MINUTE + 5_000);
    const record = state.docs.get("inboundRequests/job-a") as Record<string, any>;
    expect(record.captureWithdrawalOutbox).toMatchObject({ attemptCount: 3, lastTransportStatus: "not_configured" });
    expect(record.capture_withdrawal).toMatchObject({ pipelineAcknowledged: false,
      acknowledgementBlocker: "capture_lifecycle_pipeline_base_url_missing" });

    const { scanUnacknowledgedWithdrawals, WITHDRAWAL_NOTICE_ALERT_AFTER_MS } = await import("../utils/withdrawalNoticeAlerts");
    expect(WITHDRAWAL_NOTICE_ALERT_AFTER_MS).toBe(15 * MINUTE);
    const alert = vi.fn(async (_key: string, _message: string) => undefined);
    const email = vi.fn(async (_message: { to: string; subject: string; text: string }) => ({ sent: true }) as never);
    // Within the bound: nothing yet.
    expect(await scanUnacknowledgedWithdrawals({ now: () => REQUESTED + 14 * MINUTE, alert, email }))
      .toMatchObject({ waiting: 0, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    // Past it: one Slack alert and one ops email.
    expect(await scanUnacknowledgedWithdrawals({ now: () => REQUESTED + 35 * MINUTE, alert, email }))
      .toMatchObject({ waiting: 1, newlyAlerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
    const message = alert.mock.calls[0][1];
    expect(message).toMatch(/1 site withdrawal/);
    expect(message).toMatch(/not configured/);
    expect(message).toMatch(/CAPTURE_LIFECYCLE_PIPELINE_BASE_URL/);
    expect(message).toMatch(/3 tries/);
    const told = `${message}\n${email.mock.calls[0][0].subject}\n${email.mock.calls[0][0].text}`;
    for (const planted of Object.values(SITE)) expect(told).not.toContain(planted);
    // Once per withdrawal: later passes, and a new process, say nothing more about it.
    await scanUnacknowledgedWithdrawals({ now: () => REQUESTED + 60 * MINUTE, alert, email });
    vi.resetModules();
    const fresh = await import("../utils/withdrawalNoticeAlerts");
    expect(await fresh.scanUnacknowledgedWithdrawals({ now: () => REQUESTED + 90 * MINUTE, alert, email }))
      .toMatchObject({ waiting: 1, newlyAlerted: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
  });

  it("names 'refused' for an HTTP refusal and 'failed' for no answer, counting every one that waits", async () => {
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid/api/live-pipeline");
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "worker-token");
    state.docs.set("inboundRequests/job-r", withdrawnJob("job-r", new Date(REQUESTED).toISOString()));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 })));
    await forwardOnce(REQUESTED + 5_000);
    state.docs.set("inboundRequests/job-f", withdrawnJob("job-f", new Date(REQUESTED).toISOString()));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await forwardOnce(REQUESTED + 30_000); // job-r waits its minute, so only job-f is tried here.
    expect((state.docs.get("inboundRequests/job-r") as Record<string, any>).captureWithdrawalOutbox)
      .toMatchObject({ lastTransportStatus: "failed", lastHttpStatus: 403 });
    expect((state.docs.get("inboundRequests/job-f") as Record<string, any>).captureWithdrawalOutbox)
      .toMatchObject({ lastTransportStatus: "failed", lastHttpStatus: null });
    // An acknowledged withdrawal and a recent one are not waiting past the bound.
    state.docs.set("inboundRequests/job-ok", withdrawnJob("job-ok", new Date(REQUESTED).toISOString(),
      { capture_withdrawal: { ...withdrawnJob("job-ok", new Date(REQUESTED).toISOString()).capture_withdrawal, pipelineAcknowledged: true } }));
    state.docs.set("inboundRequests/job-new", withdrawnJob("job-new", new Date(REQUESTED + 30 * MINUTE).toISOString()));

    const { scanUnacknowledgedWithdrawals } = await import("../utils/withdrawalNoticeAlerts");
    const alert = vi.fn(async (_key: string, _message: string) => undefined);
    const email = vi.fn(async () => ({ sent: true }) as never);
    expect(await scanUnacknowledgedWithdrawals({ now: () => REQUESTED + 35 * MINUTE, alert, email }))
      .toMatchObject({ waiting: 2, newlyAlerted: 2 });
    const message = alert.mock.calls[0][1];
    expect(message).toMatch(/2 site withdrawals/);
    expect(message).toMatch(/refused \(HTTP 403\)/);
    expect(message).toMatch(/failed \(no answer\)/);
    expect(message).not.toMatch(/job-ok|job-new/);
  });
});
