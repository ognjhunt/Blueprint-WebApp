# AI-Native Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 8 remaining gaps between Blueprint's current state and full AI-native autonomous operation.

**Architecture:** 5 parallel workstreams touching server config, scheduler registration, client experiment wiring, new server utilities (graduation, onboarding, renewal, SLA, Notion sync, OpenAI creative), and route extensions. All new utilities follow existing patterns: Firestore persistence, env-flag gating, action executor integration, provider status tracking.

**Tech Stack:** TypeScript, Express, Firestore, Vitest, React, Stripe, OpenAI Images API, Notion SDK, ElevenLabs, Zod

**Pre-existing infrastructure (no work needed):**
- Gap 2 (schedulers): `opsAutomationScheduler.ts` already registers workers for creative_asset_factory, autonomous_research_outbound, experiment_rollout, buyer_lifecycle. Enabling via Gap 1 activates them.
- Gap 5 (OpenAI Responses adapter): Fully implemented with tool calling loop, 7 operator tools, JSON extraction, and human review inference.

---

## Workstream A: Activation & Scheduling

### Task 1: Enable Automation Lanes (Gap 1)

**Files:**
- Modify: `server/config/env.ts`
- Modify: `.env.example`
- Create: `server/tests/automation-lane-enablement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/automation-lane-enablement.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("isAutomationLaneEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true when master switch is on and lane has no override", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "true";
    delete process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED;
    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(true);
  });

  it("returns false when master switch is off and lane has no override", async () => {
    delete process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED;
    delete process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED;
    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(false);
  });

  it("returns false when master switch is on but lane is explicitly disabled", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "true";
    process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED = "false";
    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(false);
  });

  it("returns true when master switch is off but lane is explicitly enabled", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "false";
    process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED = "true";
    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/automation-lane-enablement.test.ts`
Expected: FAIL — `isAutomationLaneEnabled` is not exported from `../config/env`

- [ ] **Step 3: Implement isAutomationLaneEnabled in env.ts**

Add to `server/config/env.ts` after the existing `isEnvFlagEnabled` function:

```typescript
/**
 * Checks if an automation lane is enabled, considering the master switch.
 * Individual lane flags override the master switch (opt-out model).
 * If the lane flag is explicitly set, use it. Otherwise fall back to master switch.
 */
export function isAutomationLaneEnabled(laneEnvKey: string): boolean {
  const laneValue = process.env[laneEnvKey]?.trim().toLowerCase();
  if (laneValue === "true" || laneValue === "1" || laneValue === "yes" || laneValue === "on") {
    return true;
  }
  if (laneValue === "false" || laneValue === "0" || laneValue === "no" || laneValue === "off") {
    return false;
  }
  // Lane not explicitly set — fall back to master switch
  return isEnvFlagEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED");
}
```

Also add `BLUEPRINT_ALL_AUTOMATION_ENABLED` to the Zod schema:

```typescript
BLUEPRINT_ALL_AUTOMATION_ENABLED: z.string().trim().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/automation-lane-enablement.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Update .env.example with master switch and flipped defaults**

In `.env.example`, add the master switch near the top of the automation section and flip all automation flags to `true`:

```bash
# Master automation switch — enables all lanes unless individually disabled
BLUEPRINT_ALL_AUTOMATION_ENABLED=true

# Waitlist automation worker for capturer beta triage
BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=true
BLUEPRINT_WAITLIST_AUTOMATION_INTERVAL_MS=300000
BLUEPRINT_WAITLIST_AUTOMATION_BATCH_SIZE=10
BLUEPRINT_WAITLIST_AUTOMATION_STARTUP_DELAY_MS=15000
```

Repeat for all other `BLUEPRINT_*_ENABLED` flags — set each to `true`.

Add new worker env vars:

```bash
# SLA enforcement watchdog
BLUEPRINT_SLA_WATCHDOG_ENABLED=true
BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS=3600000

# Notion bidirectional sync
BLUEPRINT_NOTION_SYNC_ENABLED=true
BLUEPRINT_NOTION_SYNC_INTERVAL_MS=1800000

# Buyer onboarding sequence
BLUEPRINT_ONBOARDING_ENABLED=true
BLUEPRINT_ONBOARDING_INTERVAL_MS=3600000

# Agent graduation evaluation
BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS=86400000

# Image generation provider (google | openai | both)
BLUEPRINT_IMAGE_PROVIDER=google

# Notion sync database IDs
# NOTION_API_KEY=ntn_...
# NOTION_CAMPAIGNS_DB_ID=...
# NOTION_CREATIVE_RUNS_DB_ID=...
# NOTION_GRADUATION_DB_ID=...
# NOTION_SLA_DB_ID=...
# NOTION_TASKS_DB_ID=...
```

- [ ] **Step 6: Add new env vars to Zod schema in env.ts**

Add these to the schema in `server/config/env.ts`:

```typescript
BLUEPRINT_SLA_WATCHDOG_ENABLED: z.string().trim().optional(),
BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
BLUEPRINT_NOTION_SYNC_ENABLED: z.string().trim().optional(),
BLUEPRINT_NOTION_SYNC_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
BLUEPRINT_ONBOARDING_ENABLED: z.string().trim().optional(),
BLUEPRINT_ONBOARDING_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS: z.coerce.number().int().nonnegative().optional(),
BLUEPRINT_IMAGE_PROVIDER: z.string().trim().optional(),
NOTION_API_KEY: z.string().trim().min(1).optional(),
NOTION_CAMPAIGNS_DB_ID: z.string().trim().optional(),
NOTION_CREATIVE_RUNS_DB_ID: z.string().trim().optional(),
NOTION_GRADUATION_DB_ID: z.string().trim().optional(),
NOTION_SLA_DB_ID: z.string().trim().optional(),
NOTION_TASKS_DB_ID: z.string().trim().optional(),
OPENAI_API_KEY: z.string().trim().min(1).optional(),
```

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `npx vitest run server/tests/automation-lane-enablement.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/config/env.ts .env.example server/tests/automation-lane-enablement.test.ts
git commit -m "feat: enable automation lanes with master switch and opt-out overrides (Gap 1)"
```

---

### Task 2: Register New Scheduler Workers (Gap 2 — new workers only)

**Files:**
- Modify: `server/utils/opsAutomationScheduler.ts`

The existing scheduler already has workers for creative_asset_factory, autonomous_research_outbound, experiment_rollout, and buyer_lifecycle. We only need to add 4 new workers: sla_watchdog, notion_sync, graduation_eval, and onboarding_sequence.

- [ ] **Step 1: Add sla_watchdog worker definition**

Add to the workers array in `server/utils/opsAutomationScheduler.ts`:

```typescript
{
  key: "sla_watchdog",
  enabledEnv: "BLUEPRINT_SLA_WATCHDOG_ENABLED",
  intervalEnv: "BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS",
  batchEnv: "BLUEPRINT_SLA_WATCHDOG_BATCH_SIZE",
  startupDelayEnv: "BLUEPRINT_SLA_WATCHDOG_STARTUP_DELAY_MS",
  defaultIntervalMs: 60 * 60 * 1000,
  defaultBatchSize: 50,
  maxBatchSize: 200,
  defaultStartupDelayMs: 70 * 1000,
  run: async ({ limit }) => {
    const { runSlaWatchdog } = await import("./sla-enforcement");
    return runSlaWatchdog({ limit });
  },
},
```

- [ ] **Step 2: Add notion_sync worker definition**

```typescript
{
  key: "notion_sync",
  enabledEnv: "BLUEPRINT_NOTION_SYNC_ENABLED",
  intervalEnv: "BLUEPRINT_NOTION_SYNC_INTERVAL_MS",
  batchEnv: "BLUEPRINT_NOTION_SYNC_BATCH_SIZE",
  startupDelayEnv: "BLUEPRINT_NOTION_SYNC_STARTUP_DELAY_MS",
  defaultIntervalMs: 30 * 60 * 1000,
  defaultBatchSize: 50,
  maxBatchSize: 200,
  defaultStartupDelayMs: 80 * 1000,
  run: async ({ limit }) => {
    const { runNotionBidirectionalSync } = await import("./notion-sync");
    return runNotionBidirectionalSync({ limit });
  },
},
```

- [ ] **Step 3: Add graduation_eval worker definition**

```typescript
{
  key: "graduation_eval",
  enabledEnv: "BLUEPRINT_ALL_AUTOMATION_ENABLED",
  intervalEnv: "BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS",
  batchEnv: "BLUEPRINT_GRADUATION_EVAL_BATCH_SIZE",
  startupDelayEnv: "BLUEPRINT_GRADUATION_EVAL_STARTUP_DELAY_MS",
  defaultIntervalMs: 24 * 60 * 60 * 1000,
  defaultBatchSize: 20,
  maxBatchSize: 50,
  defaultStartupDelayMs: 90 * 1000,
  run: async ({ limit }) => {
    const { runGraduationEvaluation } = await import("./agent-graduation");
    return runGraduationEvaluation({ limit });
  },
},
```

- [ ] **Step 4: Add onboarding_sequence worker definition**

```typescript
{
  key: "onboarding_sequence",
  enabledEnv: "BLUEPRINT_ONBOARDING_ENABLED",
  intervalEnv: "BLUEPRINT_ONBOARDING_INTERVAL_MS",
  batchEnv: "BLUEPRINT_ONBOARDING_BATCH_SIZE",
  startupDelayEnv: "BLUEPRINT_ONBOARDING_STARTUP_DELAY_MS",
  defaultIntervalMs: 60 * 60 * 1000,
  defaultBatchSize: 25,
  maxBatchSize: 100,
  defaultStartupDelayMs: 75 * 1000,
  run: async ({ limit }) => {
    const { runOnboardingWorker } = await import("./buyer-onboarding");
    return runOnboardingWorker({ limit });
  },
},
```

- [ ] **Step 5: Verify the scheduler file compiles**

Run: `npx tsc --noEmit server/utils/opsAutomationScheduler.ts 2>&1 | head -20`
Expected: No errors (dynamic imports don't require the target files to exist at compile time)

- [ ] **Step 6: Commit**

```bash
git add server/utils/opsAutomationScheduler.ts
git commit -m "feat: register SLA, Notion sync, graduation, and onboarding scheduler workers (Gap 2)"
```

---

## Workstream B: Agent Infrastructure

### Task 3: Agent Graduation Tracking (Gap 4)

**Files:**
- Create: `server/utils/agent-graduation.ts`
- Create: `server/tests/agent-graduation.test.ts`
- Modify: `server/routes/admin-agent.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/agent-graduation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chainable = {
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return chainable;
    },
    orderBy: (...args: unknown[]) => {
      mockOrderBy(...args);
      return chainable;
    },
    limit: (n: number) => {
      mockLimit(n);
      return chainable;
    },
    get: mockGet,
  };
  return {
    default: {
      firestore: {
        FieldValue: { serverTimestamp: () => "TIMESTAMP" },
      },
    },
    dbAdmin: {
      collection: (name: string) => {
        mockCollection(name);
        return {
          ...chainable,
          doc: (id: string) => {
            mockDoc(id);
            return { get: mockGet, set: mockSet };
          },
        };
      },
    },
  };
});

