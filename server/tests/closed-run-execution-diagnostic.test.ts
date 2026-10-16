// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    authAdmin: { verifyIdToken: async () => ({ uid: "test-owner" }) },
  };
});
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import router from "../routes/internal-agent-run-settlement";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";

const runKey = "evaluationRuns/run_free_diagnostic";
const secret = "offline-closed-diagnostic-signer";
const digest = `sha256:${"a".repeat(64)}`;
const progress = { observed_attempted_episode_count: 5, scored_episode_count: 4,
  succeeded_episode_count: 3, failed_episode_count: 1, void_episode_count: 1, measurement_complete: false };
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", secret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set(runKey, {
    runId: "run_free_diagnostic", reservationId: "free_diagnostic", teamId: "team-owner",
    checkpointId: "checkpoint-owner", sceneId: "withdrawn-site", evaluationPurpose: "pilot",
    quotedUsd: 0, quotedEpisodes: 200, episodesRun: null, state: "abandoned",
    cancellationRequested: true, moneyResolved: true, dispatchPending: false,
    requestedAtIso: "2026-10-01T00:00:00.000Z", resolvedAtIso: "2026-10-01T01:00:00.000Z",
    note: "Recording consent withdrawn",
    dispatch: { pipelineRunId: "pipeline-owner", startedAtIso: "2026-10-01T00:01:00.000Z" },
    executionAdmission: { digestSha256: digest, envelope: { funding: {
      payer: "blueprint", customer_price_usd: 0, max_attempts: 1, cap_usd: 20,
      approved_by: "test-ops", approval_digest: digest, expires_at_iso: "2026-10-01T01:00:00.000Z",
    } } },
  });
  const app = express();
  app.use(express.json());
  app.use(router);
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

async function report(overrides: Record<string, unknown> = {}, authentication: "signed" | "missing" | "forged" = "signed") {
  const body = JSON.stringify({ team_id: "team-owner", reservation_id: "free_diagnostic", run_id: "pipeline-owner",
    pipeline_run_id: "pipeline-owner", execution_admission_digest: digest, episodes_run: 4, rate_usd: 0,
    execution_status: "blocked", execution_progress: progress, blocked_before_any_episode: false,
    reason: "Stopped after consent withdrawal", ...overrides });
  const timestamp = new Date().toISOString();
  return fetch(`${baseUrl}/agent-run-settlements`, {
    method: "POST", headers: { "content-type": "application/json", ...(authentication === "missing" ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({
        secret: authentication === "forged" ? "not-the-worker-secret" : secret, timestamp, body,
      }),
    }) }, body,
  });
}

describe("closed execution progress remains diagnostic", () => {
  it.each(["withdrawn", "expired", "already_completed"])("acknowledges %s progress without changing authority or money", async phase => {
    const stored = sharedFakeFirestoreState.docs.get(runKey)!;
    if (phase === "expired") Object.assign(stored, { moneyResolved: false, settlementDueAtMs: 0 });
    if (phase === "already_completed") Object.assign(stored, { state: "completed", cancellationRequested: false, episodesRun: 200 });
    const before = structuredClone(stored);
    const response = await report();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, diagnostic_only: true, settled: false, reconciled: false, amountUsd: 0 });
    const { closedExecutionDiagnostic, ...after } = sharedFakeFirestoreState.docs.get(runKey)!;
    expect(after).toEqual(before);
    expect(closedExecutionDiagnostic).toMatchObject({ teamId: "team-owner", pipelineRunId: "pipeline-owner",
      executionAdmissionDigest: digest, episodesRun: 4, executionProgress: progress });
    // No ledger, notification intent, capability promotion, or extra record is created.
    expect([...sharedFakeFirestoreState.docs.keys()]).toEqual([runKey]);
  });

  it("acknowledges an identical retry and refuses a changed receipt", async () => {
    expect((await report()).status).toBe(200);
    const accepted = structuredClone(sharedFakeFirestoreState.docs.get(runKey));
    expect((await report()).status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get(runKey)).toEqual(accepted);
    const conflict = await report({ episodes_run: 5, execution_progress: { ...progress,
      observed_attempted_episode_count: 6, scored_episode_count: 5, succeeded_episode_count: 4 } });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe("agent_run_outcome_conflict");
    expect(sharedFakeFirestoreState.docs.get(runKey)).toEqual(accepted);
  });

  it.each(["missing", "forged"] as const)("requires worker authentication: %s", async authentication => {
    const before = structuredClone(sharedFakeFirestoreState.docs.get(runKey));
    expect((await report({}, authentication)).status).toBe(401);
    expect(sharedFakeFirestoreState.docs.get(runKey)).toEqual(before);
  });

  it.each([
    { team_id: "another-team" },
    { pipeline_run_id: "another-worker" },
    { execution_admission_digest: `sha256:${"b".repeat(64)}` },
    { pipeline_run_id: undefined },
    { execution_admission_digest: undefined },
  ])("refuses a signed receipt with a forged claim binding: %j", async overrides => {
    const before = structuredClone(sharedFakeFirestoreState.docs.get(runKey));
    expect((await report(overrides)).status).toBe(409);
    expect(sharedFakeFirestoreState.docs.get(runKey)).toEqual(before);
  });

  it("rechecks the dispatch owner inside the diagnostic transaction", async () => {
    const original = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
    let changeOwner = true;
    sharedFakeFirestore.runTransaction = (async update => original(async transaction => {
      if (changeOwner) {
        changeOwner = false;
        const run = sharedFakeFirestoreState.docs.get(runKey)!;
        sharedFakeFirestoreState.docs.set(runKey, { ...run, dispatch: { ...(run.dispatch as object), pipelineRunId: "changed-owner" } });
      }
      return update(transaction);
    })) as typeof sharedFakeFirestore.runTransaction;
    try {
      expect((await report()).status).toBe(409);
      expect(sharedFakeFirestoreState.docs.get(runKey)).not.toHaveProperty("closedExecutionDiagnostic");
      expect(sharedFakeFirestoreState.docs.get(runKey)).toMatchObject({ state: "abandoned", moneyResolved: true, cancellationRequested: true });
    } finally {
      sharedFakeFirestore.runTransaction = original as typeof sharedFakeFirestore.runTransaction;
    }
  });

  it("does not grant diagnostic authority to an unbound legacy record", async () => {
    delete sharedFakeFirestoreState.docs.get(runKey)!.executionAdmission;
    expect((await report()).status).toBe(409);
    expect(sharedFakeFirestoreState.docs.get(runKey)).not.toHaveProperty("closedExecutionDiagnostic");
  });
});
