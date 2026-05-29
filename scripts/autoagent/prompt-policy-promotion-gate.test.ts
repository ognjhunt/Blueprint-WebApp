import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type LocalEvalSummary } from "./local-evaluator.ts";
import {
  evaluateAutoPromotionEligibility,
  type AutoAgentPromotionCandidate,
  type AutoAgentOfflineEvalSummary,
  type AutoAgentShadowSummary,
} from "../../server/agents/autoagent-promotion-policy.ts";
import {
  evaluatePromotionGate,
  runPromptPolicyPromotionGate,
  validatePromotionCandidate,
  type PromptPolicyPromotionCandidate,
} from "./prompt-policy-promotion-gate.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-prompt-policy-gate-"));
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
    candidateId: "autoagent-to-paperclip-hermes-test",
    title: "AutoAgent prompt-policy gate test candidate",
    source: "autoagent",
    targetRuntime: "paperclip_hermes",
    changeType: "prompt_policy_orchestration",
    requiredLanes: ["support_triage"],
    changedPaths: [
      "scripts/autoagent/prompt-policy-promotion-gate.ts",
      "scripts/autoagent/prompt-policy-promotion-gate.test.ts",
    ],
    rollbackCondition:
      "Revert the promoted prompt, policy, or orchestration diff if offline evals fail, a negative control passes, or closeout proof drops required fields.",
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
        "Build the prompt-policy promotion gate from AutoAgent to Paperclip/Hermes.",
      issueRunId: "local-test-run",
      budgetTimeoutContext: "vitest local test; no live Paperclip budget supplied",
      stageReached: "repo-local promotion gate test",
      stateClaimed: "done",
      owner: "webapp-codex",
      blockerDecisionId: "none",
      proofPaths: [
        "scripts/autoagent/prompt-policy-promotion-gate.ts",
        "scripts/autoagent/prompt-policy-promotion-gate.test.ts",
      ],
      commandOutputs: [
        "npm exec -- vitest run scripts/autoagent/prompt-policy-promotion-gate.test.ts",
      ],
      nextAction: "Use the generated packet for manual Paperclip/Hermes promotion review.",
      retryResumeCondition:
        "Retry after restoring passing offline evals, blocked negative controls, and required closeout labels.",
      residualRisk: "Live Paperclip sync is intentionally outside this gate.",
    },
    ...overrides,
  };
}

async function writeCandidate(root: string, candidate: unknown) {
  const candidatePath = path.join(root, "candidate.json");
  await fs.writeFile(candidatePath, JSON.stringify(candidate, null, 2), "utf8");
  return candidatePath;
}

describe("prompt-policy promotion gate", () => {
  it("canaries only when offline evals, negative controls, clean shadow proof, and closeout proof pass", async () => {
    const root = await makeTempDir();
    const candidatePath = await writeCandidate(root, buildCandidate());
    const fixtureRoot = path.join(root, "fixtures");
    const harborRoot = path.join(root, "harbor");
    const packetOutput = path.join(root, "packet.md");

    const result = await runPromptPolicyPromotionGate({
      candidatePath,
      fixtureRoot,
      harborRoot,
      packetOutput,
      sampleCount: 3,
      writePacket: true,
    });

    expect(result.evaluation.decision).toBe("canary");
    expect(result.evaluation.checks.offlineEvalPassed).toBe(true);
    expect(result.evaluation.checks.negativeControlsBlocked).toBe(true);
    expect(result.evaluation.checks.closeoutProofPresent).toBe(true);
    expect(result.evaluation.checks.shadowEvidencePassed).toBe(true);
    expect(result.evaluation.checks.livePaperclipMutationAttempted).toBe(false);

    const packet = await fs.readFile(packetOutput, "utf8");
    expect(packet).toContain("Decision: canary");
    expect(packet).toContain("negative_controls_remain_blocked: true");
    expect(packet).toContain("shadow_evidence_passed: true");
    expect(packet).toContain("Live Paperclip mutation: not attempted");
    expect(packet).toContain("Rollback Condition");
  });

  it("holds when closeout proof is missing even if offline evals pass", async () => {
    const root = await makeTempDir();
    const candidatePath = await writeCandidate(root, {
      ...buildCandidate(),
      closeoutProof: null,
    });
    const fixtureRoot = path.join(root, "fixtures");
    const harborRoot = path.join(root, "harbor");
    const packetOutput = path.join(root, "packet.md");

    const result = await runPromptPolicyPromotionGate({
      candidatePath,
      fixtureRoot,
      harborRoot,
      packetOutput,
      sampleCount: 3,
      writePacket: true,
    });

    expect(result.evaluation.decision).toBe("hold");
    expect(result.evaluation.checks.offlineEvalPassed).toBe(true);
    expect(result.evaluation.checks.negativeControlsBlocked).toBe(true);
    expect(result.evaluation.checks.closeoutProofPresent).toBe(false);

    const packet = await fs.readFile(packetOutput, "utf8");
    expect(packet).toContain("Decision: hold");
    expect(packet).toContain("closeoutProof must be present and must be an object");
  });

  it("rejects when a negative control is not blocked", () => {
    const candidateValidation = validatePromotionCandidate(buildCandidate());
    const summary: LocalEvalSummary = {
      fixtureRoot: "/tmp/fixtures",
      lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
      totalCases: 3,
      totalPassed: 3,
      totalFailed: 0,
      totalNegativeControls: 3,
      totalNegativeControlsBlocked: 2,
      samples: [],
      laneSummaries: {
        waitlist_triage: {
          lane: "waitlist_triage",
          totalCases: 1,
          passed: 1,
          failed: 0,
          minReward: 1,
          averageReward: 1,
          negativeControls: 1,
          negativeControlsBlocked: 1,
          splits: { dev: 1, holdout: 0, shadow: 0 },
          negativeControlFailures: [],
          failures: [],
        },
        support_triage: {
          lane: "support_triage",
          totalCases: 1,
          passed: 1,
          failed: 0,
          minReward: 1,
          averageReward: 1,
          negativeControls: 1,
          negativeControlsBlocked: 0,
          splits: { dev: 1, holdout: 0, shadow: 0 },
          negativeControlFailures: [],
          failures: [],
        },
        preview_diagnosis: {
          lane: "preview_diagnosis",
          totalCases: 1,
          passed: 1,
          failed: 0,
          minReward: 1,
          averageReward: 1,
          negativeControls: 1,
          negativeControlsBlocked: 1,
          splits: { dev: 1, holdout: 0, shadow: 0 },
          negativeControlFailures: [],
          failures: [],
        },
      },
    };

    const evaluation = evaluatePromotionGate({
      candidateValidation,
      localEval: summary,
    });

    expect(evaluation.decision).toBe("reject");
    expect(evaluation.reasons).toContain("negative controls are not fully blocked: 2/3");
  });
});

