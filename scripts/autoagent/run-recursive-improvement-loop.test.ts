import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseRecursiveImprovementArgs,
  runRecursiveImprovementLoop,
  type RecursiveImprovementLoopOptions,
} from "./run-recursive-improvement-loop.ts";
import { type PromptPolicyPromotionCandidate } from "./prompt-policy-promotion-gate.ts";
import { type ShadowSourceRecord } from "./monitor-canary-rollback.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-recursive-improve-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeObserverArtifact(root: string, text: string) {
  const observerRoot = path.join(root, "observer-artifacts");
  await fs.mkdir(observerRoot, { recursive: true });
  await fs.writeFile(path.join(observerRoot, "run.md"), `${text}\n`, "utf8");
  return observerRoot;
}

function buildCandidate(
  overrides: Partial<PromptPolicyPromotionCandidate> = {},
): PromptPolicyPromotionCandidate {
  return {
    candidateId: "support-triage-recursive-loop-candidate",
    title: "Support triage recursive loop candidate",
    source: "autoagent",
    targetRuntime: "paperclip_hermes",
    changeType: "prompt_policy_orchestration",
    requiredLanes: ["support_triage"],
    changedPaths: [
      "scripts/autoagent/run-recursive-improvement-loop.ts",
      "scripts/autoagent/run-recursive-improvement-loop.test.ts",
    ],
    rollbackCondition:
      "Rollback if support_triage canary output diverges from primary decision fields, drops human review, or any negative control passes.",
    claims: [],
    liveSideEffects: [],
    shadowSummary: {
      lane: "support_triage",
      sampleCount: 25,
      cleanSampleCount: 25,
      regressionCount: 0,
      safetyBlockers: [],
      mismatchedDecisionFields: [],
      noRegressionWindowDays: 14,
    },
    closeoutProof: {
      goalObjective:
        "Build the end-to-end recursive AutoResearch runner for near-zero-human agent improvement.",
      issueRunId: "local-recursive-loop-test",
      budgetTimeoutContext: "vitest local test; no live Paperclip budget supplied",
      stageReached: "repo-local recursive loop test",
      stateClaimed: "done",
      owner: "webapp-codex",
      blockerDecisionId: "none",
      proofPaths: [
        "scripts/autoagent/run-recursive-improvement-loop.ts",
        "scripts/autoagent/run-recursive-improvement-loop.test.ts",
      ],
      commandOutputs: [
        "npm exec -- vitest run scripts/autoagent/run-recursive-improvement-loop.test.ts",
      ],
      nextAction:
        "Use the dry-run recursive loop report before any manual promotion review.",
      retryResumeCondition:
        "Retry after offline evals, canary plan, rollback monitor, and side-effect checks pass.",
      residualRisk:
        "This is repo-local dry-run evidence only; live Paperclip/Hermes mutation is outside scope.",
    },
    ...overrides,
  };
}

function buildPromoteCandidate(
  overrides: Partial<PromptPolicyPromotionCandidate> = {},
): PromptPolicyPromotionCandidate {
  return buildCandidate({
    requestedDecision: "promote",
    shadowSummary: {
      ...buildCandidate().shadowSummary!,
      canaryCompleted: true,
      canaryRegressionCount: 0,
    },
    ...overrides,
  });
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
    },
    comparison: {
      schema: "blueprint/autoagent-shadow-comparison/v1",
      lane: "support_triage",
      shadow_mode: "observation_only",
      live_action_authority: "primary_result_only",
      mismatched_fields: [],
      safety_blockers: [],
    },
    ...overrides,
  };
}

async function writeCandidate(root: string, candidate: unknown) {
  const candidatePath = path.join(root, "candidate.json");
  await writeJson(candidatePath, candidate);
  return candidatePath;
}

async function writeShadowSummary(root: string, records: ShadowSourceRecord[]) {
  const shadowPath = path.join(root, "shadow-summary.json");
  await writeJson(shadowPath, { records });
  return shadowPath;
}

async function writePaperclipConfig(root: string) {
  const paperclipConfigPath = path.join(root, ".paperclip.yaml");
  await fs.writeFile(
    paperclipConfigPath,
    ["schema: paperclip/v1", "company:", "  requireBoardApprovalForNewAgents: true", ""].join("\n"),
    "utf8",
  );
  return paperclipConfigPath;
}

async function runLoop(
  root: string,
  params: {
    observerText?: string;
    candidate?: unknown;
    shadowRecords?: ShadowSourceRecord[];
    options?: Partial<RecursiveImprovementLoopOptions>;
  } = {},
) {
  const observerRoot = await writeObserverArtifact(
    root,
    params.observerText
      ?? "This no-change closeout does not show completed movement because there is no changed artifact and no new proof.",
  );
  const candidatePath = await writeCandidate(root, params.candidate ?? buildCandidate());
  const shadowSourcePath = params.shadowRecords
    ? await writeShadowSummary(root, params.shadowRecords)
    : await writeShadowSummary(root, [cleanShadowRecord()]);
  const paperclipConfigPath = await writePaperclipConfig(root);

  return runRecursiveImprovementLoop({
    cwd: root,
    observerInputRoots: [observerRoot],
    candidatePath,
    shadowSourcePath,
    paperclipConfigPath,
    fixtureRoot: path.join(root, "tasks"),
    harborRoot: path.join(root, "harbor"),
    outputDir: path.join(root, "recursive", "latest"),
    sampleCount: 3,
    now: new Date("2026-05-29T16:00:00.000Z"),
    ...params.options,
  });
}

