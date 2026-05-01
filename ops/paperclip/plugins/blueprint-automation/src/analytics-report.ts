import type { PluginContext } from "@paperclipai/plugin-sdk";
import { asString, coerceStringArray, nowIso, writeState } from "./report-helpers.js";

type AnalyticsReportConfig = Record<string, unknown>;

export type AnalyticsOutputProof = {
  issueComment: string;
  outcome: "done" | "blocked";
  failureReason?: string;
  data: {
    headline: string;
    cadence: string;
    reportDate: string;
    summaryCount: number;
    findingsCount: number;
    riskCount: number;
    actionCount: number;
    outcome: "done" | "blocked";
    validationErrors?: string[];
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
  const headline = asString(reportParams.headline) ?? "";
  const summaryBullets = coerceStringArray(reportParams.summaryBullets);
  const workflowFindings = coerceStringArray(reportParams.workflowFindings);
  const risks = coerceStringArray(reportParams.risks);
  const recommendedFollowUps = coerceStringArray(reportParams.recommendedFollowUps);
  const reportDate = nowIso();
  const validationErrors: string[] = [];

  if (!headline) {
    validationErrors.push(`Missing headline for ${capitalize(cadence)} analytics report.`);
  }
  if (summaryBullets.length === 0) {
    validationErrors.push("Missing summaryBullets for analytics report.");
  }
  if (workflowFindings.length === 0) {
    validationErrors.push("Missing workflowFindings for analytics report.");
  }
  if (risks.length === 0) {
    validationErrors.push("Missing risks for analytics report.");
  }
  if (recommendedFollowUps.length === 0) {
    validationErrors.push("Missing recommendedFollowUps for analytics report.");
  }

  const commentLines = [
    `## Analytics ${capitalize(cadence)} Report — ${reportDate}`,
    ``,
    `### ${headline || "Analytics Daily Report"}`,
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

  if (validationErrors.length > 0) {
    commentLines.push("", "#### Validation Errors", "", ...validationErrors.map((error) => `- ${error}`));
  }

  const issueComment = commentLines.join("\n");
  const outcome = validationErrors.length === 0 ? "done" : "blocked";

  await writeState(ctx, companyId, `analytics-${cadence}-latest`, {
    headline: headline || "Analytics Daily Report",
    cadence,
    reportDate,
    summaryCount: summaryBullets.length,
    findingsCount: workflowFindings.length,
    riskCount: risks.length,
    actionCount: recommendedFollowUps.length,
    outcome,
    validationErrors,
  });

  return {
    issueComment,
    outcome,
    failureReason: validationErrors.length > 0 ? validationErrors.join(" ") : undefined,
    data: {
      headline: headline || "Analytics Daily Report",
      cadence,
      reportDate,
      summaryCount: summaryBullets.length,
      findingsCount: workflowFindings.length,
      riskCount: risks.length,
      actionCount: recommendedFollowUps.length,
      outcome,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    },
  };
}
