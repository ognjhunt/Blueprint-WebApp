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
  AUTOAGENT_PRODUCTION_ACTION_REGISTRY,
  evaluateAutoAgentProductionAction,
  type AutoAgentProductionActionRequest,
} from "../../server/agents/autoagent-production-action-registry.ts";
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

const passingWaitlistOfflineEval: AutoAgentOfflineEvalSummary = {
  totalCases: 12,
  totalFailed: 0,
  totalNegativeControls: 6,
  totalNegativeControlsBlocked: 6,
  laneSummaries: {
    waitlist_triage: {
      totalCases: 12,
      failed: 0,
      averageReward: 0.97,
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

const cleanWaitlistShadow: AutoAgentShadowSummary = {
  lane: "waitlist_triage",
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
    expect(eligible.policyTiers.support_triage).toBe("repo_local_canary");
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
    expect(result.policyTiers.support_triage).toBe("repo_local_canary");
    expect(result.checks.offlineEvalPassed).toBe(true);
    expect(result.checks.negativeControlsBlocked).toBe(true);
    expect(result.checks.shadowEvidencePassed).toBe(true);
    expect(result.blockedClaims).toEqual([]);
  });

  it("holds support_triage when the clean shadow summary is missing", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate(),
      passingOfflineEval,
      null,
    );

    expect(result.decision).toBe("hold");
    expect(result.checks.shadowEvidencePassed).toBe(false);
    expect(result.checks.noRegressionWindowPassed).toBe(false);
    expect(result.reasons).toContain("clean shadow comparison summary is missing");
  });

  it.each([
    {
      name: "wrong lane",
      shadow: cleanWaitlistShadow,
      reason: /shadow comparison is for waitlist_triage, not support_triage/,
    },
    {
      name: "sample count below threshold",
      shadow: { ...cleanSupportShadow, sampleCount: 19, cleanSampleCount: 19 },
      reason: /shadow sample count 19 is below 20/,
    },
    {
      name: "regression count above zero",
      shadow: { ...cleanSupportShadow, regressionCount: 1 },
      reason: /shadow comparison has regressions: 1/,
    },
    {
      name: "safety blocker present",
      shadow: { ...cleanSupportShadow, safetyBlockers: ["shadow_drops_human_review"] },
      reason: /shadow safety blockers: shadow_drops_human_review/,
    },
    {
      name: "mismatched decision fields present",
      shadow: { ...cleanSupportShadow, mismatchedDecisionFields: ["queue"] },
      reason: /shadow decision fields mismatch: queue/,
    },
    {
      name: "no-regression window below threshold",
      shadow: { ...cleanSupportShadow, noRegressionWindowDays: 13 },
      reason: /no-regression window 13d is below 14d/,
    },
  ])("holds support_triage when shadow evidence has $name", ({ shadow, reason }) => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({ requestedDecision: "promote" }),
      passingOfflineEval,
      shadow,
    );

    expect(result.decision).toBe("hold");
    expect(result.reasons.join("\n")).toMatch(reason);
  });

  it("keeps waitlist triage human/policy gated even with clean local evidence", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        lanes: ["waitlist_triage"],
        changedPaths: ["server/agents/tasks/waitlist-triage.ts"],
        requestedDecision: "promote",
      }),
      passingWaitlistOfflineEval,
      cleanWaitlistShadow,
    );

    expect(result.decision).toBe("hold");
    expect(result.policyTiers.waitlist_triage).toBe("human_policy_gated");
    expect(result.requiredNextEvidence.join("\n")).toMatch(/explicit policy change/i);
  });

  it("keeps preview diagnosis shadow-only without hosted-session and provider/runtime proof", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        lanes: ["preview_diagnosis"],
        changedPaths: ["server/agents/tasks/preview-diagnosis.ts"],
        requestedDecision: "promote",
      }),
      {
        totalCases: 12,
        totalFailed: 0,
        totalNegativeControls: 6,
        totalNegativeControlsBlocked: 6,
        laneSummaries: {
          preview_diagnosis: {
            totalCases: 12,
            failed: 0,
            averageReward: 0.98,
            negativeControls: 6,
            negativeControlsBlocked: 6,
            shadowSamples: 4,
          },
        },
      },
      null,
    );

    expect(result.decision).toBe("hold");
    expect(result.policyTiers.preview_diagnosis).toBe("shadow_only");
    expect(result.requiredNextEvidence.join("\n")).toMatch(/hosted-session proof/i);
  });

  it("rejects hosted-session proof drift instead of auto-promoting it", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        lanes: ["hosted_session_fulfillment"],
        riskDomains: ["hosted_session_fulfillment"],
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
    expect(result.policyTiers.hosted_session_fulfillment).toBe("permanently_blocked");
    expect(result.blockedClaims).toContain("hosted_session_proof");
    expect(result.blockedClaims).toContain("hosted_session_fulfillment");
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

  it("rejects operational launch readiness without owner-system proof", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        lanes: ["operational_launch_readiness"],
        riskDomains: ["operational_launch_readiness"],
        claims: [
          {
            claimType: "operational_launch_readiness",
            description:
              "Local eval and polished public copy are being treated as launch readiness.",
          },
        ],
      }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("reject");
    expect(result.policyTiers.operational_launch_readiness).toBe("permanently_blocked");
    expect(result.blockedClaims).toContain("operational_launch_readiness");
    expect(result.requiredNextEvidence.join("\n")).toMatch(/source-system proof/i);
  });

  it("rejects AI-generated claims as policy proof overrides", () => {
    const result = evaluateAutoPromotionEligibility(
      centralCandidate({
        claims: [
          {
            claimType: "public_copy",
            targetClaimType: "operational_launch_readiness",
            evidenceSource: "ai_generated",
            description:
              "AI-generated summary says the polished public page proves operational launch readiness.",
          },
        ],
      }),
      passingOfflineEval,
      cleanSupportShadow,
    );

    expect(result.decision).toBe("reject");
    expect(result.blockedClaims).toContain("ai_generated_claim_to_policy");
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

describe("AutoAgent production action registry", () => {
  async function productionActionFixture(
    overrides: Partial<AutoAgentProductionActionRequest> = {},
  ): Promise<{
    request: AutoAgentProductionActionRequest;
    proofPath: string;
    rollbackPath: string;
  }> {
    const root = await makeTempDir();
    const proofPath = path.join(root, "proof.json");
    const rollbackPath = path.join(root, "rollback.json");
    await fs.writeFile(
      proofPath,
      `${JSON.stringify({ source: "paperclip_hermes", status: "verified" }, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(
      rollbackPath,
      `${JSON.stringify({ restore: "previous_metadata_snapshot" }, null, 2)}\n`,
      "utf8",
    );

    const request: AutoAgentProductionActionRequest = {
      actionType: "paperclip_hermes_internal_metadata_update",
      ownerSystem: "paperclip_hermes",
      targetRecordId: "recursive-agent-improvement-loop",
      targetField: "metadata.autoagent.production_decision_loop",
      proofSource: "paperclip_issue_metadata_snapshot",
      proofPath,
      idempotencyKey: "paperclip-hermes-metadata:issue-123:policy-tier",
      rollbackStrategy: "restore_previous_metadata_snapshot",
      rollbackPath,
      dryRun: true,
      canaryMode: true,
      canaryLimit: {
        maxActions: 1,
        window: "per_run",
      },
      liveMutationEnabled: false,
      auditEvent: {
        schema: "blueprint/autoagent-production-action-audit/v1",
        actionType: "paperclip_hermes_internal_metadata_update",
        actionTier: "internal_metadata_update",
        ownerSystem: "paperclip_hermes",
        targetRecordId: "recursive-agent-improvement-loop",
        targetField: "metadata.autoagent.production_decision_loop",
        idempotencyKey: "paperclip-hermes-metadata:issue-123:policy-tier",
        proofPath,
        rollbackPath,
        dryRun: true,
        canaryMode: true,
        liveMutationEnabled: false,
      },
      ...overrides,
    };

    return { request, proofPath, rollbackPath };
  }

  it("rejects unregistered live actions", async () => {
    const { request } = await productionActionFixture({
      actionType: "unregistered_live_mutation",
      auditEvent: {
        schema: "blueprint/autoagent-production-action-audit/v1",
        actionType: "unregistered_live_mutation",
        actionTier: "internal_metadata_update",
        ownerSystem: "paperclip_hermes",
        targetRecordId: "recursive-agent-improvement-loop",
        targetField: "metadata.autoagent.production_decision_loop",
        idempotencyKey: "paperclip-hermes-metadata:issue-123:policy-tier",
        proofPath: "unused",
        rollbackPath: "unused",
        dryRun: true,
        canaryMode: true,
        liveMutationEnabled: false,
      },
    });

    const result = evaluateAutoAgentProductionAction(request);

    expect(result.decision).toBe("reject");
    expect(result.reasons.join("\n")).toMatch(/unregistered production action/i);
  });

  it("rejects an allowed action when proof is missing", async () => {
    const { request } = await productionActionFixture({
      proofPath: "/tmp/blueprint-missing-production-proof.json",
    });

    const result = evaluateAutoAgentProductionAction(request);

    expect(result.decision).toBe("reject");
    expect(result.checks.proofPathExists).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/proof path/i);
  });

  it("rejects an allowed action when rollback is missing", async () => {
    const { request } = await productionActionFixture({
      rollbackPath: "/tmp/blueprint-missing-production-rollback.json",
    });

    const result = evaluateAutoAgentProductionAction(request);

    expect(result.decision).toBe("reject");
    expect(result.checks.rollbackPathExists).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/rollback path/i);
  });

  it("rejects duplicate idempotency keys", async () => {
    const { request } = await productionActionFixture();

    const result = evaluateAutoAgentProductionAction(request, {
      usedIdempotencyKeys: new Set([request.idempotencyKey]),
    });

    expect(result.decision).toBe("reject");
    expect(result.checks.idempotencyKeyIsUnique).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/duplicate idempotency key/i);
  });

  it("keeps external sends, payments, providers, and hosted sessions blocked", async () => {
    const blockedActionTypes = [
      "external_send",
      "payment_or_entitlement",
      "provider_execution",
      "hosted_session_fulfillment",
    ] as const;

    for (const actionType of blockedActionTypes) {
      const entry = AUTOAGENT_PRODUCTION_ACTION_REGISTRY[actionType];
      const fixture = await productionActionFixture();
      const request: AutoAgentProductionActionRequest = {
        ...fixture.request,
        actionType,
        ownerSystem: entry.ownerSystem,
        targetField: entry.allowedTargetFields[0] ?? "metadata.autoagent.production_decision_loop",
        proofSource: entry.proofSource,
        idempotencyKey: `${actionType}:blocked-test`,
        liveMutationEnabled: true,
        dryRun: false,
        auditEvent: {
          schema: "blueprint/autoagent-production-action-audit/v1",
          actionType,
          actionTier: entry.actionTier,
          ownerSystem: entry.ownerSystem,
          targetRecordId: "recursive-agent-improvement-loop",
          targetField: entry.allowedTargetFields[0] ?? "metadata.autoagent.production_decision_loop",
          idempotencyKey: `${actionType}:blocked-test`,
          proofPath: fixture.proofPath,
          rollbackPath: fixture.rollbackPath,
          dryRun: false,
          canaryMode: true,
          liveMutationEnabled: true,
        },
      };

      const result = evaluateAutoAgentProductionAction(request);

      expect(result.decision).toBe("reject");
      expect(result.actionEntry?.liveMutationAllowed).toBe(false);
      expect(result.blockedActionTypes).toContain(actionType);
    }
  });

  it("allows the Paperclip/Hermes internal metadata action in dry-run mode", async () => {
    const { request } = await productionActionFixture();

    const result = evaluateAutoAgentProductionAction(request);

    expect(result.decision).toBe("dry_run_allowed");
    expect(result.actionEntry?.actionTier).toBe("internal_metadata_update");
    expect(result.actionEntry?.liveMutationAllowed).toBe(true);
    expect(result.checks).toMatchObject({
      ownerSystemNamed: true,
      proofPathExists: true,
      idempotencyKeyPresent: true,
      idempotencyKeyIsUnique: true,
      rollbackPathExists: true,
      canaryLimitPresent: true,
      auditEventSchemaPresent: true,
      liveMutationFlagExplicit: true,
    });
  });
});
