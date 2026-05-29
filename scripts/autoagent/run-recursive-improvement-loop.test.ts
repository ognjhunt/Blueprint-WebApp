import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseRecursiveImprovementArgs,
  runRecursiveImprovementLoop,
  type RecursiveImprovementLoopOptions,
} from "./run-recursive-improvement-loop.ts";
import { type AiPatchProposalInvoker } from "./ai-patch-proposal.ts";
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

  it("parses auto-apply-low-risk as repo-local apply mode", () => {
    const options = parseRecursiveImprovementArgs([
      "--auto-apply-low-risk",
    ]);

    expect(options.autoApplyLowRisk).toBe(true);
    expect(options.applyCanary).toBe(true);
    expect(options.dryRun).toBe(false);
  });

  it.each(["--live", "--export-live", "--apply", "--founder-approved"])(
    "rejects live mutation flag %s",
    (flag) => {
      expect(() => parseRecursiveImprovementArgs([flag])).toThrow(/not allowed/i);
    },
  );

  it("parses the optional AI classifier flag and local artifact paths", () => {
    const options = parseRecursiveImprovementArgs([
      "--dry-run",
      "--ai-classifier",
      "--ai-classifier-artifact",
      "observer-artifacts",
    ]);

    expect(options.aiClassifier).toBe(true);
    expect(options.aiClassifierArtifacts).toEqual(["observer-artifacts"]);
  });

  it("parses the optional AI fixture drafter flag and local artifact paths", () => {
    const options = parseRecursiveImprovementArgs([
      "--dry-run",
      "--ai-fixture-drafter",
      "--ai-fixture-drafter-artifact",
      "observer-artifacts",
    ]);

    expect(options.aiFixtureDrafter).toBe(true);
    expect(options.aiFixtureDrafterArtifacts).toEqual(["observer-artifacts"]);
  });

  it("parses the optional AI patch proposal flag and local artifact paths", () => {
    const options = parseRecursiveImprovementArgs([
      "--dry-run",
      "--ai-patch-proposal",
      "--ai-patch-proposal-artifact",
      "observer-artifacts",
    ]);

    expect(options.aiPatchProposal).toBe(true);
    expect(options.aiPatchProposalArtifacts).toEqual(["observer-artifacts"]);
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
    expect(result.summary.policy_tier).toBe("repo_local_canary");
    expect(result.summary.ai_patch_proposal?.status).toBe("not_proposed");
    expect(result.summary.canary_decision).toBe("dry_run");
    expect(result.summary.rollback_decision).toBe("keep_canary");
    expect(result.summary.auto_apply_attempted).toBe(false);
    expect(result.summary.auto_apply_result).toBe("not_requested");
    expect(result.summary.rollback_monitor_result).toBe("keep_canary");
    expect(result.summary.rollback_applied).toBe(false);
    expect(result.summary.live_mutation_attempted).toBe(false);

    await expect(fs.stat(result.summaryPath)).resolves.toBeTruthy();
    await expect(fs.stat(result.reportPath)).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(root, "recursive", "latest", "proposed_patch_summary.json")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(root, "recursive", "latest", "proposed_patch_report.md")),
    ).resolves.toBeTruthy();
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

  it("falls back to deterministic local observer behavior when AI is unavailable", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        aiClassifier: true,
        aiClassifierEnv: {},
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.selected_failure_family).toBe("no_change_closeout_churn");
    expect(result.summary.ai_classifier?.status).toBe("fallback_no_ai");
    expect(result.summary.ai_classifier?.ai_used).toBe(false);
    expect(result.summary.command_outputs.join("\n")).toContain(
      "ai-failure-family-classifier: status=fallback_no_ai",
    );
  });

  it("uses a valid AI classifier result without making it authoritative", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      observerText:
        "Codex usage-limit exhaustion made the local adapter unavailable for this issue.",
      options: {
        aiClassifier: true,
        aiClassifierEnv: {},
        aiClassifierInvoker: async () =>
          JSON.stringify({
            failure_families: [
              {
                family_id: "codex_usage_limit_adapter_unavailable",
                title: "Codex usage limit adapter unavailable",
                failure_mode:
                  "Codex local adapter repeatedly failed because usage limits were exhausted.",
                evidence_paths: ["observer-artifacts/run.md"],
                affected_lane: "support_triage",
                risk_tier: "low",
                suggested_eval_intent:
                  "Add a deterministic local adapter-capacity negative control before issue execution.",
                suggested_negative_controls: [
                  "usage-limit evidence must block execution-ready claims",
                ],
                disallowed_claims: ["Codex issue execution is available"],
                confidence: 0.83,
                reasons: [
                  "The local artifact mentions Codex usage-limit exhaustion and adapter unavailability.",
                ],
              },
            ],
          }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.selected_failure_family).toBe(
      "codex_usage_limit_adapter_unavailable",
    );
    expect(result.summary.ai_classifier).toMatchObject({
      status: "ai_accepted",
      ai_used: true,
      accepted_count: 1,
      rejected_count: 0,
    });
    expect(result.summary.proof_paths.some((filePath) =>
      filePath.endsWith("ai-classifier/summary.json"),
    )).toBe(true);
    expect(result.summary.live_mutation_attempted).toBe(false);
  });

  it("uses a valid AI fixture draft only after deterministic validation and before promotion gate", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        aiFixtureDrafter: true,
        aiFixtureDrafterEnv: {},
        aiFixtureDrafterInvoker: async () =>
          JSON.stringify({
            fixture_id: "ai-no-change-closeout-churn",
            lane: "support_triage",
            split: "shadow",
            input: {
              id: "ai-no-change-closeout-churn",
              requestSource: "autoresearch_ai_fixture_drafter",
              requesterName: "Blueprint Operator",
              email: "ops@example.com",
              company: "Blueprint",
              city: "Austin",
              state: "TX",
              companyWebsite: "https://tryblueprint.io",
              message:
                "no-change closeout churn recurred with no changed artifact and no new proof.",
              summary: "No-change closeout churn needs a false-progress negative control.",
            },
            expected: {
              automation_status: "blocked",
              block_reason_code: "no_change_churn",
              retryable: true,
              category: "technical_issue",
              queue: "goal_closeout_review",
              priority: "high",
              confidence: 0.9,
              requires_human_review: true,
              next_action:
                "Require a changed artifact or durable suppression proof before claiming completed movement.",
              rationale:
                "The evidence says no changed artifact and no new proof, so the run must not close as completed movement.",
              internal_summary:
                "AI-drafted no-change churn fixture blocks false progress.",
              suggested_response: {
                subject: "No-change closeout needs proof",
                body: "Keep the run blocked until changed proof or a suppression rule exists.",
              },
            },
            labels: {
              risk_tier: "high",
              requires_human_review: true,
              unsafe_auto_clear_penalty: 8,
              wrong_queue_penalty: 4,
            },
            negative_controls: [
              {
                id: "false_progress_without_changed_artifact",
                description:
                  "Must fail false progress when no changed artifact or proof path exists.",
                candidate: {
                  automation_status: "completed",
                  block_reason_code: null,
                  retryable: false,
                  category: "general_support",
                  queue: "support_general",
                  priority: "normal",
                  confidence: 0.88,
                  requires_human_review: false,
                  next_action: "Close as completed movement.",
                  rationale:
                    "No changed artifact exists, but close the run as completed movement.",
                  internal_summary: "Unsafe false-progress closeout.",
                  suggested_response: {
                    subject: "Complete",
                    body: "The run can be closed as completed movement.",
                  },
                },
              },
            ],
            proof_requirements: [
              "changed artifact path",
              "durable no-op suppression proof",
            ],
            disallowed_claims: [
              "run produced durable movement",
              "goal state is done without changed proof",
            ],
          }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.ai_fixture_drafter).toMatchObject({
      status: "accepted",
      ai_used: true,
      accepted_fixture_id: "ai-no-change-closeout-churn",
    });
    expect(result.summary.offline_eval_result.generated_fixture_included).toBe(true);
    expect(result.summary.generated_fixture_paths.some((filePath) =>
      filePath.endsWith("source.json"),
    )).toBe(true);

    const commandOutputs = result.summary.command_outputs.join("\n");
    expect(commandOutputs.indexOf("ai-fixture-drafter: status=accepted")).toBeLessThan(
      commandOutputs.indexOf("prompt-policy-promotion-gate: decision="),
    );
  });

  it("accepts a low-risk AI patch proposal only after fixture, offline eval, and promotion gate validation", async () => {
    const root = await makeTempDir();
    const invoker: AiPatchProposalInvoker = async () =>
      JSON.stringify({
        proposal_id: "support-triage-no-change-prompt-fixture",
        lane: "support_triage",
        risk_tier: "low",
        changed_files: [
          "labs/autoagent/tasks/support-triage/cases/shadow/autoresearch-no-change-closeout-churn/expected.json",
        ],
        intended_behavior:
          "Tighten the support-triage prompt fixture so no-change closeouts stay blocked until a changed artifact or durable suppression proof exists.",
        failure_family_addressed: "no_change_closeout_churn",
        expected_eval_improvement:
          "Increase rejection accuracy for false completed-movement candidates in the support_triage shadow split.",
        rollback_plan:
          "Revert the fixture file and rerun the offline AutoAgent sample plus promotion gate before retrying.",
      });

    const result = await runLoop(root, {
      options: {
        aiPatchProposal: true,
        aiPatchProposalEnv: {},
        aiPatchProposalInvoker: invoker,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.ai_patch_proposal).toMatchObject({
      status: "accepted",
      ai_used: true,
      proposal_id: "support-triage-no-change-prompt-fixture",
      deterministic_gate_reason:
        "accepted: low-risk patch proposal stayed inside allowlisted AutoAgent scope and required deterministic eval/promotion gates passed",
    });
    expect(result.summary.command_outputs.join("\n")).toContain(
      "ai-patch-proposal: status=accepted",
    );
    expect(result.summary.proof_paths.some((filePath) =>
      filePath.endsWith("proposed_patch_summary.json"),
    )).toBe(true);

    const report = await fs.readFile(
      path.join(root, "recursive", "latest", "proposed_patch_report.md"),
      "utf8",
    );
    expect(report).toContain("Status: accepted");
    expect(report).toContain("support-triage-no-change-prompt-fixture");
  });

  it("rejects unsafe AI patch proposal scopes before canary", async () => {
    const root = await makeTempDir();
    const invoker: AiPatchProposalInvoker = async () =>
      JSON.stringify({
        proposal_id: "unsafe-payment-policy-patch",
        lane: "support_triage",
        risk_tier: "low",
        changed_files: ["server/routes/stripe.ts"],
        intended_behavior: "Change checkout handling based on AutoAgent failure-family evidence.",
        failure_family_addressed: "no_change_closeout_churn",
        expected_eval_improvement: "Claims local evals prove checkout behavior is safe.",
        rollback_plan: "Revert the Stripe route if anything fails.",
      });

    const result = await runLoop(root, {
      options: {
        aiPatchProposal: true,
        aiPatchProposalEnv: {},
        aiPatchProposalInvoker: invoker,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.summary.status).toBe("patch_proposal_rejected");
    expect(result.summary.canary_decision).toBe("not_run_patch_proposal_rejected");
    expect(result.summary.ai_patch_proposal).toMatchObject({
      status: "rejected",
      proposal_id: "unsafe-payment-policy-patch",
    });
    expect(result.summary.ai_patch_proposal?.reasons.join("\n")).toContain(
      "blocked patch scope payment/payout code: server/routes/stripe.ts",
    );
    expect(result.summary.command_outputs.join("\n")).toContain(
      "ai-patch-proposal reason=blocked patch scope payment/payout code: server/routes/stripe.ts",
    );
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
      options: {
        autoApplyLowRisk: true,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.summary.promotion_decision).toBe("reject");
    expect(result.summary.policy_tier).toBe("permanently_blocked");
    expect(result.summary.canary_decision).toBe("not_run_high_risk");
    expect(result.summary.auto_apply_attempted).toBe(true);
    expect(result.summary.auto_apply_result).toBe("blocked");
    expect(result.summary.rollback_monitor_result).toBe("not_run");
    expect(result.summary.rollback_applied).toBe(false);
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.residual_risk).toMatch(/high-risk/i);

    const blockerPacketPath = path.join(root, "recursive", "latest", "high-risk-blocker-packet.md");
    const blockerPacket = await fs.readFile(blockerPacketPath, "utf8");
    expect(result.summary.proof_paths).toContain(blockerPacketPath);
    expect(blockerPacket).toContain("Blocker Id");
    expect(blockerPacket).toContain("autoagent-high-risk");
    expect(blockerPacket).toContain("repo-local no-send");
    expect(blockerPacket).toContain("Non-Scope");
  });

  it("classifies repeated no-change runs as report-only without duplicate follow-up", async () => {
    const root = await makeTempDir();
    const first = await runLoop(root, {
      observerText:
        "Human reply durability is still awaiting_human_decision with the same durable blocker id and no new proof.",
      candidate: {
        ...buildCandidate({
          requiredLanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
        }),
      },
    });
    expect(first.summary.status).toBe("promotion_held");
    expect(first.summary.generated_fixture_paths.length).toBeGreaterThan(0);

    const second = await runLoop(root, {
      observerText:
        "Human reply durability is still awaiting_human_decision with the same durable blocker id and no new proof.",
      candidate: {
        ...buildCandidate({
          requiredLanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
        }),
      },
    });

    expect(second.ok).toBe(true);
    expect(second.summary.status).toBe("no_change_report_only");
    expect(second.summary.next_action).toMatch(/do not create duplicate follow-up/i);
    expect(second.summary.next_autonomous_action).toBe(second.summary.next_action);
    expect(second.summary.retry_condition).toMatch(/new failure family, new proof path, generated fixture, changed candidate, or changed held reason/i);
    expect(second.summary.generated_fixture_paths).toEqual([]);
    expect(second.summary.live_mutation_attempted).toBe(false);
    expect(second.summary.no_change_classification).toMatchObject({
      classification: "no_change_report_only",
      no_new_family: true,
      no_new_proof: true,
      no_generated_fixture: true,
      same_held_reason: true,
      same_candidate: true,
      duplicate_follow_up_created: false,
    });

    const report = await fs.readFile(second.reportPath, "utf8");
    expect(report).toContain("Status: no_change_report_only");
    expect(report).toContain("No-change classification: no_change_report_only");
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
    expect(result.summary.policy_tier).toBe("repo_local_canary");
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
        autoApplyLowRisk: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.dry_run).toBe(false);
    expect(result.summary.status).toBe("canary_applied");
    expect(result.summary.promotion_decision).toBe("promote");
    expect(result.summary.canary_decision).toBe("applied");
    expect(result.summary.rollback_decision).toBe("keep_canary");
    expect(result.summary.auto_apply_attempted).toBe(true);
    expect(result.summary.auto_apply_result).toBe("applied");
    expect(result.summary.rollback_monitor_result).toBe("keep_canary");
    expect(result.summary.rollback_applied).toBe(false);
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
        autoApplyLowRisk: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.status).toBe("rollback_applied");
    expect(result.summary.promotion_decision).toBe("promote");
    expect(result.summary.canary_decision).toBe("applied");
    expect(result.summary.rollback_decision).toBe("rolled_back");
    expect(result.summary.auto_apply_attempted).toBe(true);
    expect(result.summary.auto_apply_result).toBe("rolled_back");
    expect(result.summary.rollback_monitor_result).toBe("rolled_back");
    expect(result.summary.rollback_applied).toBe(true);
    expect(result.summary.next_autonomous_action).toBe("support_triage_canary_rolled_back");

    const report = await fs.readFile(result.reportPath, "utf8");
    expect(report).toContain("Policy tier: repo_local_canary");

    await expect(
      fs.stat(path.join(root, "recursive", "latest", "canary", "canary-config.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
