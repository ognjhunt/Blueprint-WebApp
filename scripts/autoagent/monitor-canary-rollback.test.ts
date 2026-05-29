import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  monitorCanaryRollback,
  type CanaryRollbackPlan,
  type ShadowSourceRecord,
} from "./monitor-canary-rollback.ts";
import { type AutoAgentOfflineEvalSummary } from "../../server/agents/autoagent-promotion-policy.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-canary-rollback-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function cleanOfflineEval(
  overrides: Partial<AutoAgentOfflineEvalSummary> = {},
): AutoAgentOfflineEvalSummary {
  return {
    totalCases: 12,
    totalFailed: 0,
    totalNegativeControls: 4,
    totalNegativeControlsBlocked: 4,
    laneSummaries: {
      support_triage: {
        totalCases: 12,
        failed: 0,
        averageReward: 0.97,
        negativeControls: 4,
        negativeControlsBlocked: 4,
      },
    },
    ...overrides,
  };
}

function canaryPlan(
  root: string,
  overrides: Partial<CanaryRollbackPlan> = {},
): CanaryRollbackPlan {
  const activeConfigPath = path.join(root, "canary-config.json");
  const snapshotPath = path.join(root, "rollback-snapshot.json");
  return {
    schema: "blueprint/autoagent-canary-promotion-plan/v1",
    generatedAt: "2026-05-29T14:00:00.000Z",
    status: "applied",
    mode: "apply",
    candidate: {
      id: "support-triage-canary-candidate",
      title: "Support triage canary candidate",
      manifestPath: path.join(root, "candidate.json"),
      changedPaths: ["server/agents/tasks/support-triage.ts"],
      declaredLanes: ["support_triage"],
    },
    gate: {
      decision: "canary",
      checks: {},
      reasons: [],
      packetPath: path.join(root, "promotion-packet.md"),
    },
    policy: {
      decision: "canary",
      riskTiers: { support_triage: "low" },
      checks: {},
      reasons: [],
      blockedClaims: [],
      requiredNextEvidence: [],
      rollbackTriggers: [
        "Any support_triage negative control passes.",
        "Shadow or canary output drops a human-review safeguard.",
      ],
    },
    canary: {
      lane: "support_triage",
      behavior: "observation_only",
      canaryAuthority: "compare_only_never_act",
      primaryOutputAuthority: "primary_result_only",
      canaryOutputStorage: "ops_automation.shadow_runs.autoagent",
      sampleCount: 20,
      percentage: 5,
      stopCondition: [
        "Any support_triage negative control passes.",
        "Shadow or canary output drops a human-review safeguard.",
      ],
    },
    mutationPlan: [
      {
        order: 1,
        action: "write_rollback_snapshot",
        path: snapshotPath,
        sideEffectClass: "repo_local_artifact",
      },
    ],
    rollback: {
      previousConfigSnapshot: {
        capturedAt: "2026-05-29T14:00:00.000Z",
        livePaperclipConfigMutation: false,
        paperclipConfig: {
          path: path.join(root, ".paperclip.yaml"),
          exists: true,
          sha256: "sha",
          sizeBytes: 10,
        },
        existingRepoLocalCanaryConfig: {
          path: activeConfigPath,
          exists: true,
          sha256: "oldsha",
          sizeBytes: 20,
        },
        existingRepoLocalCanaryConfigValue: {
          schema: "blueprint/autoagent-active-canary/v1",
          candidateId: "previous-candidate",
          status: "active",
        },
        autoagentShadowEnv: {
          BLUEPRINT_AUTOAGENT_SHADOW_ENABLED: "1",
          BLUEPRINT_AUTOAGENT_SHADOW_LANES: "support_triage",
          BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER: "acp_harness",
          BLUEPRINT_AUTOAGENT_SHADOW_MODEL: null,
        },
      },
      snapshotPath,
      command:
        "npm run autoagent:canary-promotion -- --rollback support-triage-canary-candidate",
      condition: "Rollback if canary evidence regresses.",
      stopCondition: ["Any support_triage negative control passes."],
    },
    proofPaths: [path.join(root, "canary-plan.json")],
    safetyInvariants: [
      "No live Paperclip/Hermes config mutation is performed by this controller.",
    ],
    validationErrors: [],
    ...overrides,
  };
}

