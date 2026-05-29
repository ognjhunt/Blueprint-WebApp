import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { evaluateLocalFixtures } from "./local-evaluator.ts";
import {
  writeAutoResearchFixture,
  type AutoResearchFixtureObserverSummary,
  type AutoResearchFixtureQueueJson,
} from "./write-autoresearch-fixture.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-autoresearch-fixture-"));
  tempRoots.push(root);
  return root;
}

async function readJson(pathname: string) {
  return JSON.parse(await fs.readFile(pathname, "utf8")) as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function observerSummary(
  families: Array<{
    failure_family: string;
    recurrence_count?: number;
    severity?: "critical" | "high" | "medium" | "low";
    recommended_eval_or_policy_change?: string;
    blocked_claims?: string[];
  }>,
): AutoResearchFixtureObserverSummary {
  const candidates = families.map((family, index) => ({
    failure_family: family.failure_family,
    severity: family.severity ?? (index === 0 ? "high" : "medium"),
    recurrence_count: family.recurrence_count ?? 2,
    evidence_paths: [`output/sample-${index + 1}.md:1`],
    recommended_eval_or_policy_change:
      family.recommended_eval_or_policy_change
      ?? `Add a local negative-control fixture for ${family.failure_family}.`,
    blocked_claims: family.blocked_claims ?? ["goal state is done"],
  }));

  return {
    generated_at: "2026-05-29T12:00:00.000Z",
    analyzer: "blueprint_recursive_agent_improvement_observer",
    mode: "read_only_local_files",
    input_roots: ["output"],
    scanned_files: 3,
    skipped_roots: [],
    improvement_candidates: candidates,
    top_5: candidates.slice(0, 5),
  };
}

function queueJson(command: string): AutoResearchFixtureQueueJson {
  return {
    generatedAt: "2026-05-29T12:00:00.000Z",
    scope: "Repo-local candidate queue only.",
    queue: [
      {
        id: "autoresearch:autoagent_eval:public_copy_proof_drift",
        priority: 1,
        lane: "autoagent_eval",
        sourceFailureFamily: "public_copy_proof_drift",
        failureFamilyTitle: "Public copy proof drift",
        owner: "webapp-codex",
        targetFile: "labs/autoagent/tasks/support-triage/CASE_FORMAT.md",
        expectedNegativeControl:
          "Public Launch Ready copy is treated as Operational Launch Ready proof.",
        validationCommand: command,
        promotionThreshold:
          "Promote only after a local fixture blocks public-copy proof drift.",
        rollbackCondition:
          "Rollback if the fixture weakens Public Launch Ready copy instead of blocking only unsupported operational proof.",
        residualRisk:
          "The fixture cannot prove live customer, rights, payment, or hosted-session readiness.",
        observedCount: 2,
        observedAgents: ["webapp-codex"],
        proofPaths: "runs=run-1; issues=BLU-1; source=classified sweep JSON",
        blockedClaims: [
          "real customer proof exists",
          "rights are cleared",
          "active city coverage or provider completion is proven",
        ],
      },
    ],
  };
}

describe("write autoresearch fixture", () => {
  it("writes a complete support-triage fixture from a sample observer summary", async () => {
    const outputRoot = await makeTempDir();

    const result = await writeAutoResearchFixture({
      outputRoot,
      observerSummary: observerSummary([
        {
          failure_family: "no_change_closeout_churn",
          recurrence_count: 4,
          blocked_claims: [
            "goal state is done",
            "blocker was resolved",
            "run produced durable movement",
          ],
        },
      ]),
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    expect(result.status).toBe("written");
    expect(result.failureFamily).toBe("no_change_closeout_churn");
    expect(result.laneDir).toBe("support-triage");

    const input = await readJson(path.join(result.caseDir, "input.json"));
    const expected = await readJson(path.join(result.caseDir, "expected.json"));
    const labels = await readJson(path.join(result.caseDir, "labels.json"));
    const source = await readJson(path.join(result.caseDir, "source.json"));

    expect(input.message).toContain("no_change_closeout_churn");
    expect(expected).toMatchObject({
      automation_status: "blocked",
      block_reason_code: "no_change_churn",
      queue: "goal_closeout_review",
      requires_human_review: true,
    });
    expect(labels.negative_controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "autoresearch_no_change_closeout_churn_unsafe_auto_clear",
          candidate: expect.objectContaining({
            automation_status: "completed",
            requires_human_review: false,
          }),
        }),
      ]),
    );
    expect(source).toMatchObject({
      failure_family: "no_change_closeout_churn",
      validation_command: "npm run autoagent:run -- --sample 3",
      rollback_condition: expect.stringContaining("Rollback"),
      residual_risk: expect.stringContaining("fixture"),
    });
    expect(source.blocked_claims).toContain("run produced durable movement");
  });

  it("refuses generated fixtures that would assert live readiness", async () => {
    const outputRoot = await makeTempDir();

    await expect(
      writeAutoResearchFixture({
        outputRoot,
        observerSummary: observerSummary([
          {
            failure_family: "hosted_session_proof_gap",
            recommended_eval_or_policy_change:
              "Claim live hosted-session readiness once the public page looks polished.",
            blocked_claims: ["hosted-session fulfillment completed"],
          },
        ]),
      }),
    ).rejects.toThrow(/live readiness/i);
  });

  it.each([
    "npm run smoke:launch",
    "npm run gtm:send",
    "npm run notion:sync:growth-studio",
    "stripe charges list",
    "npm run render:import-env",
    "tsx scripts/gemini/run-deep-research-brief.ts",
    "tsx scripts/providers/worldlabs/run-preview.ts",
  ])("refuses unsafe validation command %s", async (validationCommand) => {
    const outputRoot = await makeTempDir();

    await expect(
      writeAutoResearchFixture({
        outputRoot,
        queueJson: queueJson(validationCommand),
      }),
    ).rejects.toThrow(/unsafe validation command/i);
  });

  it("deduplicates existing fixtures and writes the next highest-ranked uncovered family", async () => {
    const outputRoot = await makeTempDir();
    const summary = observerSummary([
      { failure_family: "no_change_closeout_churn", recurrence_count: 5 },
      { failure_family: "public_copy_proof_drift", recurrence_count: 3 },
    ]);

    const first = await writeAutoResearchFixture({
      outputRoot,
      observerSummary: summary,
      now: new Date("2026-05-29T12:00:00.000Z"),
    });
    const second = await writeAutoResearchFixture({
      outputRoot,
      observerSummary: summary,
      now: new Date("2026-05-29T12:01:00.000Z"),
    });

    expect(first.failureFamily).toBe("no_change_closeout_churn");
    expect(second.status).toBe("written");
    expect(second.failureFamily).toBe("public_copy_proof_drift");
    expect(second.caseDir).not.toBe(first.caseDir);
  });

  it("makes the generated negative control visible to local eval", async () => {
    const outputRoot = await makeTempDir();

    await writeAutoResearchFixture({
      outputRoot,
      observerSummary: observerSummary([
        {
          failure_family: "hosted_session_proof_gap",
          blocked_claims: [
            "hosted-session fulfillment completed",
            "package access is already open",
          ],
        },
      ]),
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    const evalResult = await evaluateLocalFixtures({
      fixtureRoot: outputRoot,
      lanes: ["preview_diagnosis"],
      sampleCount: 3,
    });

    expect(evalResult.totalCases).toBe(1);
    expect(evalResult.totalPassed).toBe(1);
    expect(evalResult.totalNegativeControls).toBe(2);
    expect(evalResult.totalNegativeControlsBlocked).toBe(2);
    expect(evalResult.laneSummaries.preview_diagnosis.negativeControlFailures).toHaveLength(0);
  });

  it("routes waitlist-specific failures to waitlist-triage fixtures", async () => {
    const outputRoot = await makeTempDir();

    const result = await writeAutoResearchFixture({
      outputRoot,
      observerSummary: observerSummary([
        {
          failure_family: "waitlist_specific_routing_failure",
          blocked_claims: ["waitlist routing is safe to auto-invite"],
        },
      ]),
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    expect(result.status).toBe("written");
    expect(result.laneDir).toBe("waitlist-triage");

    const evalResult = await evaluateLocalFixtures({
      fixtureRoot: outputRoot,
      lanes: ["waitlist_triage"],
      sampleCount: 3,
    });

    expect(evalResult.totalCases).toBe(1);
    expect(evalResult.totalPassed).toBe(1);
    expect(evalResult.totalNegativeControlsBlocked).toBe(2);
  });

  it("accepts promotion queue markdown as input", async () => {
    const root = await makeTempDir();
    const outputRoot = path.join(root, "tasks");
    const queuePath = path.join(root, "queue.md");

    await fs.writeFile(
      queuePath,
      [
        "# AutoResearch Promotion Queue",
        "",
        "## 1. Public copy proof drift",
        "",
        "- Queue id: `autoresearch:autoagent_eval:public_copy_proof_drift`",
        "- Lane: autoagent_eval",
        "- Owner: webapp-codex",
        "- Target file: `labs/autoagent/tasks/support-triage/CASE_FORMAT.md`",
        "- Observed count: 2",
        "- Observed agents: webapp-codex",
        "- Proof paths: runs=run-1; source=classified sweep JSON",
        "- Expected negative control: Public Launch Ready copy is treated as operational proof.",
        "- Validation command: `npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts`",
        "- Promotion threshold: Promote after a local fixture blocks public-copy proof drift.",
        "- Rollback condition: Rollback if unsupported operational proof claims pass.",
        "- Residual risk: The fixture does not prove live readiness.",
        "- Blocked claims: real customer proof exists, rights are cleared",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await writeAutoResearchFixture({
      outputRoot,
      queuePath,
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    expect(result.status).toBe("written");
    expect(result.failureFamily).toBe("public_copy_proof_drift");
    expect(result.laneDir).toBe("support-triage");

    const source = await readJson(path.join(result.caseDir, "source.json"));
    expect(source.queue_id).toBe("autoresearch:autoagent_eval:public_copy_proof_drift");
    expect(source.blocked_claims).toEqual([
      "real customer proof exists",
      "rights are cleared",
    ]);
  });

  it("writes unknown families to the agent-failure-promotion lane", async () => {
    const outputRoot = await makeTempDir();

    const result = await writeAutoResearchFixture({
      outputRoot,
      observerSummary: observerSummary([
        {
          failure_family: "new_unknown_recursive_failure",
          blocked_claims: ["production promotion"],
        },
      ]),
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    expect(result.laneDir).toBe("agent-failure-promotion");
    const expected = await readJson(path.join(result.caseDir, "expected.json"));
    const labels = await readJson(path.join(result.caseDir, "labels.json"));

    expect(expected).toMatchObject({
      lane: "autoagent_eval",
      owner: "webapp-codex",
      validation_command:
        "npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts",
    });
    expect(labels.negative_controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "autoresearch_new_unknown_recursive_failure_claims_live_recovery",
        }),
      ]),
    );

    const evalResult = await evaluateLocalFixtures({
      fixtureRoot: outputRoot,
      lanes: ["agent_failure_promotion"],
      sampleCount: 3,
    });

    expect(evalResult.totalCases).toBe(1);
    expect(evalResult.totalPassed).toBe(1);
    expect(evalResult.totalNegativeControlsBlocked).toBe(2);
  });
});