describe("agent-graduation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  describe("evaluateGraduationStatus", () => {
    it("recommends promotion when accuracy exceeds threshold", async () => {
      // 25 actions, 24 approved, 1 rejected = 96% accuracy
      const actions = Array.from({ length: 24 }, (_, i) => ({
        data: () => ({
          lane: "waitlist",
          outcome: i % 2 === 0 ? "approved" : "auto_approved",
          created_at_iso: new Date(Date.now() - i * 86400000).toISOString(),
        }),
      })).concat([
        {
          data: () => ({
            lane: "waitlist",
            outcome: "rejected",
            created_at_iso: new Date().toISOString(),
          }),
        },
      ]);

      mockGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ currentPhase: 1, promotedAt: new Date(Date.now() - 15 * 86400000).toISOString() }) })
        .mockResolvedValueOnce({ docs: actions });

      const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
      const result = await evaluateGraduationStatus("waitlist");

      expect(result.recommendation).toBe("promote");
      expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0.9);
      expect(result.metrics.volume).toBe(25);
    });

    it("recommends hold when volume is too low", async () => {
      const actions = Array.from({ length: 5 }, (_, i) => ({
        data: () => ({
          lane: "waitlist",
          outcome: "approved",
          created_at_iso: new Date(Date.now() - i * 86400000).toISOString(),
        }),
      }));

      mockGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ currentPhase: 1, promotedAt: new Date(Date.now() - 15 * 86400000).toISOString() }) })
        .mockResolvedValueOnce({ docs: actions });

      const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
      const result = await evaluateGraduationStatus("waitlist");

      expect(result.recommendation).toBe("hold");
    });

    it("recommends demote when accuracy drops below threshold", async () => {
      // 20 actions, 15 approved, 5 rejected = 75% accuracy (below 90% for phase 1)
      const actions = Array.from({ length: 15 }, () => ({
        data: () => ({
          lane: "waitlist",
          outcome: "approved",
          created_at_iso: new Date().toISOString(),
        }),
      })).concat(
        Array.from({ length: 5 }, () => ({
          data: () => ({
            lane: "waitlist",
            outcome: "rejected",
            created_at_iso: new Date().toISOString(),
          }),
        })),
      );

      mockGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ currentPhase: 2, promotedAt: new Date(Date.now() - 60 * 86400000).toISOString() }) })
        .mockResolvedValueOnce({ docs: actions });

      const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
      const result = await evaluateGraduationStatus("waitlist");

      expect(result.recommendation).toBe("demote");
    });

    it("initializes phase 1 when no existing record", async () => {
      mockGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ docs: [] });

      const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
      const result = await evaluateGraduationStatus("waitlist");

      expect(result.currentPhase).toBe(1);
      expect(result.recommendation).toBe("hold");
    });
  });

  describe("runGraduationEvaluation", () => {
    it("evaluates all lanes and returns summary", async () => {
      mockGet.mockResolvedValue({ exists: false, docs: [] });
      mockSet.mockResolvedValue(undefined);

      const { runGraduationEvaluation } = await import("../utils/agent-graduation");
      const result = await runGraduationEvaluation({ limit: 50 });

      expect(result.processedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
    });
  });

  describe("promoteAgentLane", () => {
    it("advances phase and resets counters", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ currentPhase: 1 }),
      });
      mockSet.mockResolvedValue(undefined);

      const { promoteAgentLane } = await import("../utils/agent-graduation");
      const result = await promoteAgentLane("waitlist", "founder@tryblueprint.io");

      expect(result.currentPhase).toBe(2);
      expect(mockSet).toHaveBeenCalled();
    });

    it("refuses to promote beyond phase 4", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ currentPhase: 4 }),
      });

      const { promoteAgentLane } = await import("../utils/agent-graduation");
      const result = await promoteAgentLane("waitlist", "founder@tryblueprint.io");

      expect(result.currentPhase).toBe(4);
      expect(result.error).toMatch(/already at maximum/i);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/tests/agent-graduation.test.ts`
Expected: FAIL — module `../utils/agent-graduation` not found

- [ ] **Step 3: Implement agent-graduation.ts**

Create `server/utils/agent-graduation.ts`:

```typescript
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const GRADUATION_COLLECTION = "agent_graduation_status";
const ACTIONS_COLLECTION = "ops_automation_actions";
const EVALUATION_WINDOW_DAYS = 30;

const LANES = [
  "waitlist",
  "inbound_qualification",
  "support_triage",
  "payout_exception",
  "capturer_reminders",
  "buyer_lifecycle",
  "growth_campaign",
] as const;

type Lane = (typeof LANES)[number];

interface GraduationMetrics {
  accuracy: number;
  volume: number;
  daysInPhase: number;
  rejectionRate: number;
  failureRate: number;
}

interface GraduationRecord {
  lane: string;
  currentPhase: 1 | 2 | 3 | 4;
  metrics: GraduationMetrics;
  evaluationWindow: number;
  lastEvaluatedAt: string;
  recommendation: "hold" | "promote" | "demote" | null;
  recommendationReason: string | null;
  promotedAt: string | null;
  promotedBy: string | null;
}

const PROMOTION_THRESHOLDS: Record<number, { accuracy: number; volume: number; days: number }> = {
  1: { accuracy: 0.9, volume: 20, days: 14 },
  2: { accuracy: 0.95, volume: 50, days: 30 },
  3: { accuracy: 0.98, volume: 100, days: 60 },
};

const DEMOTION_ACCURACY_GAP = 0.05;

function computeMetrics(
  actions: Array<{ outcome: string; created_at_iso: string }>,
  promotedAt: string | null,
): GraduationMetrics {
  const total = actions.length;
  if (total === 0) {
    return { accuracy: 0, volume: 0, daysInPhase: 0, rejectionRate: 0, failureRate: 0 };
  }

  const approved = actions.filter(
    (a) => a.outcome === "approved" || a.outcome === "auto_approved",
  ).length;
  const rejected = actions.filter((a) => a.outcome === "rejected").length;
  const failed = actions.filter((a) => a.outcome === "failed").length;

  const daysInPhase = promotedAt
    ? Math.floor((Date.now() - new Date(promotedAt).getTime()) / 86400000)
    : 0;

  return {
    accuracy: approved / total,
    volume: total,
    daysInPhase,
    rejectionRate: rejected / total,
    failureRate: failed / total,
  };
}

export async function evaluateGraduationStatus(lane: string): Promise<GraduationRecord> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(GRADUATION_COLLECTION).doc(lane);
  const existing = await ref.get();
  const current = existing.exists
    ? (existing.data() as Partial<GraduationRecord>)
    : null;
  const currentPhase = (current?.currentPhase || 1) as 1 | 2 | 3 | 4;
  const promotedAt = current?.promotedAt || null;

  const windowStart = new Date(Date.now() - EVALUATION_WINDOW_DAYS * 86400000).toISOString();
  const actionsSnapshot = await db
    .collection(ACTIONS_COLLECTION)
    .where("lane", "==", lane)
    .where("created_at_iso", ">=", windowStart)
    .get();

  const actions = actionsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      outcome: String(data.outcome || ""),
      created_at_iso: String(data.created_at_iso || ""),
    };
  });

  const metrics = computeMetrics(actions, promotedAt);
  let recommendation: GraduationRecord["recommendation"] = "hold";
  let recommendationReason: string | null = null;

  if (currentPhase < 4) {
    const threshold = PROMOTION_THRESHOLDS[currentPhase];
    if (threshold) {
      if (
        metrics.accuracy >= threshold.accuracy &&
        metrics.volume >= threshold.volume &&
        metrics.daysInPhase >= threshold.days
      ) {
        recommendation = "promote";
        recommendationReason = `Accuracy ${(metrics.accuracy * 100).toFixed(1)}% ≥ ${threshold.accuracy * 100}%, volume ${metrics.volume} ≥ ${threshold.volume}, ${metrics.daysInPhase} days ≥ ${threshold.days} days in phase ${currentPhase}.`;
      } else {
        recommendationReason = `Not yet meeting phase ${currentPhase}→${currentPhase + 1} thresholds: accuracy=${(metrics.accuracy * 100).toFixed(1)}% (need ${threshold.accuracy * 100}%), volume=${metrics.volume} (need ${threshold.volume}), days=${metrics.daysInPhase} (need ${threshold.days}).`;
      }
    }
  }

  if (currentPhase > 1 && recommendation !== "promote") {
    const prevThreshold = PROMOTION_THRESHOLDS[currentPhase - 1];
    if (prevThreshold && metrics.accuracy < prevThreshold.accuracy - DEMOTION_ACCURACY_GAP) {
      recommendation = "demote";
      recommendationReason = `Accuracy ${(metrics.accuracy * 100).toFixed(1)}% dropped below phase ${currentPhase - 1} minimum (${(prevThreshold.accuracy - DEMOTION_ACCURACY_GAP) * 100}%).`;
    }
    if (metrics.failureRate > 0.1 && metrics.volume >= 7) {
      recommendation = "demote";
      recommendationReason = `Failure rate ${(metrics.failureRate * 100).toFixed(1)}% exceeds 10% over ${metrics.volume} actions.`;
    }
  }

  const record: GraduationRecord = {
    lane,
    currentPhase,
    metrics,
    evaluationWindow: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: new Date().toISOString(),
    recommendation,
    recommendationReason,
    promotedAt,
    promotedBy: current?.promotedBy || null,
  };

  await ref.set(
    { ...record, updated_at: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );

  return record;
}

