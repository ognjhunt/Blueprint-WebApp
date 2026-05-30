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
import { type AiProductionChangeProposalInvoker } from "./ai-production-change-proposer.ts";
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

async function writePaperclipFailureSweep(root: string, text: string) {
  const sweepPath = path.join(root, "paperclip-failure-sweep.json");
  await writeJson(sweepPath, {
    generatedAt: "2026-05-30T12:00:00.000Z",
    paperclipApiUrl: "https://paperclip.tryblueprint.io",
    paperclipApiUrlSource: "cli --live-host",
    companyId: "company-1",
    inspectedRuns: 25,
    candidateRuns: 2,
    suppressedRecoveredRuns: 0,
    clusters: [
      {
        signature: {
          key: "paperclip_fake_progress_without_artifact",
          title: "Fake progress closeout",
          category: "agent_logic",
          fixLayer: "goal closeout contract",
          matchedBy: "test sweep",
        },
        count: 2,
        failedCount: 2,
        agentKeys: ["blueprint-chief-of-staff"],
        runIds: ["run-fake-progress-1", "run-fake-progress-2"],
        issueIdentifiers: ["BLU-101"],
        examples: [
          {
            runId: "run-fake-progress-1",
            status: "failed",
            agent: "Blueprint Chief of Staff",
            issueIdentifiers: ["BLU-101"],
            bestText: text,
          },
        ],
      },
    ],
    suppressedRecoveredClusters: [],
  });
  return sweepPath;
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

function validProductionProposalInvoker(
  overrides: Record<string, unknown> = {},
): AiProductionChangeProposalInvoker {
  return async () =>
    JSON.stringify({
      proposal_id: "paperclip-hermes-policy-tier-canary",
      action_type: "paperclip_hermes_internal_metadata_update",
      target_system: "paperclip_hermes",
      target_record_id: "recursive-agent-improvement-loop",
      target_field: "metadata.autoagent.production_decision_loop",
      proposed_value: "canary_verified",
      reason:
        "Record a narrow internal metadata canary only after deterministic registry, eval, and rollback checks pass.",
      idempotency_key:
        "paperclip-hermes-metadata:recursive-agent-improvement-loop:production-decision-loop",
      stop_condition: "rollback if monitor_stop_condition is triggered",
      ...overrides,
    });
}

function validReportPointerProductionProposalInvoker(
  overrides: Record<string, unknown> = {},
): AiProductionChangeProposalInvoker {
  return async () =>
    JSON.stringify({
      proposal_id: "paperclip-report-pointer-canary",
      action_type: "paperclip_internal_report_pointer_update",
      target_system: "paperclip_hermes",
      target_record_id: "recursive-agent-improvement-loop",
      target_field: "metadata.autoagent.latest_production_report_pointer",
      proposed_value: {
        report_path:
          "output/autoagent/recursive-improvement/latest/report.md",
        summary_path:
          "output/autoagent/recursive-improvement/latest/summary.json",
        report_kind: "recursive_improvement_closeout",
      },
      reason:
        "Update the internal report pointer after the first production metadata lane has proven the canary executor.",
      idempotency_key:
        "paperclip-report-pointer:recursive-agent-improvement-loop:latest-production-report",
      stop_condition: "rollback if report pointer proof or monitor stop condition fails",
      ...overrides,
    });
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

  it("parses Paperclip failure sweep artifacts as local fixture queue inputs", () => {
    const options = parseRecursiveImprovementArgs([
      "--dry-run",
      "--paperclip-failure-sweep",
      "output/paperclip-failures.json",
    ]);

    expect(options.paperclipFailureSweepPaths).toEqual([
      "output/paperclip-failures.json",
    ]);
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

  it("parses production context, AI production proposal, and explicit production canary flags", () => {
    const options = parseRecursiveImprovementArgs([
      "--production-context",
      "--ai-production-proposal",
      "--execute-production-canary",
    ]);

    expect(options.productionContext).toBe(true);
    expect(options.aiProductionProposal).toBe(true);
    expect(options.executeProductionCanary).toBe(true);
    expect(options.dryRun).toBe(false);
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
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.production_context_built).toBe(false);
    expect(result.summary.ai_production_proposal_used).toBe(false);
    expect(result.summary.production_proposal_status).toBe("not_requested");
    expect(result.summary.production_action_type).toBeNull();
    expect(result.summary.production_target_system).toBeNull();
    expect(result.summary.production_canary_attempted).toBe(false);
    expect(result.summary.production_canary_result).toBe("not_requested");
    expect(result.summary.idempotency_key).toBeNull();
    expect(result.summary.audit_event_path).toBeNull();
    expect(result.summary.rollback_snapshot_path).toBeNull();
    expect(result.summary.production_action_registry).toMatchObject({
      registry_path: "server/agents/autoagent-production-action-registry.ts",
      default_mode: "dry_run",
      allowed_live_action_types: ["paperclip_hermes_internal_metadata_update"],
      blocked_action_types: expect.arrayContaining([
        "external_send",
        "payment_or_entitlement",
        "provider_execution",
        "hosted_session_fulfillment",
      ]),
      live_mutation_enabled_by_default: false,
    });

    await expect(fs.stat(result.summaryPath)).resolves.toBeTruthy();
    await expect(fs.stat(result.reportPath)).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(root, "recursive", "latest", "proposed_patch_summary.json")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(root, "recursive", "latest", "proposed_patch_report.md")),
    ).resolves.toBeTruthy();
  });

  it("turns Paperclip failure sweep clusters into local fixture queue artifacts and offline evals", async () => {
    const root = await makeTempDir();
    const sweepPath = await writePaperclipFailureSweep(
      root,
      "False progress: completed movement was claimed without changed artifact or owner-system proof.",
    );

    const result = await runLoop(root, {
      observerText: "No local observer failure family is present in this artifact.",
      options: {
        paperclipFailureSweepPaths: [sweepPath],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.selected_failure_family).toBe("fake_progress_closeout");
    expect(result.summary.generated_fixture_paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining("autoresearch-fake-progress-closeout/input.json"),
        expect.stringContaining("autoresearch-fake-progress-closeout/expected.json"),
        expect.stringContaining("autoresearch-fake-progress-closeout/labels.json"),
        expect.stringContaining("autoresearch-fake-progress-closeout/source.json"),
      ]),
    );
    expect(result.summary.offline_eval_result.status).toBe("passed");
    expect(result.summary.negative_controls_blocked).toBe(true);
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.command_outputs.join("\n")).toContain(
      "paperclip-failure-fixture-ingestion: sweeps=1 queued=1 families=fake_progress no_live_mutation=true",
    );
    expect(result.summary.proof_paths).toEqual(
      expect.arrayContaining([
        sweepPath,
        expect.stringContaining("paperclip-failure-fixture-queue.json"),
        expect.stringContaining("paperclip-failure-fixture-queue.md"),
      ]),
    );

    await expect(
      fs.stat(
        path.join(
          root,
          "harbor",
          "support-triage",
          "shadow",
          "autoresearch-fake-progress-closeout",
        ),
      ),
    ).resolves.toBeTruthy();

    const queueArtifact = JSON.parse(
      await fs.readFile(
        path.join(root, "recursive", "latest", "paperclip-failure-fixture-queue.json"),
        "utf8",
      ),
    );
    expect(queueArtifact).toMatchObject({
      no_live_mutation: true,
      suppressed_recovered_clusters_queued: false,
      ingestion_families: ["fake_progress"],
    });
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

  it("builds production context and falls back cleanly when AI production proposal is unavailable", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        aiProductionProposalEnv: {},
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.production_context_built).toBe(true);
    expect(result.summary.ai_production_proposal_used).toBe(false);
    expect(result.summary.production_proposal_status).toBe("fallback_ai_unavailable");
    expect(result.summary.production_canary_attempted).toBe(false);
    expect(result.summary.production_canary_result).toBe("not_attempted");
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.audit_event_path).toBeNull();
    expect(result.summary.rollback_snapshot_path).toMatch(/production-context/);
    expect(result.summary.command_outputs.join("\n")).toContain(
      "ai-production-change-proposer: status=fallback_ai_unavailable",
    );
  });

  it("validates a strong AI production proposal but does not mutate without the execute flag", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.production_context_built).toBe(true);
    expect(result.summary.ai_production_proposal_used).toBe(true);
    expect(result.summary.production_proposal_status).toBe("validated_dry_run_allowed");
    expect(result.summary.production_action_type).toBe(
      "paperclip_hermes_internal_metadata_update",
    );
    expect(result.summary.production_target_system).toBe("paperclip_hermes");
    expect(result.summary.idempotency_key).toBe(
      "paperclip-hermes-metadata:recursive-agent-improvement-loop:production-decision-loop",
    );
    expect(result.summary.production_canary_attempted).toBe(false);
    expect(result.summary.production_canary_result).toBe("not_attempted_execute_flag_missing");
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.audit_event_path).toBeNull();
    await expect(fs.stat(result.summary.rollback_snapshot_path!)).resolves.toBeTruthy();
  });

  it("executes a valid allowlisted AI production proposal only with the explicit canary flag", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.dry_run).toBe(false);
    expect(result.summary.production_proposal_status).toBe("validated_live_allowed");
    expect(result.summary.production_canary_attempted).toBe(true);
    expect(result.summary.production_canary_result).toBe("canary_committed");
    expect(result.summary.live_mutation_attempted).toBe(true);
    expect(result.summary.live_mutation_committed).toBe(true);
    expect(result.summary.audit_event_path).toMatch(/production-canary\/audit-event\.json$/);
    expect(result.summary.rollback_snapshot_path).toMatch(/production-context\/rollback-snapshot\.json$/);

    const audit = JSON.parse(await fs.readFile(result.summary.audit_event_path!, "utf8"));
    expect(audit.request.actionType).toBe("paperclip_hermes_internal_metadata_update");
    expect(audit.execution.result).toBe("canary_committed");
  });

  it("uses a candidate-attached shadow records path when rollback monitor input is not passed", async () => {
    const root = await makeTempDir();
    const candidateShadowPath = path.join(root, "candidate-shadow-records.json");
    await writeJson(candidateShadowPath, { records: [cleanShadowRecord()] });
    const candidate = buildCandidate() as PromptPolicyPromotionCandidate & {
      shadowSummary: NonNullable<PromptPolicyPromotionCandidate["shadowSummary"]> & {
        records_path: string;
      };
    };
    candidate.shadowSummary.records_path = "candidate-shadow-records.json";

    const result = await runLoop(root, {
      candidate,
      options: {
        shadowSourcePath: undefined,
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.rollback_decision).toBe("keep_canary");
    expect(result.summary.production_canary_attempted).toBe(true);
    expect(result.summary.production_canary_result).toBe("canary_committed");
    expect(result.summary.command_outputs.join("\n")).toContain(
      `recursive-improvement shadow source: path=${candidateShadowPath}`,
    );
  });

  it("rolls back an allowlisted production canary when a stop condition trips", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker({
          stop_condition: "force_rollback_for_test",
        }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.production_canary_attempted).toBe(true);
    expect(result.summary.production_canary_result).toBe("rolled_back");
    expect(result.summary.live_mutation_attempted).toBe(true);
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.rollback_applied).toBe(true);

    const audit = JSON.parse(await fs.readFile(result.summary.audit_event_path!, "utf8"));
    expect(audit.execution.result).toBe("rolled_back");
    expect(audit.rollback.applied).toBe(true);
  });

  it("blocks unsafe production proposals before mutation", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker({
          action_type: "external_send",
          target_system: "gmail_slack_sendgrid",
        }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.production_proposal_status).toBe("blocked");
    expect(result.summary.production_action_type).toBe("external_send");
    expect(result.summary.production_target_system).toBe("gmail_slack_sendgrid");
    expect(result.summary.production_canary_attempted).toBe(false);
    expect(result.summary.production_canary_result).toBe("not_attempted_validator_rejected");
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.live_mutation_committed).toBe(false);
  });

  it("suppresses duplicate production idempotency keys without a duplicate action", async () => {
    const root = await makeTempDir();
    const first = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });
    expect(first.summary.production_canary_result).toBe("canary_committed");

    const second = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });

    expect(second.ok).toBe(true);
    expect(second.summary.production_proposal_status).toBe("duplicate_idempotency");
    expect(second.summary.production_canary_attempted).toBe(false);
    expect(second.summary.production_canary_result).toBe("duplicate_idempotency_suppressed");
    expect(second.summary.live_mutation_attempted).toBe(false);
    expect(second.summary.live_mutation_committed).toBe(false);

    const ledger = JSON.parse(await fs.readFile(
      path.join(root, "recursive", "latest", "production-canary", "idempotency-ledger.json"),
      "utf8",
    ));
    expect(ledger.entries.filter((entry: { idempotencyKey: string }) =>
      entry.idempotencyKey ===
        "paperclip-hermes-metadata:recursive-agent-improvement-loop:production-decision-loop",
    )).toHaveLength(1);
  });

  it("blocks the internal report pointer production lane until the first live lane has execution proof", async () => {
    const root = await makeTempDir();
    const result = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validReportPointerProductionProposalInvoker(),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary.production_proposal_status).toBe("blocked");
    expect(result.summary.production_action_type).toBe(
      "paperclip_internal_report_pointer_update",
    );
    expect(result.summary.production_canary_attempted).toBe(false);
    expect(result.summary.production_canary_result).toBe(
      "not_attempted_validator_rejected",
    );
    expect(result.summary.live_mutation_attempted).toBe(false);
    expect(result.summary.live_mutation_committed).toBe(false);
    expect(result.summary.command_outputs.join("\n")).toContain(
      "prior live action proof is missing for paperclip_internal_report_pointer_update",
    );
  });

  it("executes the internal report pointer lane after first-lane execution proof exists", async () => {
    const root = await makeTempDir();
    const first = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });
    expect(first.summary.production_canary_result).toBe("canary_committed");

    const second = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validReportPointerProductionProposalInvoker(),
      },
    });

    expect(second.ok).toBe(true);
    expect(second.summary.production_proposal_status).toBe("validated_live_allowed");
    expect(second.summary.production_action_type).toBe(
      "paperclip_internal_report_pointer_update",
    );
    expect(second.summary.production_canary_attempted).toBe(true);
    expect(second.summary.production_canary_result).toBe("canary_committed");
    expect(second.summary.live_mutation_attempted).toBe(true);
    expect(second.summary.live_mutation_committed).toBe(true);

    const executionPath = path.join(
      root,
      "recursive",
      "latest",
      "production-canary",
      "execution.json",
    );
    const execution = JSON.parse(await fs.readFile(executionPath, "utf8"));
    expect(execution.action.action_type).toBe(
      "paperclip_internal_report_pointer_update",
    );
    expect(execution.mutation.surface).toBe(
      "paperclip_hermes.internal_report_pointer",
    );
    expect(execution.rollback.snapshot_path).toMatch(/production-context\/rollback-snapshot\.json$/);
  });

  it("rolls back the internal report pointer lane when a stop condition trips", async () => {
    const root = await makeTempDir();
    const first = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });
    expect(first.summary.production_canary_result).toBe("canary_committed");

    const second = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validReportPointerProductionProposalInvoker({
          stop_condition: "force_rollback_for_test",
        }),
      },
    });

    expect(second.ok).toBe(true);
    expect(second.summary.production_canary_attempted).toBe(true);
    expect(second.summary.production_canary_result).toBe("rolled_back");
    expect(second.summary.live_mutation_attempted).toBe(true);
    expect(second.summary.live_mutation_committed).toBe(false);
    expect(second.summary.rollback_applied).toBe(true);

    const rollback = JSON.parse(await fs.readFile(
      path.join(root, "recursive", "latest", "production-canary", "rollback-applied.json"),
      "utf8",
    ));
    expect(rollback.action_type).toBe("paperclip_internal_report_pointer_update");
    expect(rollback.rollback_strategy).toBe("restore_previous_report_pointer_snapshot");
  });

  it("suppresses duplicate internal report pointer idempotency keys", async () => {
    const root = await makeTempDir();
    const first = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validProductionProposalInvoker(),
      },
    });
    expect(first.summary.production_canary_result).toBe("canary_committed");

    const second = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validReportPointerProductionProposalInvoker(),
      },
    });
    expect(second.summary.production_canary_result).toBe("canary_committed");

    const third = await runLoop(root, {
      options: {
        productionContext: true,
        aiProductionProposal: true,
        executeProductionCanary: true,
        aiProductionProposalEnv: {},
        aiProductionProposalInvoker: validReportPointerProductionProposalInvoker(),
      },
    });

    expect(third.summary.production_proposal_status).toBe("duplicate_idempotency");
    expect(third.summary.production_canary_attempted).toBe(false);
    expect(third.summary.production_canary_result).toBe(
      "duplicate_idempotency_suppressed",
    );
    expect(third.summary.live_mutation_attempted).toBe(false);
    expect(third.summary.live_mutation_committed).toBe(false);

    const ledger = JSON.parse(await fs.readFile(
      path.join(root, "recursive", "latest", "production-canary", "idempotency-ledger.json"),
      "utf8",
    ));
    expect(ledger.entries.filter((entry: { idempotencyKey: string }) =>
      entry.idempotencyKey ===
        "paperclip-report-pointer:recursive-agent-improvement-loop:latest-production-report",
    )).toHaveLength(1);
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
    expect(report).toContain("Production registry: server/agents/autoagent-production-action-registry.ts");
    expect(report).toContain("Allowed live action types");
    expect(report).toContain("paperclip_hermes_internal_metadata_update");

    await expect(
      fs.stat(path.join(root, "recursive", "latest", "canary", "canary-config.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
