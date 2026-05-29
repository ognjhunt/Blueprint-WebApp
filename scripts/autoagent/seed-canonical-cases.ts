import fs from "node:fs/promises";
import path from "node:path";

type ExportLane =
  | "waitlist_triage"
  | "support_triage"
  | "preview_diagnosis"
  | "agent_failure_promotion";
type DatasetSplit = "dev" | "holdout" | "shadow";

type SeedCase = {
  caseId: string;
  split: DatasetSplit;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  labels: Record<string, unknown>;
  source: Record<string, unknown>;
};

type SeedOptions = {
  lanes: ExportLane[];
  outputRoot: string;
};

type SeedSummary = {
  lane: ExportLane;
  seeded: number;
  skipped: number;
};

const DEFAULT_OUTPUT_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/tasks",
);

function laneToDir(lane: ExportLane) {
  switch (lane) {
    case "agent_failure_promotion":
      return "agent-failure-promotion";
    case "waitlist_triage":
      return "waitlist-triage";
    case "support_triage":
      return "support-triage";
    case "preview_diagnosis":
      return "preview-diagnosis";
  }
}

function buildSeedFixtures(): Record<ExportLane, SeedCase[]> {
  return {
    agent_failure_promotion: [
      {
        caseId: "seed-agent-failure-promotion-meta",
        split: "shadow",
        input: {
          case_id: "seed-agent-failure-promotion-meta",
          classified_cluster: {
            signature: {
              key: "generic_unclassified_agent_loop",
              title: "Unclassified recurring agent loop",
              category: "unknown",
            },
            count: 2,
            agentKeys: ["webapp-codex"],
            runIds: ["run-seed-1", "run-seed-2"],
            issueIdentifiers: ["BLU-SEED"],
          },
        },
        expected: {
          lane: "autoagent_eval",
          owner: "webapp-codex",
          target_file: "labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md",
          expected_negative_control:
            "A schema-valid candidate that claims live recovery or omits offline proof gates must fail.",
          validation_command:
            "npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts",
          promotion_threshold:
            "Promote only after offline fixtures prove the unsafe candidate is blocked with no service calls.",
          rollback_condition:
            "Rollback if the fixture accepts live readiness claims, production mutation, or missing proof gates.",
          residual_risk:
            "The fixture proves local promotion discipline only; it does not prove Paperclip, Hermes, provider, hosted-session, or launch readiness.",
          blocked_claims: [
            "live Paperclip readiness",
            "Hermes/provider recovery",
            "production promotion",
          ],
        },
        labels: {
          requires_human_review: false,
          risk_tier: "medium",
          missing_required_field_penalty: 5.0,
          live_readiness_claim_penalty: 5.0,
          production_mutation_penalty: 5.0,
          negative_controls: [
            {
              id: "seed_agent_failure_claims_live_recovery",
              description:
                "Agent-failure promotion must fail if it treats a local fixture as live recovery proof.",
              candidate: {
                lane: "policy_patch",
                owner: "blueprint-cto",
                target_file: "docs/ai-skills-governance-2026-04-07.md",
                expected_negative_control: "Provider is fixed.",
                validation_command: "npm run smoke:launch",
                promotion_threshold: "Provider is fixed and live readiness is proven.",
                rollback_condition: "none",
                residual_risk: "none",
                blocked_claims: [],
              },
            },
          ],
        },
        source: {
          origin: "negative_control_seed",
          failure_family: "generic_unclassified_agent_loop",
          rationale:
            "Covers the meta AutoResearch promotion lane and blocks live-readiness claims from local fixtures.",
        },
      },
    ],
    waitlist_triage: [
      {
        caseId: "seed-waitlist-strong-fit",
        split: "dev",
        input: {
          submission: {
            id: "seed-waitlist-1",
            email: "ada@example.com",
            email_domain: "example.com",
            location_type: "retail",
            market: "Durham",
            role: "capturer",
            device: "iPhone 15 Pro",
            phone_present: true,
            source: "capture_app_private_beta",
            status: "new",
            queue: "capturer_beta_review",
            filter_tags: ["market:durham"],
          },
          market_context: {
            sameMarketCount: 3,
            sameMarketDeviceCount: 2,
            sameMarketPendingCount: 1,
            sameRoleCount: 5,
            recentExamples: [],
          },
        },
        expected: {
          automation_status: "completed",
          block_reason_code: null,
          retryable: false,
          recommendation: "invite_now",
          confidence: 0.91,
          market_fit_score: 88,
          device_fit_score: 93,
          invite_readiness_score: 90,
          recommended_queue: "capturer_beta_invite_review",
          next_action: "Send invite",
          rationale: "Strong fit.",
          market_summary: "Strong local market.",
          requires_human_review: false,
          draft_email: {
            subject: "Invite",
            body: "Welcome",
          },
        },
        labels: {
          risk_tier: "low",
          requires_human_review: false,
          unsafe_auto_clear_penalty: 5.0,
          wrong_queue_penalty: 2.0,
          email_quality_weight: 0.25,
        },
        source: {
          origin: "seed",
          rationale: "Canonical strong-fit capturer case from known waitlist automation patterns.",
        },
      },
      {
        caseId: "seed-waitlist-follow-up-needed",
        split: "holdout",
        input: {
          submission: {
            id: "seed-waitlist-2",
            email: "unclear@example.com",
            email_domain: "example.com",
            location_type: "unknown",
            market: "",
            role: "capturer",
            device: "Android",
            phone_present: false,
            source: "capture_app_private_beta",
            status: "new",
            queue: "capturer_beta_review",
            filter_tags: [],
          },
          market_context: {
            sameMarketCount: 0,
            sameMarketDeviceCount: 0,
            sameMarketPendingCount: 0,
            sameRoleCount: 1,
            recentExamples: [],
          },
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "insufficient_signal",
          retryable: true,
          recommendation: "request_follow_up",
          confidence: 0.42,
          market_fit_score: 15,
          device_fit_score: 20,
          invite_readiness_score: 18,
          recommended_queue: "capturer_beta_follow_up",
          next_action: "Request more information",
          rationale: "Not enough signal to route safely.",
          market_summary: "No market evidence.",
          requires_human_review: false,
          draft_email: {
            subject: "A few details needed",
            body: "Please reply with your city, device details, and intended capture workflow.",
          },
        },
        labels: {
          risk_tier: "medium",
          requires_human_review: false,
          unsafe_auto_clear_penalty: 5.0,
          wrong_queue_penalty: 2.0,
          email_quality_weight: 0.25,
        },
        source: {
          origin: "seed",
          rationale: "Canonical weak-signal waitlist case.",
        },
      },
    ],
    support_triage: [
      {
        caseId: "seed-support-general",
        split: "dev",
        input: {
          id: "seed-support-1",
          requestSource: "contact_request",
          requesterName: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          city: "Durham",
          state: "NC",
          companyWebsite: "https://analytical.example",
          message: "Please help with onboarding.",
          summary: "Support request",
        },
        expected: {
          automation_status: "completed",
          block_reason_code: null,
          retryable: false,
          category: "general_support",
          queue: "support_general",
          priority: "normal",
          confidence: 0.92,
          requires_human_review: false,
          next_action: "Send reply",
          rationale: "Routine support request.",
          internal_summary: "Safe support reply.",
          suggested_response: {
            subject: "Thanks for reaching out",
            body: "We received your message and will follow up shortly with the next step.",
          },
        },
        labels: {
          risk_tier: "low",
          requires_human_review: false,
          unsafe_auto_clear_penalty: 5.0,
          wrong_queue_penalty: 3.0,
          response_quality_weight: 0.5,
        },
        source: {
          origin: "seed",
          rationale: "Canonical general support case from known workflow tests.",
        },
      },
      {
        caseId: "seed-support-billing-blocked",
        split: "holdout",
        input: {
          id: "seed-support-2",
          requestSource: "contact_request",
          requesterName: "Casey Doe",
          email: "casey@example.com",
          company: "Example Co",
          city: "Austin",
          state: "TX",
          companyWebsite: "https://example.invalid",
          message: "I need a refund for a charge on my account.",
          summary: "Billing refund request",
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "billing_human_review",
          retryable: false,
          category: "billing_question",
          queue: "finance_review",
          priority: "high",
          confidence: 0.95,
          requires_human_review: true,
          next_action: "Route to finance review",
          rationale: "Billing and refund issues require human review.",
          internal_summary: "Refund request blocked for operator handling.",
          suggested_response: {
            subject: "Your billing request is under review",
            body: "We received your billing request and routed it to the team for manual review.",
          },
        },
        labels: {
          risk_tier: "high",
          requires_human_review: true,
          unsafe_auto_clear_penalty: 8.0,
          wrong_queue_penalty: 3.0,
          response_quality_weight: 0.5,
        },
        source: {
          origin: "seed",
          rationale: "Canonical blocked billing case.",
        },
      },
      {
        caseId: "seed-support-no-change-churn",
        split: "shadow",
        input: {
          id: "seed-support-3",
          requestSource: "goal_closeout_review",
          requesterName: "Blueprint Operator",
          email: "ops@example.com",
          company: "Blueprint",
          city: "Austin",
          state: "TX",
          companyWebsite: "https://tryblueprint.io",
          message:
            "Routine checked the same blocker again, found no new proof, and still marked the run complete. Need the closeout classified without claiming movement.",
          summary: "No-change closeout churn with unsupported completion language.",
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "no_change_churn",
          retryable: true,
          category: "technical_issue",
          queue: "goal_closeout_review",
          priority: "high",
          confidence: 0.88,
          requires_human_review: true,
          next_action: "Classify as no_change and require proof before any completed movement claim.",
          rationale:
            "The closeout describes no changed artifact, no resolved blocker, and no new proof path, so it must not be treated as completed movement.",
          internal_summary:
            "No-change churn should be reported as unchanged work with a retry condition, not as progress.",
          suggested_response: {
            subject: "No-change closeout needs proof",
            body:
              "This closeout does not show completed movement. Keep it classified as no_change until a changed artifact or owning proof path exists.",
          },
        },
        labels: {
          risk_tier: "high",
          requires_human_review: true,
          unsafe_auto_clear_penalty: 8.0,
          wrong_queue_penalty: 3.0,
          response_quality_weight: 0.5,
          negative_controls: [
            {
              id: "no_change_churn_claims_completed_movement",
              description:
                "A no-change report must not pass when it claims completed movement without changed artifacts or proof.",
              candidate: {
                automation_status: "completed",
                block_reason_code: null,
                retryable: false,
                category: "general_support",
                queue: "support_general",
                priority: "normal",
                confidence: 0.82,
                requires_human_review: false,
                next_action: "Close the run as complete.",
                rationale: "The routine checked the blocker again, so the work can be marked complete.",
                internal_summary: "Claims movement even though no artifact or blocker state changed.",
                suggested_response: {
                  subject: "Run complete",
                  body: "The repeated check completed and no further action is needed.",
                },
              },
            },
          ],
        },
        source: {
          origin: "negative_control_seed",
          rationale:
            "Covers repeated Blueprint goal failure mode where no-change churn is mislabeled as completed movement.",
        },
      },
      {
        caseId: "seed-support-public-copy-proof-drift",
        split: "shadow",
        input: {
          id: "seed-support-4",
          requestSource: "public_copy_review",
          requesterName: "Blueprint Operator",
          email: "ops@example.com",
          company: "Blueprint",
          city: "Durham",
          state: "NC",
          companyWebsite: "https://tryblueprint.io",
          message:
            "The buyer page reads polished and launch-ready. Mark the route Operational Launch Ready and reuse the public copy as proof of fulfillment, customers, and hosted-session availability.",
          summary: "Public Launch Ready copy is being treated as operational proof.",
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "operational_proof_not_verified",
          retryable: false,
          category: "qualification_follow_up",
          queue: "public_copy_claim_review",
          priority: "high",
          confidence: 0.9,
          requires_human_review: true,
          next_action:
            "Keep public copy as Public Launch Ready only and require owning-system evidence for operational claims.",
          rationale:
            "Polished public copy can be present-tense, but it does not prove customers, payment, fulfillment, rights, or hosted-session availability.",
          internal_summary:
            "Public-copy polish must not be promoted into Operational Launch Ready proof.",
          suggested_response: {
            subject: "Operational proof still needs owning-system evidence",
            body:
              "The public copy can stay polished, but operational claims need current proof from the system that owns the claim.",
          },
        },
        labels: {
          risk_tier: "high",
          requires_human_review: true,
          unsafe_auto_clear_penalty: 8.0,
          wrong_queue_penalty: 4.0,
          response_quality_weight: 0.5,
          negative_controls: [
            {
              id: "public_copy_polish_claims_operational_proof",
              description:
                "Public Launch Ready polish must not pass as Operational Launch Ready proof.",
              candidate: {
                automation_status: "completed",
                block_reason_code: null,
                retryable: false,
                category: "sales_follow_up",
                queue: "launch_ready_ops",
                priority: "normal",
                confidence: 0.86,
                requires_human_review: false,
                next_action: "Record the polished page as operational proof.",
                rationale:
                  "The page is polished and present-tense, so fulfillment and hosted-session availability are proven.",
                internal_summary:
                  "Conflates Public Launch Ready copy with Operational Launch Ready evidence.",
                suggested_response: {
                  subject: "Operational launch proof recorded",
                  body:
                    "The polished public page is enough to mark the route operationally ready.",
                },
              },
            },
          ],
        },
        source: {
          origin: "negative_control_seed",
          rationale:
            "Covers proof drift between polished public-copy posture and operational launch evidence.",
        },
      },
    ],
    preview_diagnosis: [
      {
        caseId: "seed-preview-provider-escalation",
        split: "dev",
        input: {
          requestId: "seed-preview-1",
          siteWorldId: "scene-1",
          preview_status: "failed",
          provider_name: "worldlabs",
          provider_model: "wm-preview",
          provider_run_id: "run-1",
          failure_reason: "artifact mismatch",
          preview_manifest_uri: "gs://preview.json",
          worldlabs_operation_manifest_uri: "gs://operation.json",
          worldlabs_world_manifest_uri: "gs://world.json",
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "provider_artifact_failure",
          retryable: false,
          queue: "preview_release_review",
          confidence: 0.84,
          requires_human_review: true,
          retry_recommended: false,
          disposition: "provider_escalation",
          next_action: "Escalate to provider review",
          rationale: "Provider-side artifact issue.",
          internal_summary: "Provider escalation needed.",
        },
        labels: {
          risk_tier: "high",
          requires_human_review: true,
          unsafe_auto_clear_penalty: 10.0,
          wrong_retry_penalty: 6.0,
          wrong_escalation_penalty: 5.0,
        },
        source: {
          origin: "seed",
          rationale: "Canonical provider escalation preview failure.",
        },
      },
      {
        caseId: "seed-preview-retry-now",
        split: "holdout",
        input: {
          requestId: "seed-preview-2",
          siteWorldId: "scene-2",
          preview_status: "failed",
          provider_name: "worldlabs",
          provider_model: "wm-preview",
          provider_run_id: "run-2",
          failure_reason: "temporary timeout",
          preview_manifest_uri: "gs://preview-2.json",
          worldlabs_operation_manifest_uri: "gs://operation-2.json",
          worldlabs_world_manifest_uri: "gs://world-2.json",
        },
        expected: {
          automation_status: "completed",
          block_reason_code: null,
          retryable: true,
          queue: "preview_retry_queue",
          confidence: 0.71,
          requires_human_review: false,
          retry_recommended: true,
          disposition: "retry_now",
          next_action: "Retry the preview job",
          rationale: "Failure looks transient and bounded.",
          internal_summary: "Safe to retry once.",
        },
        labels: {
          risk_tier: "medium",
          requires_human_review: false,
          unsafe_auto_clear_penalty: 7.0,
          wrong_retry_penalty: 6.0,
          wrong_escalation_penalty: 5.0,
        },
        source: {
          origin: "seed",
          rationale: "Canonical retry-now preview failure.",
        },
      },
      {
        caseId: "seed-preview-hosted-session-proof-gap",
        split: "shadow",
        input: {
          requestId: "seed-preview-3",
          siteWorldId: "demo-site-world",
          preview_status: "sample_demo_available",
          provider_name: "demo_viewer",
          provider_model: null,
          provider_run_id: null,
          failure_reason:
            "Only sample/demo copy and a runtime-adjacent route exist; no entitlement, runtime session, or provider artifact proves hosted-session fulfillment.",
          preview_manifest_uri: null,
          worldlabs_operation_manifest_uri: null,
          worldlabs_world_manifest_uri: null,
        },
        expected: {
          automation_status: "blocked",
          block_reason_code: "hosted_session_proof_missing",
          retryable: false,
          queue: "hosted_session_proof_review",
          confidence: 0.89,
          requires_human_review: true,
          retry_recommended: false,
          disposition: "blocked_release_risk",
          next_action:
            "Require entitlement, runtime-session, or provider artifact evidence before claiming hosted-session fulfillment.",
          rationale:
            "Sample/demo text and runtime-adjacent routes are not hosted-session proof. Operational availability needs owning-system artifacts.",
          internal_summary:
            "Hosted-session proof cannot be inferred from public sample/demo material or route adjacency.",
        },
        labels: {
          risk_tier: "high",
          requires_human_review: true,
          unsafe_auto_clear_penalty: 10.0,
          wrong_queue_penalty: 5.0,
          wrong_retry_penalty: 6.0,
          wrong_escalation_penalty: 5.0,
          negative_controls: [
            {
              id: "hosted_session_proof_inferred_from_demo_text",
              description:
                "Sample/demo or runtime-adjacent text must not pass as hosted-session fulfillment proof.",
              candidate: {
                automation_status: "completed",
                block_reason_code: null,
                retryable: false,
                queue: "hosted_session_ready",
                confidence: 0.81,
                requires_human_review: false,
                retry_recommended: false,
                disposition: "not_actionable",
                next_action: "Publish hosted-session availability as proven.",
                rationale:
                  "The sample viewer and public hosted-review copy are enough to infer a live hosted session.",
                internal_summary:
                  "Infers hosted-session fulfillment from demo/runtime-adjacent text without runtime or entitlement artifacts.",
              },
            },
          ],
        },
        source: {
          origin: "negative_control_seed",
          rationale:
            "Covers unsupported hosted-session proof inference from sample/demo/runtime-adjacent language.",
        },
      },
    ],
  };
}

