// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildKpiLiveSourceStatusReport,
  renderKpiLiveSourceStatusMarkdown,
  type KpiLiveSourceSnapshot,
} from "../utils/kpiLiveSourceStatus";

const generatedAt = "2026-05-30T12:00:00.000Z";

function rowMap(snapshot: KpiLiveSourceSnapshot) {
  const report = buildKpiLiveSourceStatusReport(snapshot);
  return Object.fromEntries(report.rows.map((row) => [row.key, row]));
}

describe("KPI live-source status contracts", () => {
  it("keeps missing live sources as Source needed and suppresses claimed values", () => {
    const rows = rowMap({
      generatedAt,
      rows: [
        {
          key: "revenue_payments",
          label: "Revenue / payments",
          claimedValue: "$12,000",
        },
      ],
      sources: {},
    });

    expect(rows.revenue_payments.status).toBe("Source needed");
    expect(rows.revenue_payments.reportableValue).toBeNull();
    expect(rows.revenue_payments.suppressedClaim).toBe("$12,000");
    expect(rows.revenue_payments.sourceNeededReasons).toEqual(
      expect.arrayContaining([
        "missing_source:stripeEvents",
        "missing_source:checkoutSessions",
        "stripe_payment_source_missing",
        "unsupported_metric_claim",
      ]),
    );
  });

  it("fails closed when the only source is stale", () => {
    const rows = rowMap({
      generatedAt,
      rows: [
        {
          key: "contacts",
          label: "Contacts",
          claimedValue: 4,
        },
      ],
      sources: {
        inboundRequests: [
          {
            id: "old-contact",
            updatedAtIso: "2026-05-01T12:00:00.000Z",
            fields: {
              requestId: "old-contact",
              contact: {
                email_normalized: "old@example.test",
              },
            },
          },
        ],
      },
    });

    expect(rows.contacts.status).toBe("Source needed");
    expect(rows.contacts.reportableValue).toBeNull();
    expect(rows.contacts.sourceNeededReasons).toContain("inboundRequests:stale_source");
  });

  it("does not turn unsupported metric claims into truth", () => {
    const rows = rowMap({
      generatedAt,
      rows: [
        {
          key: "ci_failures",
          label: "CI failures",
          claimedValue: 2,
          claimText: "A report says CI is failing.",
        },
      ],
      sources: {
        paperclipIssues: [
          {
            id: "generic-paperclip-note",
            updatedAtIso: "2026-05-30T11:00:00.000Z",
            fields: {
              status: "todo",
              title: "CI may be red",
            },
          },
        ],
      },
    });

    expect(rows.ci_failures.status).toBe("Source needed");
    expect(rows.ci_failures.reportableValue).toBeNull();
    expect(rows.ci_failures.sourceNeededReasons).toEqual(
      expect.arrayContaining([
        "missing_source:githubWorkflowRuns",
        "paperclipIssues:missing_required_fields:sourceId,issueId",
        "unsupported_metric_claim",
      ]),
    );
  });

  it("blocks hosted-session proof drift when hosted starts lack runtime/session evidence", () => {
    const rows = rowMap({
      generatedAt,
      rows: [
        {
          key: "hosted_starts",
          label: "Hosted starts",
          claimedValue: 1,
        },
      ],
      sources: {
        operatingGraphEvents: [
          {
            id: "text-only-hosted-start",
            updatedAtIso: "2026-05-30T11:30:00.000Z",
            fields: {
              entity_type: "hosted_review_run",
              entity_id: "hosted_review_run:req-1",
              stage: "hosted_review_started",
              source_kind: "sample_text",
              recorded_at_iso: "2026-05-30T11:30:00.000Z",
              summary: "Sample copy says the review started.",
              metadata: {
                package_id: "package-1",
              },
            },
          },
        ],
      },
    });

    expect(rows.hosted_starts.status).toBe("Source needed");
    expect(rows.hosted_starts.reportableValue).toBeNull();
    expect(rows.hosted_starts.sourceNeededReasons).toEqual(
      expect.arrayContaining([
        "missing_source:hostedSessions",
        "hosted_session_proof_drift",
        "unsupported_metric_claim",
      ]),
    );
    expect(rows.hosted_starts.blockedLiveSources.join("\n")).toContain("hostedSessions");
  });

  it("accepts hosted starts only when runtime/session evidence is present and correlated", () => {
    const rows = rowMap({
      generatedAt,
      rows: [
        {
          key: "hosted_starts",
          label: "Hosted starts",
          claimedValue: 1,
        },
      ],
      sources: {
        hostedSessions: [
          {
            id: "session-1",
            updatedAtIso: "2026-05-30T11:15:00.000Z",
            fields: {
              sessionId: "session-1",
              status: "running",
              updatedAt: "2026-05-30T11:15:00.000Z",
              runtimeHandle: {
                runtime_base_url: "https://runtime.example.test/session-1"
              }
            },
          },
        ],
        operatingGraphEvents: [
          {
            id: "hosted-start-1",
            updatedAtIso: "2026-05-30T11:16:00.000Z",
            fields: {
              entity_type: "hosted_review_run",
              entity_id: "hosted_review_run:req-1",
              stage: "hosted_review_started",
              source_kind: "hosted_session",
              recorded_at_iso: "2026-05-30T11:16:00.000Z",
              metadata: {
                hosted_session_id: "session-1",
                package_id: "package-1"
              }
            },
          },
        ],
      },
    });

    expect(rows.hosted_starts.status).toBe("Sourced");
    expect(rows.hosted_starts.reportableValue).toBe(1);
    expect(rows.hosted_starts.evidenceRefs).toEqual([
      "hostedSessions/session-1",
      "operatingGraphEvents/hosted-start-1",
    ]);
  });

  it("renders a Notion-mirror-ready artifact without granting write authority", () => {
    const report = buildKpiLiveSourceStatusReport({
      generatedAt,
      rows: [{ key: "revenue_payments", claimedValue: "$10" }],
      sources: {},
    });
    const markdown = renderKpiLiveSourceStatusMarkdown(report);

    expect(report.notionMirror.allowedToWriteNotion).toBe(false);
    expect(markdown).toContain("Notion-mirror-ready");
    expect(markdown).toContain("allowed_to_write_notion: false");
  });
});