describe("recursive AutoResearch improvement loop", () => {
  it("parses the support_triage lane selector for apply-canary", () => {
    const options = parseRecursiveImprovementArgs([
      "--apply-canary",
      "--lane",
      "support_triage",
    ]);

    expect(options.applyCanary).toBe(true);
    expect(options.dryRun).toBe(false);
    expect(options.lane).toBe("support_triage");
  });

  it("runs the full repo-local dry-run loop from fixture observer input", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root);

    expect(result.ok).toBe(true);
    expect(result.summary.selected_failure_family).toBe("no_change_closeout_churn");
    expect(result.summary.generated_fixture_paths.length).toBeGreaterThan(0);
    expect(result.summary.offline_eval_result.status).toBe("passed");
    expect(result.summary.negative_controls_blocked).toBe(true);
    expect(result.summary.promotion_decision).toBe("canary");
    expect(result.summary.canary_decision).toBe("dry_run");
    expect(result.summary.rollback_decision).toBe("keep_canary");
    expect(result.summary.live_mutation_attempted).toBe(false);

    await expect(fs.stat(result.summaryPath)).resolves.toBeTruthy();
    await expect(fs.stat(result.reportPath)).resolves.toBeTruthy();
  });

  it("does not write live or active canary mutation artifacts by default", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root);

    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.canary_decision).toBe("dry_run");
    await expect(
      fs.stat(path.join(root, "recursive", "latest", "canary", "canary-config.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stops high-risk candidates before canary", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      candidate: {
        ...buildCandidate(),
        requiredLanes: ["payments"],
        riskDomains: ["payments"],
        liveSideEffects: ["payment"],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.summary.promotion_decision).toBe("reject");
    expect(result.summary.canary_decision).toBe("not_run_high_risk");
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.residual_risk).toMatch(/high-risk/i);
  });

  it("stops with insufficient_evidence when no observer candidate is available", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      observerText: "A clean local artifact with no classified recursive failure family.",
    });

    expect(result.ok).toBe(false);
    expect(result.summary.selected_failure_family).toBeNull();
    expect(result.summary.offline_eval_result.status).toBe("not_run");
    expect(result.summary.promotion_decision).toBe("not_run");
    expect(result.summary.next_autonomous_action).toBe("collect_local_observer_evidence");
    expect(result.summary.retry_condition).toMatch(/observer evidence/i);
  });

  it("includes generated fixtures in the offline eval path", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root);

    expect(result.summary.offline_eval_result.fixture_root).toBe(path.join(root, "tasks"));
    expect(result.summary.offline_eval_result.generated_fixture_included).toBe(true);
    expect(result.summary.generated_fixture_paths.some((filePath) => filePath.endsWith("source.json"))).toBe(true);
    for (const filePath of result.summary.generated_fixture_paths) {
      await expect(fs.stat(filePath)).resolves.toBeTruthy();
    }
  });

  it("stops canary when the promotion gate rejects", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      candidate: {
        ...buildCandidate({
          claims: [
            {
              claimType: "hosted_session_proof",
              targetClaimType: "operational_launch_readiness",
              description: "Public demo copy proves hosted-session fulfillment.",
            },
          ],
        }),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.summary.promotion_decision).toBe("reject");
    expect(result.summary.canary_decision).toBe("not_run_promotion_reject");
    expect(result.summary.rollback_decision).toBe("not_run");
  });

  it("prevents promotion when rollback monitor requires rollback", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      shadowRecords: [
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

    expect(result.ok).toBe(false);
    expect(result.summary.promotion_decision).toBe("canary");
    expect(result.summary.canary_decision).toBe("dry_run");
    expect(result.summary.rollback_decision).toBe("rollback_required");
    expect(result.summary.next_autonomous_action).toBe("rollback_required_before_promotion");
  });

  it("auto-applies the support_triage canary when the gate promotes", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      candidate: buildPromoteCandidate(),
      options: {
        applyCanary: true,
        lane: "support_triage",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.dry_run).toBe(false);
    expect(result.summary.status).toBe("canary_applied");
    expect(result.summary.promotion_decision).toBe("promote");
    expect(result.summary.canary_decision).toBe("applied");
    expect(result.summary.rollback_decision).toBe("keep_canary");
    expect(result.summary.live_mutation_attempted).toBe(false);

    const activeConfigPath = path.join(root, "recursive", "latest", "canary", "canary-config.json");
    const rollbackSnapshotPath = path.join(root, "recursive", "latest", "canary", "rollback-snapshot.json");
    const activeConfig = JSON.parse(await fs.readFile(activeConfigPath, "utf8"));
    expect(activeConfig.lane).toBe("support_triage");
    expect(activeConfig.primaryOutputAuthority).toBe("primary_result_only");
    expect(activeConfig.canaryAuthority).toBe("compare_only_never_act");
    await expect(fs.stat(rollbackSnapshotPath)).resolves.toBeTruthy();
  });

  it("automatically rolls back an applied support_triage canary when the monitor trips", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      candidate: buildPromoteCandidate(),
      shadowRecords: [
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
      options: {
        applyCanary: true,
        lane: "support_triage",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.status).toBe("rollback_applied");
    expect(result.summary.promotion_decision).toBe("promote");
    expect(result.summary.canary_decision).toBe("applied");
    expect(result.summary.rollback_decision).toBe("rolled_back");
    expect(result.summary.next_autonomous_action).toBe("support_triage_canary_rolled_back");

    await expect(
      fs.stat(path.join(root, "recursive", "latest", "canary", "canary-config.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