export async function runGraduationEvaluation(
  params?: { limit?: number },
): Promise<{ processedCount: number; failedCount: number }> {
  let processedCount = 0;
  let failedCount = 0;
  const limit = params?.limit || LANES.length;

  for (const lane of LANES.slice(0, limit)) {
    try {
      await evaluateGraduationStatus(lane);
      processedCount++;
    } catch {
      failedCount++;
    }
  }

  return { processedCount, failedCount };
}

export async function promoteAgentLane(
  lane: string,
  promotedBy: string,
): Promise<GraduationRecord & { error?: string }> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(GRADUATION_COLLECTION).doc(lane);
  const existing = await ref.get();
  const current = existing.exists
    ? (existing.data() as Partial<GraduationRecord>)
    : null;
  const currentPhase = (current?.currentPhase || 1) as 1 | 2 | 3 | 4;

  if (currentPhase >= 4) {
    return {
      lane,
      currentPhase: 4,
      metrics: current?.metrics || { accuracy: 0, volume: 0, daysInPhase: 0, rejectionRate: 0, failureRate: 0 },
      evaluationWindow: EVALUATION_WINDOW_DAYS,
      lastEvaluatedAt: new Date().toISOString(),
      recommendation: null,
      recommendationReason: null,
      promotedAt: current?.promotedAt || null,
      promotedBy: current?.promotedBy || null,
      error: "Lane is already at maximum phase (4).",
    };
  }

  const newPhase = (currentPhase + 1) as 1 | 2 | 3 | 4;
  const now = new Date().toISOString();

  const record: GraduationRecord = {
    lane,
    currentPhase: newPhase,
    metrics: current?.metrics || { accuracy: 0, volume: 0, daysInPhase: 0, rejectionRate: 0, failureRate: 0 },
    evaluationWindow: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: now,
    recommendation: null,
    recommendationReason: `Promoted from phase ${currentPhase} to ${newPhase} by ${promotedBy}.`,
    promotedAt: now,
    promotedBy,
  };

  await ref.set(
    { ...record, updated_at: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );

  return record;
}

