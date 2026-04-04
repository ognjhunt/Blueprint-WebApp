import fs from "node:fs/promises";
import path from "node:path";

type ExportLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
type DatasetSplit = "dev" | "holdout";

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
    lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
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
