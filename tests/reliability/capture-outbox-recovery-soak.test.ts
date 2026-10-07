import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "../../server/tests/helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("../../server/tests/helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "fixture-timestamp" } } },
}));
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../server/logger", () => ({ logger: log }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../../server/utils/email", () => ({ sendEmail: send }));
vi.mock("../../server/utils/pilotRecommendationNotifications", () => ({ pilotRecommendationNotificationIsCurrent: async () => true }));
vi.mock("../../server/utils/taskLifecycleNotifications", () => ({ reconcileSceneReadyNotifications: async () => undefined }));
vi.mock("../../server/utils/agentRunResultNotifications", () => ({ reconcileAgentRunResultNotifications: async () => undefined }));
vi.mock("../../server/utils/taskEvaluationNotificationRetry", () => ({ reconcileTaskEvaluationNotificationRetries: async () => undefined }));

import { deliverOutbox, enqueueOutbox } from "../../server/utils/captureOutbox";

// Frozen before running: this is retained-memory regression evidence, not a
// production capacity SLO. Each measured round repeats the same bounded matrix.
const CRITERIA = {
  warmupRounds: 1, measuredRounds: 8, casesPerRound: 64, scenarios: 8,
  heapUsed: { maxFinalGrowthBytes: 8 * 1024 ** 2, maxSlopeBytesPerRound: 1024 ** 2 },
  rss: { maxFinalGrowthBytes: 32 * 1024 ** 2, maxSlopeBytesPerRound: 4 * 1024 ** 2 },
  external: { maxFinalGrowthBytes: 4 * 1024 ** 2, maxSlopeBytesPerRound: 512 * 1024 },
  maxFdGrowth: 2, ownedTempFiles: 0, ownedTempBytes: 0,
  activeQueueRowsAtCaseEnd: 0, fakeStoreRowsBetweenCases: 0,
  maxCgroupPeakFractionOfLimit: 0.9, maxOomEventGrowth: 0,
} as const;

function textFile(path: string): string | null {
  try { return readFileSync(path, "utf8").trim(); } catch { return null; }
}
function numericFile(path: string): number | null {
  const text = textFile(path);
  return text !== null && /^\d+$/.test(text) ? Number(text) : null;
}
function counters(path: string): Record<string, number> | null {
  const text = textFile(path);
  if (text === null) return null;
  return Object.fromEntries(text.split("\n").map(line => {
    const [key, value] = line.trim().split(/\s+/); return [key, Number(value)];
  }));
}
function ownedTemp(path: string): { files: number; bytes: number } {
  let files = 0, bytes = 0;
  for (const name of readdirSync(path)) {
    const child = join(path, name), stat = statSync(child);
    if (stat.isDirectory()) { const nested = ownedTemp(child); files += nested.files; bytes += nested.bytes; }
    else { files++; bytes += stat.size; }
  }
  return { files, bytes };
}
function sample(round: number, ownedTempPath: string) {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error("recovery_soak_requires_exposed_gc");
  gc();
  const memory = process.memoryUsage();
  const memoryStat = counters("/sys/fs/cgroup/memory.stat");
  return {
    round, ...memory, fdCount: readdirSync("/proc/self/fd").length,
    ownedTemp: ownedTemp(ownedTempPath), fakeStoreRows: state.docs.size,
    cgroup: {
      path: "/sys/fs/cgroup", currentBytes: numericFile("/sys/fs/cgroup/memory.current"),
      peakBytes: numericFile("/sys/fs/cgroup/memory.peak"), limitBytes: numericFile("/sys/fs/cgroup/memory.max"),
      anonBytes: memoryStat?.anon ?? null, fileBytes: memoryStat?.file ?? null,
      events: counters("/sys/fs/cgroup/memory.events"),
    },
  };
}
type Sample = ReturnType<typeof sample>;
function slope(values: number[]) {
  const meanX = (values.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0)
    / values.reduce((sum, _value, index) => sum + (index - meanX) ** 2, 0);
}

const SCENARIOS = ["accepted_overlap", "known_rejection_then_acceptance", "unknown_return",
  "transport_throw", "pre_dispatch_write_failure", "acceptance_write_failure",
  "expired_pre_dispatch_claim", "retired_notice_cancelled"] as const;
const key = "captureOutbox/fixture:event";
const row = () => state.docs.get(key) as Record<string, any>;