export async function demoteAgentLane(
  lane: string,
  demotedBy: string,
  reason: string,
): Promise<GraduationRecord> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(GRADUATION_COLLECTION).doc(lane);
  const existing = await ref.get();
  const current = existing.exists
    ? (existing.data() as Partial<GraduationRecord>)
    : null;
  const currentPhase = (current?.currentPhase || 1) as 1 | 2 | 3 | 4;
  const newPhase = Math.max(1, currentPhase - 1) as 1 | 2 | 3 | 4;
  const now = new Date().toISOString();

  const record: GraduationRecord = {
    lane,
    currentPhase: newPhase,
    metrics: current?.metrics || { accuracy: 0, volume: 0, daysInPhase: 0, rejectionRate: 0, failureRate: 0 },
    evaluationWindow: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: now,
    recommendation: null,
    recommendationReason: `Demoted from phase ${currentPhase} to ${newPhase} by ${demotedBy}: ${reason}`,
    promotedAt: now,
    promotedBy: demotedBy,
  };

  await ref.set(
    { ...record, updated_at: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );

  return record;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/tests/agent-graduation.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Add graduation API routes to admin-agent.ts**

Add to `server/routes/admin-agent.ts`:

```typescript
import {
  evaluateGraduationStatus,
  runGraduationEvaluation,
  promoteAgentLane,
  demoteAgentLane,
} from "../utils/agent-graduation";

// After existing routes, add:

router.get("/graduation", requireOps, async (_req, res) => {
  try {
    const lanes = [
      "waitlist", "inbound_qualification", "support_triage",
      "payout_exception", "capturer_reminders", "buyer_lifecycle", "growth_campaign",
    ];
    const results = await Promise.all(lanes.map((lane) => evaluateGraduationStatus(lane)));
    return res.status(200).json({ ok: true, lanes: results });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch graduation status");
    return res.status(500).json({ ok: false, error: "Failed to fetch graduation status" });
  }
});

router.post("/graduation/:lane/promote", requireOps, async (req, res) => {
  try {
    const lane = req.params.lane;
    const access = await resolveAccessContext(res);
    const promotedBy = access.email || "ops@tryblueprint.io";
    const result = await promoteAgentLane(lane, promotedBy);
    if ("error" in result && result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to promote agent lane");
    return res.status(500).json({ ok: false, error: "Failed to promote agent lane" });
  }
});

router.post("/graduation/:lane/demote", requireOps, async (req, res) => {
  try {
    const lane = req.params.lane;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Manual demotion";
    const access = await resolveAccessContext(res);
    const demotedBy = access.email || "ops@tryblueprint.io";
    const result = await demoteAgentLane(lane, demotedBy, reason);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to demote agent lane");
    return res.status(500).json({ ok: false, error: "Failed to demote agent lane" });
  }
});
```

- [ ] **Step 6: Run tests to verify no regressions**

Run: `npx vitest run server/tests/agent-graduation.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/utils/agent-graduation.ts server/tests/agent-graduation.test.ts server/routes/admin-agent.ts
git commit -m "feat: add agent graduation tracking with metrics, thresholds, and promotion API (Gap 4)"
```

---

## Workstream C: Growth & Creative

### Task 4: Landing Page A/B Testing (Gap 3)

**Files:**
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/pages/ForRobotIntegrators.tsx`
- Modify: `client/src/pages/HowItWorks.tsx`

- [ ] **Step 1: Add experiment variant to Home.tsx**

At the top of the Home component function, add:

```typescript
import { useEffect, useState } from "react";
import { resolveExperimentVariant } from "../lib/experiments";
import { analyticsEvents } from "../lib/analytics";

// Inside the component:
const [heroVariant, setHeroVariant] = useState<string>("proof_led");

useEffect(() => {
  let cancelled = false;
  resolveExperimentVariant("home_hero_variant", ["proof_led", "speed_led"]).then(
    (variant) => {
      if (!cancelled) {
        setHeroVariant(variant);
        analyticsEvents.experimentExposure("home_hero_variant", variant, "page_load");
      }
    },
  );
  return () => { cancelled = true; };
}, []);
```

Then in the hero section, wrap the headline and signal bullets in a conditional:

```typescript
{heroVariant === "speed_led" ? (
  <>
    <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950">
      Your robot trains on the real site in 72&nbsp;hours.
    </h1>
    <p className="mt-4 max-w-3xl text-[1.05rem] leading-8 text-slate-600">
      Blueprint captures the exact customer facility, packages it for simulation,
      and delivers a hosted review — all within a fixed SLA.
    </p>
  </>
) : (
  <>
    {/* Keep existing proof_led hero content exactly as-is */}
  </>
)}
```

For the signal bullets, add speed-led variants:

```typescript
const speedLedSignals = [
  "24-hour scoping from first contact",
  "48-hour evidence packaging with full provenance",
  "72-hour delivery with hosted review access",
  "Fixed SLA — no scope creep, no delays",
];

{/* In the signal bullets section: */}
{(heroVariant === "speed_led" ? speedLedSignals : heroSignals).map((item) => (
  // existing bullet rendering
))}
```

- [ ] **Step 2: Add experiment variant to ForRobotIntegrators.tsx**

At the top of the component:

```typescript
import { useEffect, useState } from "react";
import { resolveExperimentVariant } from "../lib/experiments";
import { analyticsEvents } from "../lib/analytics";

const [sectionOrder, setSectionOrder] = useState<string>("technical_first");

useEffect(() => {
  let cancelled = false;
  resolveExperimentVariant("integrators_value_prop_order", ["technical_first", "outcome_first"]).then(
    (variant) => {
      if (!cancelled) {
        setSectionOrder(variant);
        analyticsEvents.experimentExposure("integrators_value_prop_order", variant, "page_load");
      }
    },
  );
  return () => { cancelled = true; };
}, []);
```

Then extract the 3 main sections into named variables and render based on variant:

```typescript
const useCaseSection = (
  <section className="mt-12">
    {/* existing use case cards section */}
  </section>
);

const whatYouGetSection = (
  <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
    {/* existing what-you-get + what-to-expect grid */}
  </section>
);

// In the JSX:
{sectionOrder === "outcome_first" ? (
  <>
    {whatYouGetSection}
    {useCaseSection}
  </>
) : (
  <>
    {useCaseSection}
    {whatYouGetSection}
  </>
)}
```

- [ ] **Step 3: Add experiment variant to HowItWorks.tsx**

At the top of the component:

```typescript
import { useEffect, useState } from "react";
import { resolveExperimentVariant } from "../lib/experiments";
import { analyticsEvents } from "../lib/analytics";

const [formatVariant, setFormatVariant] = useState<string>("steps");

useEffect(() => {
  let cancelled = false;
  resolveExperimentVariant("how_it_works_format", ["steps", "video"]).then(
    (variant) => {
      if (!cancelled) {
        setFormatVariant(variant);
        analyticsEvents.experimentExposure("how_it_works_format", variant, "page_load");
      }
    },
  );
  return () => { cancelled = true; };
}, []);
```

Then wrap the step-by-step section in a conditional:

```typescript
{formatVariant === "video" ? (
  <section className="mt-12">
    <ScrollReveal>
      <h2 className="text-2xl font-semibold text-slate-900">See it in action</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Watch how Blueprint captures a real facility and delivers a hosted review.
      </p>
    </ScrollReveal>
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
      <video
        src="/proof/blueprint-proof-reel.mp4"
        controls
        playsInline
        className="w-full"
        poster="/proof/blueprint-proof-reel-poster.jpg"
      />
    </div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step) => (
        <ScrollReveal key={step.title}>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <step.icon className="h-5 w-5 text-slate-700" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  </section>
) : (
  <>
    {/* Keep existing steps section exactly as-is */}
  </>
)}
```

- [ ] **Step 4: Verify pages render without errors**

Run: `npx vitest run client/tests/pages/Home.test.tsx client/tests/pages/ForRobotIntegrators.test.tsx`
Expected: Existing tests still pass (default control variants render existing content)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Home.tsx client/src/pages/ForRobotIntegrators.tsx client/src/pages/HowItWorks.tsx
git commit -m "feat: wire A/B experiment variants to Home, ForRobotIntegrators, and HowItWorks pages (Gap 3)"
```

---

### Task 5: GPT-4o Image Generation (Gap 6)

**Files:**
- Create: `server/utils/openai-creative.ts`
- Create: `server/tests/openai-creative.test.ts`
- Modify: `server/utils/provider-status.ts`
- Modify: `server/routes/admin-creative.ts`
- Modify: `server/utils/creative-factory.ts`
- Modify: `client/src/pages/AdminGrowthStudio.tsx`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/openai-creative.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

describe("openai-creative", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("generateOpenAIImage", () => {
    it("returns a base64 data URL on success", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const fakeB64 = Buffer.from("fake-image-bytes").toString("base64");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ b64_json: fakeB64, revised_prompt: "a revised prompt" }],
        }),
      }));

      const { generateOpenAIImage } = await import("../utils/openai-creative");
      const result = await generateOpenAIImage({ prompt: "a test image" });

      expect(result.dataUrl).toBe(`data:image/png;base64,${fakeB64}`);
      expect(result.revisedPrompt).toBe("a revised prompt");
    });

    it("throws when API key is not configured", async () => {
      delete process.env.OPENAI_API_KEY;
      const { generateOpenAIImage } = await import("../utils/openai-creative");
      await expect(generateOpenAIImage({ prompt: "test" })).rejects.toThrow(/not configured/i);
    });

    it("throws on API error with provider status", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { message: "Rate limited" } }),
      }));

      const { generateOpenAIImage } = await import("../utils/openai-creative");
      await expect(generateOpenAIImage({ prompt: "test" })).rejects.toThrow("Rate limited");
    });
  });

  describe("getOpenAICreativeStatus", () => {
    it("reports not_configured when no API key", async () => {
      delete process.env.OPENAI_API_KEY;
      const { getOpenAICreativeStatus } = await import("../utils/openai-creative");
      const status = getOpenAICreativeStatus();
      expect(status.configured).toBe(false);
      expect(status.executionState).toBe("not_configured");
    });

    it("reports configured_unverified when API key exists", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const { getOpenAICreativeStatus } = await import("../utils/openai-creative");
      const status = getOpenAICreativeStatus();
      expect(status.configured).toBe(true);
      expect(status.executionState).toBe("configured_unverified");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/tests/openai-creative.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement openai-creative.ts**

Create `server/utils/openai-creative.ts`:

```typescript
import { getConfiguredEnvValue } from "../config/env";
import type { ProviderExecutionState } from "./provider-status";

export interface OpenAIImageOptions {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high";
}

export interface OpenAIImageResult {
  dataUrl: string;
  revisedPrompt: string;
}

export interface OpenAICreativeStatus {
  configured: boolean;
  available: boolean;
  model: string;
  apiKeySource: "OPENAI_API_KEY" | null;
  executionState: ProviderExecutionState;
  note: string;
  lastError: string | null;
}

export function getOpenAICreativeStatus(
  overrides?: Partial<Pick<OpenAICreativeStatus, "executionState" | "note" | "lastError">>,
): OpenAICreativeStatus {
  const apiKey = getConfiguredEnvValue("OPENAI_API_KEY");
  const configured = Boolean(apiKey);
  const executionState =
    overrides?.executionState || (configured ? "configured_unverified" : "not_configured");
  const defaultNote = configured
    ? "OpenAI API key is configured. Live image generation depends on quota and billing."
    : "Configure OPENAI_API_KEY to enable GPT-4o image generation.";

  return {
    configured,
    available: executionState === "ready" || executionState === "configured_unverified",
    model: "gpt-image-1",
    apiKeySource: configured ? "OPENAI_API_KEY" : null,
    executionState,
    note: overrides?.note || defaultNote,
    lastError: overrides?.lastError || null,
  };
}

export function classifyOpenAICreativeFailure(
  statusCode: number | null | undefined,
  rawMessage: string | null | undefined,
): OpenAICreativeStatus {
  const message = String(rawMessage || "").trim();
  const normalized = message.toLowerCase();

  if (statusCode === 429 || normalized.includes("rate") || normalized.includes("quota")) {
    return getOpenAICreativeStatus({
      executionState: "blocked_quota_or_billing",
      note: "OpenAI image generation is blocked by rate limit or quota.",
      lastError: message || null,
    });
  }

  if (statusCode === 401 || statusCode === 403) {
    return getOpenAICreativeStatus({
      executionState: "blocked_permission",
      note: "OpenAI API key is not authorized for image generation.",
      lastError: message || null,
    });
  }

  return getOpenAICreativeStatus({
    executionState: "request_failed",
    note: "OpenAI image generation request failed.",
    lastError: message || null,
  });
}

export async function generateOpenAIImage(
  options: OpenAIImageOptions,
): Promise<OpenAIImageResult> {
  const apiKey = getConfiguredEnvValue("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Set OPENAI_API_KEY to enable image generation.");
  }

  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const size = options.size || "1024x1024";
  const quality = options.quality || "medium";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality,
      response_format: "b64_json",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "OpenAI image generation failed";
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      providerStatus: classifyOpenAICreativeFailure(response.status, message),
    });
  }

  const imageData = payload?.data?.[0];
  if (!imageData?.b64_json) {
    throw new Error("OpenAI returned no image data");
  }

  return {
    dataUrl: `data:image/png;base64,${imageData.b64_json}`,
    revisedPrompt: imageData.revised_prompt || prompt,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/tests/openai-creative.test.ts`
Expected: PASS

- [ ] **Step 5: Add OpenAI status to provider-status.ts**

In `server/utils/provider-status.ts`, add to the imports:

```typescript
import { getOpenAICreativeStatus } from "./openai-creative";
```

Add to the `buildGrowthIntegrationSummary` return object:

```typescript
openaiImage: getOpenAICreativeStatus(params?.openaiImage),
```

And update the params type to include:

```typescript
openaiImage?: Partial<Pick<import("./openai-creative").OpenAICreativeStatus, "executionState" | "note" | "lastError">>;
```

- [ ] **Step 6: Add provider param to admin-creative.ts generate-image route**

In `server/routes/admin-creative.ts`, update the generate-image handler:

```typescript
import { generateOpenAIImage } from "../utils/openai-creative";

// Inside the POST /generate-image handler, before the Google call:
const provider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "google";

if (provider === "openai") {
  try {
    const result = await generateOpenAIImage({
      prompt,
      size: typeof req.body?.size === "string" ? req.body.size as "1024x1024" | "1536x1024" | "1024x1536" : undefined,
      quality: typeof req.body?.quality === "string" ? req.body.quality as "low" | "medium" | "high" : undefined,
    });
    return res.status(HTTP_STATUS.OK).json({
      ok: true,
      provider: "openai",
      images: [{ mimeType: "image/png", dataUrl: result.dataUrl }],
      revisedPrompt: result.revisedPrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate image";
    const providerStatus = (error as { providerStatus?: unknown })?.providerStatus || null;
    return res.status(500).json({ ok: false, error: message, providerStatus });
  }
}

// Existing Google path continues below...
```

- [ ] **Step 7: Add provider selection to creative-factory.ts**

In `server/utils/creative-factory.ts`, add the OpenAI provider option:

```typescript
import { generateOpenAIImage } from "./openai-creative";

// Inside runCreativeAssetFactoryLoop, before the image generation loop:
const imageProvider = (process.env.BLUEPRINT_IMAGE_PROVIDER || "google").toLowerCase();

// Replace the image generation loop with:
for (const prompt of kit.prompts.nanoBananaVariants.slice(0, 3)) {
  try {
    if (imageProvider === "openai" || imageProvider === "both") {
      const openaiResult = await generateOpenAIImage({ prompt, quality: "medium" });
      imageBatch.push({
        prompt,
        images: [{ mimeType: "image/png", dataUrl: openaiResult.dataUrl }],
      });
    }
    if (imageProvider === "google" || (imageProvider === "both" && imageBatch.length === 0)) {
      const generated = await generateGoogleCreativeImages({
        prompt,
        aspectRatio: "16:9",
        imageSize: "1K",
        thinkingLevel: "HIGH",
        sampleCount: 1,
      });
      imageBatch.push({
        prompt,
        images: generated.images.map((image) => ({
          mimeType: image.mimeType,
          dataUrl: image.dataUrl,
        })),
      });
    }
  } catch {
    // Keep the prompt pack even when provider execution is unavailable.
  }
}
```

- [ ] **Step 8: Add provider dropdown to AdminGrowthStudio.tsx**

In `client/src/pages/AdminGrowthStudio.tsx`, add state:

```typescript
const [imageProvider, setImageProvider] = useState<string>("google");
```

Add a select near the existing image generation form:

```typescript
<label className="text-xs font-medium text-slate-600">
  Image provider
  <select
    value={imageProvider}
    onChange={(e) => setImageProvider(e.target.value)}
    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="google">Google (Gemini)</option>
    <option value="openai">OpenAI (GPT-4o)</option>
  </select>
</label>
```

Update the generate image fetch call to include `provider: imageProvider` in the body.

- [ ] **Step 9: Run tests**

Run: `npx vitest run server/tests/openai-creative.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add server/utils/openai-creative.ts server/tests/openai-creative.test.ts server/utils/provider-status.ts server/routes/admin-creative.ts server/utils/creative-factory.ts client/src/pages/AdminGrowthStudio.tsx
git commit -m "feat: add GPT-4o image generation with provider selection (Gap 6)"
```

---

## Workstream D: Revenue & Offer

### Task 6: Agent-Operated Buyer Onboarding (Gap 7)

**Files:**
- Create: `server/utils/buyer-onboarding.ts`
- Create: `server/tests/buyer-onboarding.test.ts`
- Modify: `server/routes/stripe-webhooks.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/buyer-onboarding.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chainable = {
    where: (...args: unknown[]) => { mockWhere(...args); return chainable; },
    orderBy: (...args: unknown[]) => { mockOrderBy(...args); return chainable; },
    limit: (n: number) => { mockLimit(n); return chainable; },
    get: mockGet,
  };
  return {
    default: {
      firestore: { FieldValue: { serverTimestamp: () => "TIMESTAMP" } },
    },
    dbAdmin: {
      collection: (name: string) => {
        mockCollection(name);
        return {
          ...chainable,
          doc: (id: string) => { mockDoc(id); return { get: mockGet, set: mockSet }; },
        };
      },
    },
  };
});

const mockExecuteAction = vi.fn().mockResolvedValue({ status: "executed" });
vi.mock("../agents/action-executor", () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}));

describe("buyer-onboarding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  describe("createOnboardingSequence", () => {
    it("creates a 3-step onboarding sequence", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const { createOnboardingSequence } = await import("../utils/buyer-onboarding");

      await createOnboardingSequence({
        orderId: "order_123",
        buyerEmail: "buyer@example.com",
        skuName: "Exact-Site Hosted Review",
        licenseTier: "commercial",
      });

      expect(mockSet).toHaveBeenCalledTimes(1);
      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.steps).toHaveLength(3);
      expect(setCall.steps[0].key).toBe("welcome");
      expect(setCall.steps[1].key).toBe("checkin_day3");
      expect(setCall.steps[2].key).toBe("activation_day7");
      expect(setCall.status).toBe("active");
    });

    it("skips if sequence already exists", async () => {
      mockGet.mockResolvedValueOnce({ exists: true });
      const { createOnboardingSequence } = await import("../utils/buyer-onboarding");

      await createOnboardingSequence({
        orderId: "order_123",
        buyerEmail: "buyer@example.com",
        skuName: "Exact-Site Hosted Review",
        licenseTier: "commercial",
      });

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe("runOnboardingWorker", () => {
    it("processes pending steps that are due", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockGet.mockResolvedValueOnce({
        docs: [{
          id: "order_123",
          data: () => ({
            orderId: "order_123",
            buyerEmail: "buyer@example.com",
            skuName: "Test SKU",
            status: "active",
            steps: [
              { key: "welcome", scheduledAt: pastDate, sentAt: null, status: "pending", emailSubject: "Welcome", emailBody: "Hello" },
              { key: "checkin_day3", scheduledAt: new Date(Date.now() + 86400000).toISOString(), sentAt: null, status: "pending", emailSubject: "Check in", emailBody: "Hi" },
            ],
          }),
          ref: { set: mockSet },
        }],
      });

      const { runOnboardingWorker } = await import("../utils/buyer-onboarding");
      const result = await runOnboardingWorker({ limit: 10 });

      expect(result.processedCount).toBe(1);
      expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/tests/buyer-onboarding.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement buyer-onboarding.ts**

Create `server/utils/buyer-onboarding.ts`:

```typescript
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { executeAction } from "../agents/action-executor";

const COLLECTION = "onboarding_sequences";

interface OnboardingStep {
  key: "welcome" | "checkin_day3" | "activation_day7";
  scheduledAt: string;
  sentAt: string | null;
  status: "pending" | "sent" | "skipped";
  emailSubject: string;
  emailBody: string;
}

interface OnboardingSequence {
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  status: "active" | "completed" | "paused";
  steps: OnboardingStep[];
  createdAt: string;
  completedAt: string | null;
}

interface CreateOnboardingParams {
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
}

function buildOnboardingSteps(params: CreateOnboardingParams): OnboardingStep[] {
  const now = Date.now();
  return [
    {
      key: "welcome",
      scheduledAt: new Date(now).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Your ${params.skuName} is ready`,
      emailBody: [
        `Thanks for purchasing the ${params.skuName} (${params.licenseTier} license).`,
        "",
        "Here's what happens next:",
        "1. Your hosted review access is being provisioned now.",
        "2. You'll receive access credentials within 24 hours.",
        "3. Your review package includes full capture provenance and rights documentation.",
        "",
        "If you have questions, reply to this email or book a walkthrough at https://www.tryblueprint.io/contact",
      ].join("\n"),
    },
    {
      key: "checkin_day3",
      scheduledAt: new Date(now + 3 * 86400000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Quick check: have you accessed your ${params.skuName}?`,
      emailBody: [
        "Just checking in — have you had a chance to open your package and review the site data?",
        "",
        "Quick-start tips:",
        "• Open the hosted review link from your confirmation email",
        "• Check the provenance manifest to verify capture coverage",
        "• Download the exports you need for your simulation pipeline",
        "",
        "If anything looks off or you need help interpreting the data, reply here.",
      ].join("\n"),
    },
    {
      key: "activation_day7",
      scheduledAt: new Date(now + 7 * 86400000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Week one with ${params.skuName} — what teams usually do next`,
      emailBody: [
        "By now, most teams have:",
        "• Loaded the site data into their simulation environment",
        "• Identified the specific areas they need for robot training",
        "• Found questions about coverage gaps or edge cases",
        "",
        "If your team has questions about the site data or wants to discuss a second capture, we can schedule a hosted review walkthrough.",
        "",
        "Book here: https://www.tryblueprint.io/contact?interest=review-walkthrough",
      ].join("\n"),
    },
  ];
}

export async function createOnboardingSequence(params: CreateOnboardingParams): Promise<void> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(COLLECTION).doc(params.orderId);
  const existing = await ref.get();
  if (existing.exists) return;

  const sequence: OnboardingSequence = {
    orderId: params.orderId,
    buyerEmail: params.buyerEmail,
    skuName: params.skuName,
    licenseTier: params.licenseTier,
    status: "active",
    steps: buildOnboardingSteps(params),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  await ref.set({
    ...sequence,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function runOnboardingWorker(
  params?: { limit?: number },
): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) throw new Error("Database not available");

  const limit = params?.limit || 25;
  const now = new Date().toISOString();
  let processedCount = 0;
  let failedCount = 0;

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "==", "active")
    .limit(limit)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as OnboardingSequence;
    let updated = false;

    for (const step of data.steps) {
      if (step.status !== "pending") continue;
      if (step.scheduledAt > now) continue;

      try {
        await executeAction({
          lane: "buyer_lifecycle",
          type: "send_email",
          idempotencyKey: `onboarding:${data.orderId}:${step.key}`,
          recipientEmail: data.buyerEmail,
          subject: step.emailSubject,
          body: step.emailBody,
          metadata: {
            orderId: data.orderId,
            onboardingStep: step.key,
          },
        });

        step.status = "sent";
        step.sentAt = new Date().toISOString();
        processedCount++;
        updated = true;
      } catch {
        failedCount++;
      }
    }

    if (updated) {
      const allSent = data.steps.every((s) => s.status === "sent" || s.status === "skipped");
      await doc.ref.set(
        {
          steps: data.steps,
          status: allSent ? "completed" : "active",
          completedAt: allSent ? new Date().toISOString() : null,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return { processedCount, failedCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/tests/buyer-onboarding.test.ts`
Expected: PASS

- [ ] **Step 5: Wire onboarding into stripe-webhooks.ts**

In `server/routes/stripe-webhooks.ts`, after the `markBuyerOrderPaidFromCheckout()` call inside `handleCheckoutSessionCompleted`:

```typescript
import { createOnboardingSequence } from "../utils/buyer-onboarding";

// After markBuyerOrderPaidFromCheckout succeeds, add:
if (order && order.id) {
  createOnboardingSequence({
    orderId: order.id,
    buyerEmail: typeof session.customer_details?.email === "string"
      ? session.customer_details.email
      : "",
    skuName: String(session.metadata?.sku_name || ""),
    licenseTier: String(session.metadata?.license_tier || ""),
  }).catch((err) => {
    logger.error({ err, orderId: order.id }, "Failed to create onboarding sequence");
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run server/tests/buyer-onboarding.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/utils/buyer-onboarding.ts server/tests/buyer-onboarding.test.ts server/routes/stripe-webhooks.ts
git commit -m "feat: add agent-operated buyer onboarding sequence (Gap 7)"
```

---

### Task 7: Renewal/Upsell Automation (Gap 8)

**Files:**
- Create: `server/tests/renewal-tracking.test.ts`
- Modify: `server/utils/growth-ops.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/renewal-tracking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chainable = {
    where: (...args: unknown[]) => { mockWhere(...args); return chainable; },
    orderBy: () => chainable,
    limit: (n: number) => { mockLimit(n); return chainable; },
    get: mockGet,
  };
  return {
    default: {
      firestore: { FieldValue: { serverTimestamp: () => "TIMESTAMP" } },
    },
    dbAdmin: {
      collection: (name: string) => {
        mockCollection(name);
        return {
          ...chainable,
          doc: (id: string) => { mockDoc(id); return { get: mockGet, set: mockSet }; },
        };
      },
    },
  };
});

const mockExecuteAction = vi.fn().mockResolvedValue({ status: "executed" });
vi.mock("../agents/action-executor", () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}));

describe("renewal-tracking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  describe("initRenewalTracking", () => {
    it("creates a renewal tracker for a new entitlement", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const { initRenewalTracking } = await import("../utils/growth-ops");

      await initRenewalTracking({
        entitlementId: "ent_123",
        orderId: "order_123",
        buyerEmail: "buyer@example.com",
        skuName: "Exact-Site Hosted Review",
        licenseTier: "commercial",
        grantedAt: new Date().toISOString(),
      });

      expect(mockSet).toHaveBeenCalledTimes(1);
      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.status).toBe("not_due");
      expect(setCall.renewalWindowOpensAt).toBeDefined();
    });
  });

  describe("runRenewalOutreach", () => {
    it("sends renewal email for entitlements in renewal window", async () => {
      const grantedAt = new Date(Date.now() - 76 * 86400000).toISOString();
      mockGet.mockResolvedValueOnce({
        docs: [{
          id: "ent_123",
          data: () => ({
            entitlementId: "ent_123",
            orderId: "order_123",
            buyerEmail: "buyer@example.com",
            skuName: "Exact-Site Hosted Review",
            licenseTier: "commercial",
            grantedAt,
            status: "not_due",
            outreachHistory: [],
          }),
          ref: { set: mockSet },
        }],
      });

      const { runRenewalOutreach } = await import("../utils/growth-ops");
      const result = await runRenewalOutreach({ limit: 10 });

      expect(result.processedCount).toBe(1);
      expect(mockExecuteAction).toHaveBeenCalled();
    });

    it("escalates at-risk renewals at 85 days", async () => {
      const grantedAt = new Date(Date.now() - 86 * 86400000).toISOString();
      mockGet.mockResolvedValueOnce({
        docs: [{
          id: "ent_456",
          data: () => ({
            entitlementId: "ent_456",
            orderId: "order_456",
            buyerEmail: "buyer@example.com",
            skuName: "Test SKU",
            licenseTier: "research",
            grantedAt,
            status: "outreach_sent",
            outreachHistory: [
              { type: "renewal_intro", sentAt: new Date(Date.now() - 10 * 86400000).toISOString() },
            ],
          }),
          ref: { set: mockSet },
        }],
      });

      const { runRenewalOutreach } = await import("../utils/growth-ops");
      const result = await runRenewalOutreach({ limit: 10 });

      expect(result.processedCount).toBe(1);
      const setCall = mockSet.mock.calls[0]?.[0];
      expect(setCall?.status).toBe("at_risk");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/tests/renewal-tracking.test.ts`
Expected: FAIL — `initRenewalTracking` and `runRenewalOutreach` not exported

- [ ] **Step 3: Add renewal tracking functions to growth-ops.ts**

Append to `server/utils/growth-ops.ts`:

```typescript
const RENEWAL_COLLECTION = "renewal_tracking";

interface RenewalOutreach {
  type: "renewal_intro" | "renewal_reminder" | "at_risk_escalation";
  sentAt: string;
  emailSubject?: string;
  channel: "email" | "ops_queue";
}

interface RenewalTracker {
  entitlementId: string;
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  grantedAt: string;
  renewalWindowOpensAt: string;
  renewalDeadline: string;
  status: "not_due" | "outreach_sent" | "at_risk" | "renewed" | "churned";
  outreachHistory: RenewalOutreach[];
}

export async function initRenewalTracking(params: {
  entitlementId: string;
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  grantedAt: string;
}): Promise<void> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(RENEWAL_COLLECTION).doc(params.entitlementId);
  const existing = await ref.get();
  if (existing.exists) return;

  const grantedMs = new Date(params.grantedAt).getTime();

  await ref.set({
    entitlementId: params.entitlementId,
    orderId: params.orderId,
    buyerEmail: params.buyerEmail,
    skuName: params.skuName,
    licenseTier: params.licenseTier,
    grantedAt: params.grantedAt,
    renewalWindowOpensAt: new Date(grantedMs + 75 * 86400000).toISOString(),
    renewalDeadline: new Date(grantedMs + 365 * 86400000).toISOString(),
    status: "not_due",
    outreachHistory: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function runRenewalOutreach(
  params?: { limit?: number },
): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) throw new Error("Database not available");

  const limit = params?.limit || 25;
  let processedCount = 0;
  let failedCount = 0;

  const snapshot = await db
    .collection(RENEWAL_COLLECTION)
    .where("status", "in", ["not_due", "outreach_sent"])
    .limit(limit)
    .get();

  const now = Date.now();

  for (const doc of snapshot.docs) {
    const data = doc.data() as RenewalTracker;
    const daysSinceGrant = Math.floor((now - new Date(data.grantedAt).getTime()) / 86400000);

    try {
      if (daysSinceGrant >= 85 && data.status === "outreach_sent") {
        await executeAction({
          lane: "buyer_lifecycle",
          type: "queue_for_review",
          idempotencyKey: `renewal:at_risk:${data.entitlementId}`,
          recipientEmail: data.buyerEmail,
          subject: `Renewal at risk: ${data.skuName} — ${data.buyerEmail}`,
          body: `Entitlement ${data.entitlementId} is ${daysSinceGrant} days old with no renewal. Escalating for human review.`,
          metadata: { entitlementId: data.entitlementId, orderId: data.orderId },
        });

        await doc.ref.set({
          status: "at_risk",
          outreachHistory: [
            ...data.outreachHistory,
            { type: "at_risk_escalation", sentAt: new Date().toISOString(), channel: "ops_queue" },
          ],
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        processedCount++;
      } else if (daysSinceGrant >= 75 && data.status === "not_due") {
        const subject = `Time to renew your ${data.skuName}`;
        const body = [
          `Your ${data.skuName} (${data.licenseTier} license) is approaching its renewal window.`,
          "",
          "To continue access, you can renew at:",
          `https://www.tryblueprint.io/checkout?sku=${encodeURIComponent(data.skuName)}&tier=${encodeURIComponent(data.licenseTier)}&renewal_of=${encodeURIComponent(data.orderId)}`,
          "",
          "If you have questions about your usage or want to discuss upgrading, reply to this email.",
        ].join("\n");

        await executeAction({
          lane: "buyer_lifecycle",
          type: "send_email",
          idempotencyKey: `renewal:intro:${data.entitlementId}`,
          recipientEmail: data.buyerEmail,
          subject,
          body,
          metadata: { entitlementId: data.entitlementId, orderId: data.orderId },
        });

        await doc.ref.set({
          status: "outreach_sent",
          outreachHistory: [
            ...data.outreachHistory,
            { type: "renewal_intro", sentAt: new Date().toISOString(), emailSubject: subject, channel: "email" },
          ],
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        processedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { processedCount, failedCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/tests/renewal-tracking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/growth-ops.ts server/tests/renewal-tracking.test.ts
git commit -m "feat: add renewal tracking and outreach automation (Gap 8)"
```

---

### Task 8: Fixed-SLA Enforcement (Gap 10)

**Files:**
- Create: `server/utils/sla-enforcement.ts`
- Create: `server/tests/sla-enforcement.test.ts`
- Modify: `server/routes/inbound-request.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/sla-enforcement.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chainable = {
    where: (...args: unknown[]) => { mockWhere(...args); return chainable; },
    orderBy: () => chainable,
    limit: (n: number) => { mockLimit(n); return chainable; },
    get: mockGet,
  };
  return {
    default: {
      firestore: { FieldValue: { serverTimestamp: () => "TIMESTAMP" } },
    },
    dbAdmin: {
      collection: (name: string) => {
        mockCollection(name);
        return {
          ...chainable,
          doc: (id: string) => { mockDoc(id); return { get: mockGet, set: mockSet }; },
        };
      },
    },
  };
});

const mockExecuteAction = vi.fn().mockResolvedValue({ status: "executed" });
vi.mock("../agents/action-executor", () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}));

describe("sla-enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  describe("createSlaTracker", () => {
    it("creates a tracker with scoping as first active stage", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const { createSlaTracker } = await import("../utils/sla-enforcement");

      await createSlaTracker({
        requestId: "req_123",
        buyerEmail: "buyer@example.com",
      });

      expect(mockSet).toHaveBeenCalledTimes(1);
      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.currentStage).toBe("scoping");
      expect(setCall.stages).toHaveLength(4);
      expect(setCall.stages[0].status).toBe("active");
    });
  });

  describe("runSlaWatchdog", () => {
    it("marks at_risk when approaching deadline", async () => {
      const startedAt = new Date(Date.now() - 20 * 3600000).toISOString();
      mockGet.mockResolvedValueOnce({
        docs: [{
          id: "req_123",
          data: () => ({
            requestId: "req_123",
            buyerEmail: "buyer@example.com",
            currentStage: "scoping",
            status: "on_track",
            stages: [
              {
                key: "scoping",
                slaHours: 24,
                startedAt,
                deadline: new Date(new Date(startedAt).getTime() + 24 * 3600000).toISOString(),
                completedAt: null,
                status: "active",
                escalations: [],
              },
            ],
          }),
          ref: { set: mockSet },
        }],
      });

      const { runSlaWatchdog } = await import("../utils/sla-enforcement");
      const result = await runSlaWatchdog({ limit: 50 });

      expect(result.processedCount).toBe(1);
      const setCall = mockSet.mock.calls[0]?.[0];
      expect(setCall?.status).toBe("at_risk");
    });

    it("marks breached when past deadline", async () => {
      const startedAt = new Date(Date.now() - 25 * 3600000).toISOString();
      mockGet.mockResolvedValueOnce({
        docs: [{
          id: "req_456",
          data: () => ({
            requestId: "req_456",
            buyerEmail: "buyer@example.com",
            currentStage: "scoping",
            status: "on_track",
            stages: [
              {
                key: "scoping",
                slaHours: 24,
                startedAt,
                deadline: new Date(new Date(startedAt).getTime() + 24 * 3600000).toISOString(),
                completedAt: null,
                status: "active",
                escalations: [],
              },
            ],
          }),
          ref: { set: mockSet },
        }],
      });

      const { runSlaWatchdog } = await import("../utils/sla-enforcement");
      const result = await runSlaWatchdog({ limit: 50 });

      expect(result.processedCount).toBe(1);
      expect(mockExecuteAction).toHaveBeenCalled();
    });
  });

  describe("advanceSlaStage", () => {
    it("completes current stage and activates next", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          currentStage: "scoping",
          stages: [
            { key: "scoping", slaHours: 24, startedAt: new Date().toISOString(), deadline: new Date().toISOString(), completedAt: null, status: "active", escalations: [] },
            { key: "packaging", slaHours: 48, startedAt: null, deadline: null, completedAt: null, status: "pending", escalations: [] },
            { key: "delivery", slaHours: 72, startedAt: null, deadline: null, completedAt: null, status: "pending", escalations: [] },
            { key: "review_setup", slaHours: 24, startedAt: null, deadline: null, completedAt: null, status: "pending", escalations: [] },
          ],
        }),
      });

      const { advanceSlaStage } = await import("../utils/sla-enforcement");
      await advanceSlaStage("req_123");

      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.currentStage).toBe("packaging");
      expect(setCall.stages[0].status).toBe("completed");
      expect(setCall.stages[1].status).toBe("active");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/tests/sla-enforcement.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement sla-enforcement.ts**