function cleanShadowRecord(
  overrides: Partial<ShadowSourceRecord> = {},
): ShadowSourceRecord {
  return {
    namespace: "autoagent",
    kind: "support_triage",
    status: "completed",
    provider: "acp_harness",
    output: {
      automation_status: "completed",
      requires_human_review: true,
      queue: "support_general",
      priority: "normal",
      category: "general_support",
    },
    primary: {
      status: "completed",
      requires_human_review: true,
      requires_approval: false,
    },
    comparison: {
      schema: "blueprint/autoagent-shadow-comparison/v1",
      lane: "support_triage",
      shadow_mode: "observation_only",
      live_action_authority: "primary_result_only",
      promotion_recommendation: "promote_candidate",
      promote: true,
      mismatched_fields: [],
      safety_blockers: [],
    },
    ...overrides,
  };
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writePlan(root: string, plan: CanaryRollbackPlan) {
  const planPath = path.join(root, "canary-plan.json");
  await writeJson(planPath, plan);
  return planPath;
}

async function writeShadowRecords(root: string, records: ShadowSourceRecord[]) {
  const shadowPath = path.join(root, "shadow-summary.json");
  await writeJson(shadowPath, { records });
  return shadowPath;
}

async function runMonitor(params: {
  root: string;
  plan?: CanaryRollbackPlan;
  records?: ShadowSourceRecord[];
  offlineEval?: AutoAgentOfflineEvalSummary;
  applyRollback?: boolean;
}) {
  const plan = params.plan ?? canaryPlan(params.root);
  const planPath = await writePlan(params.root, plan);
  const shadowSourcePath = params.records
    ? await writeShadowRecords(params.root, params.records)
    : undefined;

  return monitorCanaryRollback({
    canaryPlanPath: planPath,
    shadowSourcePath,
    outputDir: path.join(params.root, "decision"),
    offlineEvalSummary: params.offlineEval ?? cleanOfflineEval(),
    applyRollback: params.applyRollback === true,
    writeArtifacts: true,
    now: new Date("2026-05-29T15:00:00.000Z"),
  });
}

describe("AutoAgent canary rollback monitor", () => {
  it("requires rollback when a negative control passes", async () => {
    const root = await makeTempDir();
    const result = await runMonitor({
      root,
      records: [cleanShadowRecord()],
      offlineEval: cleanOfflineEval({
        totalNegativeControls: 4,
        totalNegativeControlsBlocked: 3,
      }),
    });

    expect(result.decision.status).toBe("rollback_required");
    expect(result.decision.reasons.join("\n")).toContain("negative control");
    expect(result.decision.triggeredRules).toContain("negative_control_passed");
  });

  it("requires rollback when shadow drops human review", async () => {
    const root = await makeTempDir();
    const result = await runMonitor({
      root,
      records: [
        cleanShadowRecord({
          output: {
            automation_status: "completed",
            requires_human_review: false,
          },
          comparison: {
            schema: "blueprint/autoagent-shadow-comparison/v1",
            lane: "support_triage",
            shadow_mode: "observation_only",
            live_action_authority: "primary_result_only",
            promotion_recommendation: "hold_candidate",
            promote: false,
            mismatched_fields: [
              {
                field: "requires_human_review",
                primary: true,
                shadow: false,
              },
            ],
            safety_blockers: ["shadow_drops_human_review"],
          },
        }),
      ],
    });

    expect(result.decision.status).toBe("rollback_required");
    expect(result.decision.triggeredRules).toContain("shadow_drops_human_review");
  });

  it("requires rollback when a blocked primary is autocleared", async () => {
    const root = await makeTempDir();
    const result = await runMonitor({
      root,
      records: [
        cleanShadowRecord({
          comparison: {
            schema: "blueprint/autoagent-shadow-comparison/v1",
            lane: "support_triage",
            shadow_mode: "observation_only",
            live_action_authority: "primary_result_only",
            promotion_recommendation: "hold_candidate",
            promote: false,
            mismatched_fields: [
              {
                field: "automation_status",
                primary: "blocked",
                shadow: "completed",
              },
            ],
            safety_blockers: ["shadow_autoclears_blocked_primary"],
          },
        }),
      ],
    });

    expect(result.decision.status).toBe("rollback_required");
    expect(result.decision.triggeredRules).toContain("shadow_autoclears_blocked_primary");
  });

  it("returns insufficient evidence when no shadow records exist", async () => {
    const root = await makeTempDir();
    const result = await runMonitor({ root });

    expect(result.decision.status).toBe("insufficient_evidence");
    expect(result.decision.reasons.join("\n")).toContain("No AutoAgent shadow records");
  });

  it("keeps canary when offline eval and shadow thresholds are clean", async () => {
    const root = await makeTempDir();
    const result = await runMonitor({
      root,
      records: [cleanShadowRecord()],
    });

    expect(result.decision.status).toBe("keep_canary");
    expect(result.decision.reasons).toContain(
      "Canary evidence is clean against rollback thresholds.",
    );
  });

  it("refuses apply rollback when the stored previous config snapshot is missing", async () => {
    const root = await makeTempDir();
    const plan = canaryPlan(root, {
      rollback: {
        ...canaryPlan(root).rollback,
        previousConfigSnapshot: null,
        snapshotPath: path.join(root, "missing-rollback-snapshot.json"),
      },
    });

    const result = await runMonitor({
      root,
      plan,
      records: [cleanShadowRecord()],
      offlineEval: cleanOfflineEval({
        totalNegativeControls: 4,
        totalNegativeControlsBlocked: 3,
      }),
      applyRollback: true,
    });

    expect(result.decision.status).toBe("rollback_required");
    expect(result.decision.reasons.join("\n")).toContain(
      "Rollback apply refused: stored previous config snapshot is missing",
    );
    expect(result.decision.commandOutputs.at(-1)).toMatchObject({ exitCode: 1 });
  });

  it("refuses apply rollback for high-risk live mutation", async () => {
    const root = await makeTempDir();
    const basePlan = canaryPlan(root);
    const result = await runMonitor({
      root,
      plan: canaryPlan(root, {
        canary: {
          ...basePlan.canary,
          lane: "payments",
        },
        mutationPlan: [
          {
            order: 1,
            action: "restore_live_paperclip_config",
            path: path.join(root, ".paperclip.yaml"),
            sideEffectClass: "live_paperclip_config",
          },
        ],
      }),
      records: [cleanShadowRecord()],
      offlineEval: cleanOfflineEval({
        totalNegativeControls: 4,
        totalNegativeControlsBlocked: 3,
      }),
      applyRollback: true,
    });

    expect(result.decision.status).toBe("rollback_required");
    expect(result.decision.reasons.join("\n")).toContain(
      "Rollback apply refused: high-risk or live mutation rollback is not allowed",
    );
    expect(result.decision.commandOutputs.at(-1)).toMatchObject({ exitCode: 1 });
  });

  it("rolls back only from a stored repo-local previous config snapshot", async () => {
    const root = await makeTempDir();
    const plan = canaryPlan(root);
    const activeConfigPath = plan.rollback.previousConfigSnapshot!.existingRepoLocalCanaryConfig.path;
    await writeJson(activeConfigPath, {
      schema: "blueprint/autoagent-active-canary/v1",
      candidateId: "support-triage-canary-candidate",
      status: "active",
    });

    const result = await runMonitor({
      root,
      plan,
      records: [cleanShadowRecord()],
      offlineEval: cleanOfflineEval({
        totalNegativeControls: 4,
        totalNegativeControlsBlocked: 3,
      }),
      applyRollback: true,
    });

    expect(result.decision.status).toBe("rolled_back");
    const restoredConfig = JSON.parse(await fs.readFile(activeConfigPath, "utf8"));
    expect(restoredConfig.candidateId).toBe("previous-candidate");
  });
});
