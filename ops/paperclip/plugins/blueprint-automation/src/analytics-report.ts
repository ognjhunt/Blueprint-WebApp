import type { PluginContext } from "@paperclipai/plugin-sdk";
import { asString, nowIso, writeState } from "./report-helpers.js";

type AnalyticsReportConfig = Record<string, unknown>;

export type AnalyticsOutputProof = {
  issueComment: string;
  outcome: "done";
  data: {
    headline: string;
    cadence: string;
    reportDate: string;
    summaryCount: number;
    findingsCount: number;
    riskCount: number;
    actionCount: number;
    outcome: "done";
  };
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function buildAnalyticsOutputProof(
  ctx: PluginContext,
  _config: AnalyticsReportConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<AnalyticsOutputProof> {
  const payload = params as Record<string, unknown>;
  const reportParams = (payload.params ?? payload) as Record<string, unknown>;

  const cadence = asString(reportParams.cadence) ?? "daily";
  const headline = asString(reportParams.headline) ?? "Analytics Daily Report";
  const summaryBullets = Array.isArray(reportParams.summaryBullets)
    ? (reportParams.summaryBullets as string[])
    : [];
  const workflowFindings = Array.isArray(reportParams.workflowFindings)
    ? (reportParams.workflowFindings as string[])
    : [];
  const risks = Array.isArray(reportParams.risks)
    ? (reportParams.risks as string[])
    : [];
  const recommendedFollowUps = Array.isArray(reportParams.recommendedFollowUps)
    ? (reportParams.recommendedFollowUps as string[])
    : [];
  const reportDate = nowIso();

  const commentLines = [
    `## Analytics ${capitalize(cadence)} Report — ${reportDate}`,
    ``,
    `### ${headline}`,
    ``,
    `#### Summary`,
    ``,
    ...summaryBullets.map((b) => `- ${b}`),
    ``,
    `#### Workflow Findings`,
    ``,
    ...workflowFindings.map((f) => `- ${f}`),
    ``,
    `#### Risks`,
    ``,
    ...risks.map((r) => `- ${r}`),
    ``,
    `#### Recommended Follow-Ups`,
    ``,
    ...recommendedFollowUps.map((f) => `- [ ] ${f}`),
  ];

  const issueComment = commentLines.join("\n");

  await writeState(ctx, companyId, `analytics-${cadence}-latest`, {
    headline,
    cadence,
    reportDate,
    summaryCount: summaryBullets.length,
    findingsCount: workflowFindings.length,
    riskCount: risks.length,
    actionCount: recommendedFollowUps.length,
    outcome: "done",
  });

  return {
    issueComment,
    outcome: "done",
    data: {
      headline,
      cadence,
      reportDate,
      summaryCount: summaryBullets.length,
      findingsCount: workflowFindings.length,
      riskCount: risks.length,
      actionCount: recommendedFollowUps.length,
      outcome: "done",
    },
  };
}