Create `server/utils/sla-enforcement.ts`:

```typescript
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { executeAction } from "../agents/action-executor";

const COLLECTION = "sla_tracking";

interface SlaEscalation {
  type: "warning" | "breach";
  channel: "slack" | "email" | "ops_queue";
  sentAt: string;
  message: string;
}

interface SlaStage {
  key: "scoping" | "packaging" | "delivery" | "review_setup";
  slaHours: number;
  startedAt: string | null;
  deadline: string | null;
  completedAt: string | null;
  status: "pending" | "active" | "completed" | "at_risk" | "breached";
  escalations: SlaEscalation[];
}

interface SlaTracker {
  requestId: string;
  buyerEmail: string;
  currentStage: string;
  stages: SlaStage[];
  status: "on_track" | "at_risk" | "breached" | "completed";
  createdAt: string;
  completedAt: string | null;
}

const SLA_DEFINITIONS: Array<{ key: SlaStage["key"]; slaHours: number }> = [
  { key: "scoping", slaHours: 24 },
  { key: "packaging", slaHours: 48 },
  { key: "delivery", slaHours: 72 },
  { key: "review_setup", slaHours: 24 },
];

export async function createSlaTracker(params: {
  requestId: string;
  buyerEmail: string;
}): Promise<void> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(COLLECTION).doc(params.requestId);
  const existing = await ref.get();
  if (existing.exists) return;

  const now = new Date();
  const stages: SlaStage[] = SLA_DEFINITIONS.map((def, index) => ({
    key: def.key,
    slaHours: def.slaHours,
    startedAt: index === 0 ? now.toISOString() : null,
    deadline: index === 0 ? new Date(now.getTime() + def.slaHours * 3600000).toISOString() : null,
    completedAt: null,
    status: index === 0 ? "active" : "pending",
    escalations: [],
  }));

  await ref.set({
    requestId: params.requestId,
    buyerEmail: params.buyerEmail,
    currentStage: "scoping",
    stages,
    status: "on_track",
    createdAt: now.toISOString(),
    completedAt: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function advanceSlaStage(requestId: string): Promise<void> {
  if (!db) throw new Error("Database not available");

  const ref = db.collection(COLLECTION).doc(requestId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`SLA tracker not found: ${requestId}`);

  const data = doc.data() as SlaTracker;
  const currentIndex = data.stages.findIndex((s) => s.status === "active" || s.status === "at_risk" || s.status === "breached");
  if (currentIndex === -1) return;

  const now = new Date();
  data.stages[currentIndex].status = "completed";
  data.stages[currentIndex].completedAt = now.toISOString();

  const nextIndex = currentIndex + 1;
  if (nextIndex < data.stages.length) {
    const nextStage = data.stages[nextIndex];
    nextStage.status = "active";
    nextStage.startedAt = now.toISOString();
    nextStage.deadline = new Date(now.getTime() + nextStage.slaHours * 3600000).toISOString();

    await ref.set({
      currentStage: nextStage.key,
      stages: data.stages,
      status: "on_track",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    await ref.set({
      currentStage: "completed",
      stages: data.stages,
      status: "completed",
      completedAt: now.toISOString(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

export async function runSlaWatchdog(
  params?: { limit?: number },
): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) throw new Error("Database not available");

  const limit = params?.limit || 50;
  let processedCount = 0;
  let failedCount = 0;

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "in", ["on_track", "at_risk"])
    .limit(limit)
    .get();

  const now = Date.now();

  for (const doc of snapshot.docs) {
    const data = doc.data() as SlaTracker;
    const activeStage = data.stages.find((s) => s.status === "active" || s.status === "at_risk");
    if (!activeStage || !activeStage.deadline) continue;

    const deadline = new Date(activeStage.deadline).getTime();
    const elapsed = now - new Date(activeStage.startedAt!).getTime();
    const slaMs = activeStage.slaHours * 3600000;
    const percentElapsed = elapsed / slaMs;

    try {
      if (percentElapsed >= 1.0 && activeStage.status !== "breached") {
        activeStage.status = "breached";
        const message = `SLA BREACH: ${activeStage.key} stage for ${data.requestId} exceeded ${activeStage.slaHours}h deadline.`;
        activeStage.escalations.push({
          type: "breach",
          channel: "ops_queue",
          sentAt: new Date().toISOString(),
          message,
        });

        await executeAction({
          lane: "support_triage",
          type: "queue_for_review",
          idempotencyKey: `sla:breach:${data.requestId}:${activeStage.key}`,
          recipientEmail: data.buyerEmail,
          subject: `SLA breach: ${activeStage.key} — ${data.requestId}`,
          body: message,
          metadata: { requestId: data.requestId, stage: activeStage.key, type: "sla_breach" },
        });

        await doc.ref.set({
          stages: data.stages,
          status: "breached",
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        processedCount++;
      } else if (percentElapsed >= 0.8 && activeStage.status === "active") {
        activeStage.status = "at_risk";
        const message = `SLA at risk: ${activeStage.key} stage for ${data.requestId} is at ${Math.round(percentElapsed * 100)}% of ${activeStage.slaHours}h deadline.`;
        activeStage.escalations.push({
          type: "warning",
          channel: "email",
          sentAt: new Date().toISOString(),
          message,
        });

        await doc.ref.set({
          stages: data.stages,
          status: "at_risk",
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        processedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { processedCount, failedCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/tests/sla-enforcement.test.ts`
Expected: PASS

