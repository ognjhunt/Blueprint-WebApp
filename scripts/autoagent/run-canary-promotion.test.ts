import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findLiveSideEffectValidationCommands,
  formatCanaryPromotionConsoleLines,
  parseCanaryPromotionArgs,
  runCanaryPromotion,
  validateCanaryPlanForApply,
  type CanaryPromotionPlan,
} from "./run-canary-promotion.ts";
import { type PromptPolicyPromotionCandidate } from "./prompt-policy-promotion-gate.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-canary-promotion-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function buildCandidate(
  overrides: Partial<PromptPolicyPromotionCandidate> = {},
): PromptPolicyPromotionCandidate {
  return {
    candidateId: "support-triage-canary-candidate",
    title: "Support triage canary candidate",
    source: "autoagent",
    targetRuntime: "paperclip_hermes",
    changeType: "prompt_policy_orchestration",
    requiredLanes: ["support_triage"],
    changedPaths: [
      "server/agents/tasks/support-triage.ts",
      "ops/paperclip/blueprint-company/.paperclip.yaml",
    ],
    rollbackCondition:
      "Rollback if support_triage canary output diverges from the primary decision fields, drops human review, or attempts live side effects.",
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
        "Build the low-risk AutoAgent-to-Paperclip/Hermes canary promotion controller.",
      issueRunId: "local-canary-test",
      budgetTimeoutContext: "vitest local test; no live Paperclip budget supplied",
      stageReached: "repo-local canary promotion test",
      stateClaimed: "done",
      owner: "webapp-codex",
      blockerDecisionId: "none",
      proofPaths: [
        "scripts/autoagent/run-canary-promotion.ts",
        "scripts/autoagent/run-canary-promotion.test.ts",
      ],
      commandOutputs: [
        "npm exec -- vitest run scripts/autoagent/run-canary-promotion.test.ts",
      ],
      nextAction: "Use dry-run canary plan before writing repo-local active canary artifacts.",
      retryResumeCondition:
        "Retry only after offline evals, shadow proof, rollback metadata, and side-effect checks pass.",
      residualRisk: "No live Paperclip/Hermes mutation is covered by this repo-local plan.",
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

async function writeCandidate(root: string, candidate: unknown) {
  const candidatePath = path.join(root, "candidate.json");
  await fs.writeFile(candidatePath, JSON.stringify(candidate, null, 2), "utf8");
  return candidatePath;
}

async function writePaperclipConfig(root: string) {
  const paperclipConfig = path.join(root, ".paperclip.yaml");
  await fs.writeFile(
    paperclipConfig,
    [
      "schema: paperclip/v1",
      "company:",
      "  requireBoardApprovalForNewAgents: true",
      "agents: {}",
      "",
    ].join("\n"),
    "utf8",
  );
  return paperclipConfig;
}

async function runWithCandidate(root: string, candidate: unknown, applyCanary = false) {
  const candidatePath = await writeCandidate(root, candidate);
  const paperclipConfigPath = await writePaperclipConfig(root);
  return runCanaryPromotion({
    candidatePath,
    fixtureRoot: path.join(root, "fixtures"),
    harborRoot: path.join(root, "harbor"),
    gatePacketOutput: path.join(root, "promotion-packet.md"),
    outputDir: path.join(root, "canary"),
    paperclipConfigPath,
    gateSampleCount: 3,
    canarySampleCount: 20,
    applyCanary,
    requestedMode: applyCanary ? "apply" : "dry_run",
  });
}

describe("AutoAgent canary promotion controller", () => {
  it("creates a machine-readable dry-run canary plan", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildCandidate());

    expect(result.ok).toBe(true);
    expect(result.plan.status).toBe("dry_run");
    expect(result.plan.canary.lane).toBe("support_triage");
    expect(result.plan.canary.behavior).toBe("observation_only");
    expect(result.plan.canary.primaryOutputAuthority).toBe("primary_result_only");
    expect(result.plan.canary.canaryAuthority).toBe("compare_only_never_act");
    expect(result.plan.validationErrors).toEqual([]);

    const planJson = JSON.parse(await fs.readFile(result.planJsonPath, "utf8"));
    expect(planJson.schema).toBe("blueprint/autoagent-canary-promotion-plan/v1");
    expect(planJson.status).toBe("dry_run");
    expect(planJson.rollback.command).toContain("autoagent:canary-rollback");
    expect(planJson.rollback.command).toContain("--apply-rollback");
    expect(planJson.proofPaths).toContain(result.planJsonPath);

    const planMarkdown = await fs.readFile(result.planMarkdownPath, "utf8");
    expect(planMarkdown).toContain("Primary output authority: primary_result_only");
    await expect(fs.stat(result.activeConfigPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("formats the exact dry-run mutation plan for CLI output", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildCandidate());

    const lines = formatCanaryPromotionConsoleLines(result);

    expect(lines).toContain(
      `[autoagent-canary-promotion] status=dry_run plan=${result.planJsonPath} markdown=${result.planMarkdownPath}`,
    );
    expect(lines).toContain(
      `[autoagent-canary-promotion] mutation=1 write_rollback_snapshot -> ${result.rollbackSnapshotPath} (repo_local_artifact)`,
    );
    expect(lines.join("\n")).toContain("write_canary_plan_json");
    expect(lines.join("\n")).not.toContain("write_active_canary_config");
  });

  it("rejects candidates when the promotion gate holds", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildCandidate({ shadowSummary: null }));

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.gate.decision).toBe("hold");
    expect(result.plan.validationErrors.join("\n")).toContain(
      "promotion gate decision must be canary; saw hold",
    );
  });

  it("rejects non-support or high-risk lanes", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, {
      ...buildCandidate(),
      requiredLanes: ["payments"],
      riskDomains: ["payments"],
    });

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.candidate.declaredLanes).toEqual(["payments"]);
    expect(result.plan.validationErrors.join("\n")).toContain(
      "initial canary supports support_triage only",
    );
  });

  it("rejects missing rollback metadata", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(
      root,
      buildCandidate({ rollbackCondition: "" }),
    );

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.validationErrors.join("\n")).toMatch(/rollback/i);
  });

  it("rejects live side-effect validation commands", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(
      root,
      buildCandidate({
        closeoutProof: {
          ...buildCandidate().closeoutProof!,
          commandOutputs: [
            "npm run gtm:send -- --write --dry-run 0",
          ],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.validationErrors.join("\n")).toContain(
      "live side-effect validation command is not allowed",
    );
    expect(
      findLiveSideEffectValidationCommands(["npm run gtm:send -- --write --dry-run 0"]),
    ).toHaveLength(1);
  });

  it("rejects live launch smoke validation commands", async () => {
    const findings = findLiveSideEffectValidationCommands([
      "npm run smoke:launch -- --base-url https://blueprint.example",
    ]);

    expect(findings).toEqual([
      {
        command: "npm run smoke:launch -- --base-url https://blueprint.example",
        label: "live launch smoke",
      },
    ]);
  });

  it("requires the explicit apply flag for apply mode", async () => {
    const parsed = parseCanaryPromotionArgs(["--mode", "apply"]);

    await expect(
      runCanaryPromotion({
        ...parsed,
        candidatePath: "/tmp/missing-candidate.json",
        writeArtifacts: false,
      }),
    ).rejects.toThrow(/--apply-canary/);
  });

  it("requires a rollback snapshot before apply", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildCandidate());
    const brokenPlan: CanaryPromotionPlan = {
      ...result.plan,
      status: "applied",
      mode: "apply",
      rollback: {
        ...result.plan.rollback,
        previousConfigSnapshot: null,
      },
    };

    expect(validateCanaryPlanForApply(brokenPlan)).toContain(
      "rollback previousConfigSnapshot is required before apply",
    );
  });

  it("refuses apply when the promotion gate has not returned promote", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildCandidate(), true);

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.gate.decision).toBe("canary");
    expect(result.plan.validationErrors.join("\n")).toContain(
      "promotion gate decision must be promote before apply; saw canary",
    );
    await expect(fs.stat(result.activeConfigPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("applies only repo-local canary artifacts when explicitly requested", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(root, buildPromoteCandidate(), true);

    expect(result.ok).toBe(true);
    expect(result.plan.status).toBe("applied");
    expect(result.plan.mutationPlan.every((item) => item.sideEffectClass === "repo_local_artifact")).toBe(true);
    expect(result.plan.gate.decision).toBe("promote");
    expect(result.plan.policy.decision).toBe("promote");
    expect(result.plan.policy.policyTiers).toEqual({
      support_triage: "repo_local_canary",
    });
    expect(result.plan.canary.scopeCap).toEqual({
      maxSampleCount: 50,
      maxPercentage: 5,
    });

    const snapshot = JSON.parse(await fs.readFile(result.rollbackSnapshotPath, "utf8"));
    expect(snapshot.livePaperclipConfigMutation).toBe(false);
    expect(snapshot.paperclipConfig.exists).toBe(true);

    const activeConfig = JSON.parse(await fs.readFile(result.activeConfigPath, "utf8"));
    expect(activeConfig.status).toBe("active");
    expect(activeConfig.primaryOutputAuthority).toBe("primary_result_only");
    expect(activeConfig.canaryAuthority).toBe("compare_only_never_act");
    expect(activeConfig.scopeCap).toEqual({
      maxSampleCount: 50,
      maxPercentage: 5,
    });
  });

  it("rejects high-risk lane apply attempts even when the candidate asks for promote", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(
      root,
      {
        ...buildPromoteCandidate(),
        requiredLanes: ["payments"],
        riskDomains: ["payments"],
      },
      true,
    );

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.validationErrors.join("\n")).toContain(
      "initial canary supports support_triage only",
    );
    await expect(fs.stat(result.activeConfigPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects waitlist lane apply attempts because the first auto lane is support_triage only", async () => {
    const root = await makeTempDir();
    const result = await runWithCandidate(
      root,
      {
        ...buildPromoteCandidate(),
        requiredLanes: ["waitlist_triage"],
      },
      true,
    );

    expect(result.ok).toBe(false);
    expect(result.plan.status).toBe("rejected");
    expect(result.plan.validationErrors.join("\n")).toContain(
      "initial canary supports support_triage only",
    );
    await expect(fs.stat(result.activeConfigPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
