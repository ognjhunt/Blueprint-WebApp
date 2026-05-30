import { describe, expect, it } from "vitest";

import {
  buildPaperclipFailureFixtureQueueArtifact,
  renderPaperclipFailureFixtureQueueMarkdown,
  type PaperclipFailureCluster,
} from "./paperclip-failure-fixture-ingestion.ts";

function cluster(
  key: string,
  title: string,
  bestText: string,
  count = 2,
): PaperclipFailureCluster {
  return {
    signature: {
      key,
      title,
      category: "agent_logic",
      fixLayer: "test fixture",
      matchedBy: "test",
    },
    count,
    failedCount: count,
    agentKeys: ["blueprint-chief-of-staff"],
    runIds: [`run-${key}`],
    issueIdentifiers: [`BLU-${count}`],
    examples: [
      {
        runId: `run-${key}`,
        status: "failed",
        agent: "Blueprint Chief of Staff",
        issueIdentifiers: [`BLU-${count}`],
        bestText,
      },
    ],
  };
}

describe("paperclip failure fixture ingestion", () => {
  it("normalizes real run-failure clusters into offline fixture candidates", () => {
    const artifact = buildPaperclipFailureFixtureQueueArtifact({
      generatedAt: "2026-05-30T12:00:00.000Z",
      sweeps: [
        {
          generatedAt: "2026-05-30T11:55:00.000Z",
          paperclipApiUrl: "https://paperclip.tryblueprint.io",
          paperclipApiUrlSource: "cli --live-host",
          companyId: "company-1",
          inspectedRuns: 50,
          candidateRuns: 7,
          clusters: [
            cluster(
              "agent_no_change_repeat",
              "No-change closeout churn",
              "No changed artifact and no new proof, but the run was marked complete.",
            ),
            cluster(
              "agent_fake_progress",
              "Fake progress closeout",
              "False progress: completed movement was claimed without owner-system evidence.",
            ),
            cluster(
              "agent_unsupported_proof",
              "Unsupported hosted-session proof",
              "Unsupported proof claim without runtime artifact or owning-system evidence.",
            ),
            cluster(
              "agent_copy_proof_drift",
              "Public copy/proof drift",
              "Public-copy polish was treated as operational proof.",
            ),
            cluster(
              "agent_retry_loop",
              "Retry loop",
              "Repeated retries continued without cooldown after provider quota failures.",
            ),
            cluster(
              "agent_blocked_lane",
              "Blocked-lane overreach",
              "High-risk candidate blocked before canary tried to auto-apply outside support_triage.",
            ),
            cluster(
              "agent_repeated_unknown",
              "Repeated unknown failure",
              "The same unknown Paperclip/Hermes run failure repeated twice.",
            ),
          ],
          suppressedRecoveredClusters: [
            cluster(
              "recovered_openrouter_auth",
              "OpenRouter auth recovered",
              "HTTP 401 but later run recovered.",
              1,
            ),
          ],
        },
      ],
    });

    expect(artifact.no_live_mutation).toBe(true);
    expect(artifact.suppressed_recovered_clusters_queued).toBe(false);
    expect(artifact.source_sweeps[0]).toMatchObject({
      inspected_runs: 50,
      candidate_runs: 7,
      queued_clusters: 7,
      suppressed_recovered_clusters: 1,
    });
    expect(artifact.ingestion_families).toEqual([
      "blocked_lane_overreach",
      "copy_proof_drift",
      "fake_progress",
      "no_change_churn",
      "repeated_failures",
      "retry_loop",
      "unsupported_proof",
    ]);
    expect(artifact.normalized_clusters.map((item) => item.normalized_failure_family)).toEqual([
      "blocked_lane_overreach",
      "fake_progress_closeout",
      "no_change_closeout_churn",
      "public_copy_proof_drift",
      "repeated_paperclip_hermes_failure",
      "retry_loop_without_cooldown",
      "unsupported_proof_claim",
    ]);
    expect(artifact.queue.map((item) => item.sourceFailureFamily)).toEqual(
      artifact.normalized_clusters.map((item) => item.normalized_failure_family),
    );
    expect(artifact.queue.every((item) => item.validationCommand)).toBe(true);
    expect(artifact.queue.every((item) => item.proofPaths.includes("https://paperclip.tryblueprint.io"))).toBe(true);
  });

  it("renders the no-mutation boundary in the queue report", () => {
    const artifact = buildPaperclipFailureFixtureQueueArtifact({
      generatedAt: "2026-05-30T12:00:00.000Z",
      sweeps: [
        {
          clusters: [
            cluster(
              "agent_retry_loop",
              "Retry loop",
              "Repeated retries continued without cooldown.",
            ),
          ],
        },
      ],
    });

    const markdown = renderPaperclipFailureFixtureQueueMarkdown(artifact);

    expect(markdown).toContain("No live mutation: true");
    expect(markdown).toContain("fixture-drafting queue");
    expect(markdown).toContain("does not authorize live Paperclip/Hermes mutation");
    expect(markdown).toContain("retry_loop_without_cooldown");
  });
});