- [ ] **Step 5: Wire SLA tracker creation into inbound-request.ts**

In `server/routes/inbound-request.ts`, after a contact request with `interest=evaluation-package` is created:

```typescript
import { createSlaTracker } from "../utils/sla-enforcement";

// After the contact request is saved to Firestore, add:
if (interest === "evaluation-package" || interest === "hosted-review") {
  createSlaTracker({
    requestId: docId,
    buyerEmail: email,
  }).catch((err) => {
    logger.error({ err, requestId: docId }, "Failed to create SLA tracker");
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run server/tests/sla-enforcement.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/utils/sla-enforcement.ts server/tests/sla-enforcement.test.ts server/routes/inbound-request.ts
git commit -m "feat: add SLA enforcement with watchdog, stage tracking, and escalation (Gap 10)"
```

---

## Workstream E: Integration

### Task 9: Notion Bidirectional Sync (Gap 9)

**Files:**
- Create: `server/utils/notion-sync.ts`
- Create: `server/tests/notion-sync.test.ts`

- [ ] **Step 1: Install Notion SDK**

Run: `npm install @notionhq/client`

- [ ] **Step 2: Write the failing tests**

Create `server/tests/notion-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chainable = {
    where: (...args: unknown[]) => { mockWhere(...args); return chainable; },
    orderBy: (...args: unknown[]) => { mockOrderBy(...args); return chainable; },
    limit: (n: number) => { mockLimit(n); return chainable; },
    get: mockGet,
  };
  return {
    default: {
      firestore: { FieldValue: { serverTimestamp: () => "TIMESTAMP" } },
    },
    dbAdmin: {
      collection: (name: string) => {
        mockCollection(name);
        return {
          ...chainable,
          doc: (id: string) => { mockDoc(id); return { get: mockGet, set: mockSet }; },
        };
      },
    },
  };
});

const mockNotionQuery = vi.fn();
const mockNotionCreate = vi.fn();
const mockNotionUpdate = vi.fn();

vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    databases: {
      query: mockNotionQuery,
    },
    pages: {
      create: mockNotionCreate,
      update: mockNotionUpdate,
    },
  })),
}));

const originalEnv = { ...process.env };

describe("notion-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockNotionCreate.mockResolvedValue({ id: "notion-page-123" });
    mockNotionUpdate.mockResolvedValue({ id: "notion-page-123" });
    process.env = {
      ...originalEnv,
      NOTION_API_KEY: "ntn_test",
      NOTION_CAMPAIGNS_DB_ID: "campaigns-db-id",
      NOTION_CREATIVE_RUNS_DB_ID: "creative-db-id",
      NOTION_GRADUATION_DB_ID: "graduation-db-id",
      NOTION_SLA_DB_ID: "sla-db-id",
      NOTION_TASKS_DB_ID: "tasks-db-id",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("syncFirestoreToNotion", () => {
    it("creates Notion pages for new Firestore records", async () => {
      mockGet.mockResolvedValue({
        docs: [{
          id: "campaign_1",
          data: () => ({
            name: "Test Campaign",
            status: "draft",
            channel: "sendgrid",
            created_at_iso: new Date().toISOString(),
          }),
        }],
      });
      mockNotionQuery.mockResolvedValue({ results: [] });

      const { syncFirestoreToNotion } = await import("../utils/notion-sync");
      const result = await syncFirestoreToNotion({ limit: 10 });

      expect(result.created).toBeGreaterThan(0);
      expect(mockNotionCreate).toHaveBeenCalled();
    });

    it("updates existing Notion pages for changed records", async () => {
      mockGet.mockResolvedValue({
        docs: [{
          id: "campaign_1",
          data: () => ({
            name: "Test Campaign",
            status: "sent",
            channel: "sendgrid",
            created_at_iso: new Date().toISOString(),
          }),
        }],
      });
      mockNotionQuery.mockResolvedValue({
        results: [{ id: "notion-page-existing", properties: { external_id: { rich_text: [{ plain_text: "campaign_1" }] } } }],
      });

      const { syncFirestoreToNotion } = await import("../utils/notion-sync");
      const result = await syncFirestoreToNotion({ limit: 10 });

      expect(result.updated).toBeGreaterThan(0);
      expect(mockNotionUpdate).toHaveBeenCalled();
    });
  });

  describe("syncNotionToFirestore", () => {
    it("updates Firestore with manual operator overrides from Notion", async () => {
      mockNotionQuery.mockResolvedValue({
        results: [{
          id: "notion-task-1",
          properties: {
            external_id: { rich_text: [{ plain_text: "ops_auto_123" }] },
            approved_by: { rich_text: [{ plain_text: "founder@tryblueprint.io" }] },
            priority_override: { select: { name: "high" } },
            notes: { rich_text: [{ plain_text: "Approved after review" }] },
          },
          last_edited_time: new Date().toISOString(),
        }],
      });

      const { syncNotionToFirestore } = await import("../utils/notion-sync");
      const result = await syncNotionToFirestore({ limit: 10 });

      expect(result.updated).toBeGreaterThan(0);
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe("runNotionBidirectionalSync", () => {
    it("returns combined counts from both directions", async () => {
      mockGet.mockResolvedValue({ docs: [] });
      mockNotionQuery.mockResolvedValue({ results: [] });

      const { runNotionBidirectionalSync } = await import("../utils/notion-sync");
      const result = await runNotionBidirectionalSync({ limit: 10 });

      expect(result.processedCount).toBeDefined();
      expect(result.failedCount).toBeDefined();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/tests/notion-sync.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement notion-sync.ts**

Create `server/utils/notion-sync.ts`:

```typescript
import { Client } from "@notionhq/client";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue } from "../config/env";