async function exerciseCase(index: number) {
  const scenario = SCENARIOS[index % SCENARIOS.length];
  const originalTransaction = db.runTransaction.bind(db);
  state.docs.clear(); send.mockReset();
  Object.values(log).forEach(mock => mock.mockClear());
  await enqueueOutbox({ idempotencyKey: "fixture:event", requestId: "fixture",
    kind: scenario === "retired_notice_cancelled" ? "progress_update" : "task_received",
    to: "fixture@example.invalid", subject: "Fixture job", body: "Private fixture link: https://example.invalid/fixture" });
  const accepted = { sent: true, provider: "resend", messageId: `fixture-${index}` };
  send.mockResolvedValue(accepted);
  if (scenario === "known_rejection_then_acceptance") send.mockResolvedValueOnce({ sent: false, provider: "resend", messageId: null, outcome: "not_sent" });
  if (scenario === "unknown_return") send.mockResolvedValue({ sent: false, provider: "resend", messageId: null, outcome: "unknown" });
  if (scenario === "transport_throw") send.mockRejectedValue(new Error("fixture transport loss"));
  if (scenario === "expired_pre_dispatch_claim") Object.assign(row(), { status: "claimed", deliveryToken: "interrupted-fixture", deliveryLeaseUntilMs: 0 });
  if (scenario === "pre_dispatch_write_failure" || scenario === "acceptance_write_failure") {
    const statusToFail = scenario === "pre_dispatch_write_failure" ? "dispatching" : "sent";
    const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => originalTransaction(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (ref.path === key && data.status === statusToFail) throw new Error(`fixture ${statusToFail} write failure`);
        return tx.set(ref, data, options);
      },
    })));
    try { await expect(deliverOutbox()).rejects.toThrow("write failure"); }
    finally { spy.mockRestore(); }
    expect(row().status).toBe(scenario === "pre_dispatch_write_failure" ? "claimed" : "dispatching");
    row().deliveryLeaseUntilMs = 0;
  }
  if (scenario === "accepted_overlap") await Promise.all(Array.from({ length: 4 }, () => deliverOutbox()));
  else await deliverOutbox();
  await deliverOutbox();
  const expectedStatus = ["unknown_return", "transport_throw", "acceptance_write_failure"].includes(scenario)
    ? "unknown" : scenario === "retired_notice_cancelled" ? "cancelled" : "sent";
  const expectedCalls = scenario === "retired_notice_cancelled" ? 0 : scenario === "known_rejection_then_acceptance" ? 2 : 1;
  expect(row().status, scenario).toBe(expectedStatus);
  expect(send.mock.calls.length, scenario).toBe(expectedCalls);
  expect(row().attempts, scenario).toBe(expectedCalls);
  const activeRows = [...state.docs.entries()].filter(([path, data]) => path.startsWith("captureOutbox/")
    && !path.includes("/deliveryReceipts/") && ["pending", "claimed", "dispatching"].includes(String(data.status))).length;
  expect(activeRows).toBe(CRITERIA.activeQueueRowsAtCaseEnd);
  const retainedRowsBeforeFixtureReset = state.docs.size;
  const result = { scenario, providerCalls: send.mock.calls.length,
    retainedUnknown: expectedStatus === "unknown" ? 1 : 0, retainedRowsBeforeFixtureReset, activeRows };
  // Fixture reset models remote persistent storage, not production deletion.
  // Unknown rows were asserted retained above and are never replayed.
  state.docs.clear(); send.mockReset();
  Object.values(log).forEach(mock => mock.mockClear());
  expect(state.docs.size).toBe(CRITERIA.fakeStoreRowsBetweenCases);
  return result;
}