const passingOfflineEval: AutoAgentOfflineEvalSummary = {
  totalCases: 12,
  totalFailed: 0,
  totalNegativeControls: 6,
  totalNegativeControlsBlocked: 6,
  laneSummaries: {
    support_triage: {
      totalCases: 12,
      failed: 0,
      averageReward: 0.96,
      negativeControls: 6,
      negativeControlsBlocked: 6,
      shadowSamples: 4,
    },
  },
};

const cleanSupportShadow: AutoAgentShadowSummary = {
  lane: "support_triage",
  sampleCount: 25,
  cleanSampleCount: 25,
  regressionCount: 0,
  safetyBlockers: [],
  mismatchedDecisionFields: [],
  noRegressionWindowDays: 14,
};

function centralCandidate(
  overrides: Partial<AutoAgentPromotionCandidate> = {},
): AutoAgentPromotionCandidate {
  return {
    candidateId: "support-policy-candidate",
    changeType: "prompt_policy_orchestration",
    lanes: ["support_triage"],
    changedPaths: ["server/agents/tasks/support-triage.ts"],
    rollbackCondition:
      "Revert the support_triage prompt policy if the canary increases regressions, drops human-review safeguards, or fails negative controls.",
    claims: [],
    liveSideEffects: [],
    ...overrides,
  };
}

describe("central AutoAgent promotion policy", () => {
  it("lets support_triage enter canary only when offline evals pass and shadow comparison is clean", () => {
    const eligible = evaluateAutoPromotionEligibility(
      centralCandidate(),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(eligible.decision).toBe("canary");
    expect(eligible.blockedClaims).toEqual([]);
    expect(eligible.rollbackCondition).toContain("Revert the support_triage prompt policy");

    const dirtyShadow = evaluateAutoPromotionEligibility(
      centralCandidate(),
      passingOfflineEval,
      {
        ...cleanSupportShadow,
        regressionCount: 1,
        safetyBlockers: ["shadow_drops_human_review"],
      },
    );

    expect(dirtyShadow.decision).toBe("hold");
    expect(dirtyShadow.requiredNextEvidence.join("\n")).toMatch(/clean shadow/i);
  });

  it("promotes support_triage to canary apply when explicitly requested and evidence is clean", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({ requestedDecision: "promote" }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("promote");
    expect(result.checks.offlineEvalPassed).toBe(true);
    expect(result.checks.negativeControlsBlocked).toBe(true);
    expect(result.checks.shadowEvidencePassed).toBe(true);
    expect(result.blockedClaims).toEqual([]);
  });

  it("rejects hosted-session proof drift instead of auto-promoting it", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        claims: [
          {
            claimType: "hosted_session_proof",
            targetClaimType: "operational_launch_readiness",
            description: "Public demo copy proves hosted-session fulfillment.",
          },
        ],
      }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("reject");
    expect(result.blockedClaims).toContain("hosted_session_proof");
  });

  it("rejects public-copy proof drift into operational proof", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        claims: [
          {
            claimType: "public_copy",
            targetClaimType: "operational_launch_readiness",
            description: "Polished public copy is being treated as operational launch proof.",
          },
        ],
      }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("reject");
    expect(result.blockedClaims).toContain("public_copy_to_operational_proof");
  });

  it("rejects live-send, payment, provider, rights, city, and customer-claim candidates", () => {
    for (const sideEffect of [
      "live_send",
      "payment",
      "provider_execution",
      "rights_privacy_legal",
      "city_live_claim",
      "customer_claim",
    ] as const) {
      const result = evaluateAutoPromotionEligibility(
        centralCandidate({
          liveSideEffects: [sideEffect],
        }),
        passingOfflineEval,
        cleanSupportShadow,
      );

      expect(result.decision).toBe("reject");
      expect(result.blockedClaims).toContain(sideEffect);
    }
  });

  it("holds otherwise eligible candidates when rollback conditions are missing", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({ rollbackCondition: "" }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("hold");
    expect(result.requiredNextEvidence.join("\n")).toMatch(/rollback condition/i);
  });
});