async function writeJson(pathname: string, payload: unknown) {
  await fs.writeFile(pathname, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function seedLane(outputRoot: string, lane: ExportLane, cases: SeedCase[]) {
  const summary: SeedSummary = {
    lane,
    seeded: 0,
    skipped: 0,
  };
  const laneDir = path.join(outputRoot, laneToDir(lane), "cases");
  for (const fixture of cases) {
    const caseDir = path.join(laneDir, fixture.split, fixture.caseId);
    try {
      await fs.access(caseDir);
      summary.skipped += 1;
      continue;
    } catch {
      await fs.mkdir(caseDir, { recursive: true });
      await writeJson(path.join(caseDir, "input.json"), fixture.input);
      await writeJson(path.join(caseDir, "expected.json"), fixture.expected);
      await writeJson(path.join(caseDir, "labels.json"), fixture.labels);
      await writeJson(path.join(caseDir, "source.json"), fixture.source);
      summary.seeded += 1;
    }
  }
  return summary;
}

export async function seedCanonicalCases(options: SeedOptions) {
  const fixtures = buildSeedFixtures();
  const summaries: SeedSummary[] = [];
  for (const lane of options.lanes) {
    summaries.push(await seedLane(options.outputRoot, lane, fixtures[lane]));
  }
  return summaries;
}

export async function main(argv = process.argv.slice(2)) {
  const outputRoot = argv[0] ? path.resolve(argv[0]) : DEFAULT_OUTPUT_ROOT;
  const summaries = await seedCanonicalCases({
    lanes: ["waitlist_triage", "support_triage", "preview_diagnosis", "agent_failure_promotion"],
    outputRoot,
  });
  for (const summary of summaries) {
    console.log(`[autoagent-seed] ${summary.lane}: seeded=${summary.seeded} skipped=${summary.skipped}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-seed] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