describe("optional bounded recovery resource soak", () => {
  it("keeps retained memory and resources bounded across repeated recovery rounds", async () => {
    const ownedTempPath = mkdtempSync(join(tmpdir(), "blueprint-outbox-soak-"));
    const previousTmpdir = process.env.TMPDIR;
    process.env.TMPDIR = ownedTempPath;
    const start = performance.now();
    const roundResults: Array<{ round: number; elapsedMs: number; cases: number; providerCalls: number; unknownRowsAsserted: number; maximumFixtureRows: number }> = [];
    const samples: Sample[] = [];
    let report: Record<string, unknown> | undefined;
    try {
      for (let round = 0; round <= CRITERIA.measuredRounds; round++) {
        const roundStart = performance.now();
        let providerCalls = 0, unknownRowsAsserted = 0, maximumFixtureRows = 0;
        for (let index = 0; index < CRITERIA.casesPerRound; index++) {
          const result = await exerciseCase(index);
          providerCalls += result.providerCalls; unknownRowsAsserted += result.retainedUnknown;
          maximumFixtureRows = Math.max(maximumFixtureRows, result.retainedRowsBeforeFixtureReset);
        }
        roundResults.push({ round, elapsedMs: performance.now() - roundStart,
          cases: CRITERIA.casesPerRound, providerCalls, unknownRowsAsserted, maximumFixtureRows });
        samples.push(sample(round, ownedTempPath));
      }
      const baseline = samples[0], final = samples[samples.length - 1];
      const trends = Object.fromEntries((["heapUsed", "rss", "external"] as const).map(metric => [metric, {
        finalGrowthBytes: final[metric] - baseline[metric], slopeBytesPerRound: slope(samples.map(value => value[metric])),
      }]));
      report = {
        schema: "blueprint.outbox_recovery_resource_soak.v1", criteria: CRITERIA, scenarios: SCENARIOS,
        warmupCases: 64, measuredCases: 512, uniqueScenarioKinds: 8, repetitionsPerScenarioPerRound: 8,
        totalCasesIncludingWarmup: 576, roundResults, samples, trends,
        elapsedIncludingWarmupMs: performance.now() - start,
        runtime: { node: process.version, platform: process.platform, arch: process.arch, exposedGc: true,
          expectedCgroupMemoryLimitBytes: process.env.BLUEPRINT_RECOVERY_SOAK_EXPECT_MEMORY_MAX_BYTES ?? null },
        limits: ["Actual outbox implementation with in-memory Firestore and fake provider sinks.",
          "Repeated same-process rounds are not 512 distinct fault scenarios or additional seeded schedules.",
          "Samples follow explicit GC; they measure retained memory, not allocation peaks or live provider memory.",
          "Cgroup counters cover the whole container when isolated, otherwise its ambient execution cgroup.",
          "TMPDIR is redirected during the workload; temp metrics cover that directory, not startup/module caches or global temporary files.",
          "Per-case fake-store reset models remote persistence and does not prove production database storage is bounded."],
      };
      const expectedLimit = process.env.BLUEPRINT_RECOVERY_SOAK_EXPECT_MEMORY_MAX_BYTES;
      if (expectedLimit) {
        expect(Number.isFinite(Number(expectedLimit)) && Number(expectedLimit) > 0).toBe(true);
        expect(final.cgroup.limitBytes).toBe(Number(expectedLimit));
        expect(baseline.cgroup.events).not.toBeNull();
        expect(final.cgroup.events).not.toBeNull();
        expect(final.cgroup.anonBytes).not.toBeNull();
        expect(final.cgroup.fileBytes).not.toBeNull();
        expect(final.cgroup.currentBytes).not.toBeNull();
        expect(final.cgroup.peakBytes).not.toBeNull();
      }
      for (const metric of ["heapUsed", "rss", "external"] as const) {
        expect(trends[metric].finalGrowthBytes, `${metric} final retained growth`).toBeLessThanOrEqual(CRITERIA[metric].maxFinalGrowthBytes);
        expect(trends[metric].slopeBytesPerRound, `${metric} retained slope`).toBeLessThanOrEqual(CRITERIA[metric].maxSlopeBytesPerRound);
      }
      for (const measured of samples) {
        expect(measured.fdCount - baseline.fdCount).toBeLessThanOrEqual(CRITERIA.maxFdGrowth);
        expect(measured.ownedTemp).toEqual({ files: CRITERIA.ownedTempFiles, bytes: CRITERIA.ownedTempBytes });
        expect(measured.fakeStoreRows).toBe(0);
        if (expectedLimit && measured.cgroup.peakBytes !== null && measured.cgroup.limitBytes !== null)
          expect(measured.cgroup.peakBytes / measured.cgroup.limitBytes).toBeLessThanOrEqual(CRITERIA.maxCgroupPeakFractionOfLimit);
      }
      for (const key of ["oom", "oom_kill"] as const) if (baseline.cgroup.events && final.cgroup.events)
        expect(final.cgroup.events[key] - baseline.cgroup.events[key]).toBe(CRITERIA.maxOomEventGrowth);
      report.passed = true;
    } finally {
      if (report) {
        report.passed ??= false;
        console.log(JSON.stringify(report));
        const path = process.env.BLUEPRINT_RECOVERY_SOAK_REPORT;
        if (path) writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
      }
      state.docs.clear(); send.mockReset(); vi.restoreAllMocks();
      if (previousTmpdir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previousTmpdir;
      rmSync(ownedTempPath, { recursive: true, force: true });
    }
  });
});