function getNotionClient(): Client | null {
  const apiKey = getConfiguredEnvValue("NOTION_API_KEY");
  if (!apiKey) return null;
  return new Client({ auth: apiKey });
}

function richText(value: string) {
  return { rich_text: [{ text: { content: value } }] };
}

function titleProp(value: string) {
  return { title: [{ text: { content: value } }] };
}

function selectProp(value: string) {
  return { select: { name: value } };
}

function extractRichText(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const rt = (prop as { rich_text?: Array<{ plain_text?: string }> }).rich_text;
  return rt?.[0]?.plain_text || "";
}

function extractSelect(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  return (prop as { select?: { name?: string } }).select?.name || "";
}

interface SyncResult {
  created: number;
  updated: number;
  errors: number;
}

export async function syncFirestoreToNotion(
  params?: { limit?: number },
): Promise<SyncResult> {
  const notion = getNotionClient();
  if (!notion || !db) return { created: 0, updated: 0, errors: 0 };

  const limit = params?.limit || 50;
  let created = 0;
  let updated = 0;
  let errors = 0;

  const syncConfigs = [
    {
      firestoreCollection: "growthCampaigns",
      notionDbEnv: "NOTION_CAMPAIGNS_DB_ID",
      mapToProperties: (id: string, data: Record<string, unknown>) => ({
        Name: titleProp(String(data.name || id)),
        external_id: richText(id),
        status: selectProp(String(data.status || "draft")),
        channel: richText(String(data.channel || "")),
        created_at: richText(String(data.created_at_iso || "")),
      }),
    },
    {
      firestoreCollection: "creative_factory_runs",
      notionDbEnv: "NOTION_CREATIVE_RUNS_DB_ID",
      mapToProperties: (id: string, data: Record<string, unknown>) => ({
        Name: titleProp(String(data.sku_name || id)),
        external_id: richText(id),
        status: selectProp(String(data.status || "unknown")),
        created_at: richText(String(data.created_at_iso || "")),
        storage_uri: richText(String(data.remotion_reel && typeof data.remotion_reel === "object" ? (data.remotion_reel as Record<string, unknown>).storage_uri || "" : "")),
      }),
    },
    {
      firestoreCollection: "agent_graduation_status",
      notionDbEnv: "NOTION_GRADUATION_DB_ID",
      mapToProperties: (id: string, data: Record<string, unknown>) => ({
        Name: titleProp(String(data.lane || id)),
        external_id: richText(id),
        phase: richText(String(data.currentPhase || "1")),
        accuracy: richText(String(data.metrics && typeof data.metrics === "object" ? (data.metrics as Record<string, unknown>).accuracy || "0" : "0")),
        recommendation: selectProp(String(data.recommendation || "hold")),
      }),
    },
    {
      firestoreCollection: "sla_tracking",
      notionDbEnv: "NOTION_SLA_DB_ID",
      mapToProperties: (id: string, data: Record<string, unknown>) => ({
        Name: titleProp(String(data.requestId || id)),
        external_id: richText(id),
        stage: selectProp(String(data.currentStage || "scoping")),
        status: selectProp(String(data.status || "on_track")),
        buyer_email: richText(String(data.buyerEmail || "")),
      }),
    },
  ];

  for (const config of syncConfigs) {
    const dbId = getConfiguredEnvValue(config.notionDbEnv);
    if (!dbId) continue;

    try {
      const snapshot = await db.collection(config.firestoreCollection).limit(limit).get();

      for (const doc of snapshot.docs) {
        try {
          const data = doc.data() as Record<string, unknown>;
          const properties = config.mapToProperties(doc.id, data);

          const existing = await notion.databases.query({
            database_id: dbId,
            filter: {
              property: "external_id",
              rich_text: { equals: doc.id },
            },
            page_size: 1,
          });

          if (existing.results.length > 0) {
            await notion.pages.update({
              page_id: existing.results[0].id,
              properties,
            });
            updated++;
          } else {
            await notion.pages.create({
              parent: { database_id: dbId },
              properties,
            });
            created++;
          }
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
  }

  return { created, updated, errors };
}

export async function syncNotionToFirestore(
  params?: { limit?: number },
): Promise<SyncResult> {
  const notion = getNotionClient();
  if (!notion || !db) return { created: 0, updated: 0, errors: 0 };

  const limit = params?.limit || 50;
  let updated = 0;
  let errors = 0;

  const tasksDbId = getConfiguredEnvValue("NOTION_TASKS_DB_ID");
  if (!tasksDbId) return { created: 0, updated: 0, errors: 0 };

  try {
    const response = await notion.databases.query({
      database_id: tasksDbId,
      page_size: limit,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });

    for (const page of response.results) {
      try {
        const props = (page as { properties: Record<string, unknown> }).properties;
        const externalId = extractRichText(props.external_id);
        if (!externalId) continue;

        const approvedBy = extractRichText(props.approved_by);
        const priorityOverride = extractSelect(props.priority_override);
        const notes = extractRichText(props.notes);

        if (!approvedBy && !priorityOverride && !notes) continue;

        const updateData: Record<string, unknown> = {
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (approvedBy) updateData.notion_approved_by = approvedBy;
        if (priorityOverride) updateData.notion_priority_override = priorityOverride;
        if (notes) updateData.notion_notes = notes;

        await db.collection("ops_automation").doc(externalId).set(updateData, { merge: true });
        updated++;
      } catch {
        errors++;
      }
    }
  } catch {
    errors++;
  }

  return { created: 0, updated, errors };
}

export async function runNotionBidirectionalSync(
  params?: { limit?: number },
): Promise<{ processedCount: number; failedCount: number }> {
  const limit = params?.limit || 50;

  const toNotion = await syncFirestoreToNotion({ limit });
  const toFirestore = await syncNotionToFirestore({ limit });

  return {
    processedCount: toNotion.created + toNotion.updated + toFirestore.updated,
    failedCount: toNotion.errors + toFirestore.errors,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/tests/notion-sync.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/notion-sync.ts server/tests/notion-sync.test.ts
git commit -m "feat: add Notion bidirectional sync for campaigns, creative runs, graduation, and SLA (Gap 9)"
```

---

## Final Verification

### Task 10: Full Suite Verification

- [ ] **Step 1: Run all new tests together**

Run: `npx vitest run server/tests/automation-lane-enablement.test.ts server/tests/agent-graduation.test.ts server/tests/openai-creative.test.ts server/tests/buyer-onboarding.test.ts server/tests/renewal-tracking.test.ts server/tests/sla-enforcement.test.ts server/tests/notion-sync.test.ts`
Expected: All PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm run test:coverage`
Expected: No regressions in existing tests

- [ ] **Step 3: Run build check**

Run: `npm run check && npm run build`
Expected: No type errors, clean build

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any test or build issues from gap closure implementation"
```
