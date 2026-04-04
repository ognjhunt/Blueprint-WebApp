import type { PluginContext } from "@paperclipai/plugin-sdk";
import { asString, coerceStringArray, nowIso, writeState } from "./report-helpers.js";

type FounderReportConfig = Record<string, unknown>;

export type FounderOutputProof = {
  issueComment: string;
  outcome: "done";
  data: {
    headline: string;
    cadence: string;
    reportDate: string;
    doneYesterdayCount: number;
    inMotionTodayCount: number;
    blockedCount: number;
    needsFounderCount: number;
    topRisksCount: number;
    topOpportunitiesCount: number;
  };
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function buildFounderOutputProof(
  ctx: PluginContext,
  _config: FounderReportConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<FounderOutputProof> {
  const payload = params as Record<string, unknown>;
  const reportParams = (payload.params ?? payload) as Record<string, unknown>;

  const headline = asString(reportParams.headline) ?? "Founder Brief";
  const cadence = asString(reportParams.cadence) ?? "morning";
  const doneYesterday = coerceStringArray(reportParams.doneYesterday);
  const inMotionToday = coerceStringArray(reportParams.inMotionToday);
  const blocked = coerceStringArray(reportParams.blocked);
  const needsFounder = coerceStringArray(reportParams.needsFounder);
  const topRisks = coerceStringArray(reportParams.topRisks);
  const topOpportunities = coerceStringArray(reportParams.topOpportunities);
  const reportDate = nowIso();

  const commentLines = [
    `## Founder ${capitalize(cadence)} Brief — ${reportDate}`,
    ``,
    `### ${headline}`,
    ``,
    `#### Done Yesterday (${doneYesterday.length})`,
    ``,
    ...doneYesterday.map((item) => `- ${item}`),
    ``,
    `#### In Motion Today (${inMotionToday.length})`,
    ``,
    ...inMotionToday.map((item) => `- ${item}`),
    ``,
    `#### Blocked (${blocked.length})`,
    ``,
    ...blocked.map((item) => `- ${item}`),
    ``,
    `#### Needs Founder (${needsFounder.length})`,
    ``,
    ...needsFounder.map((item) => `- ${item}`),
    ``,
    `#### Top Risks (${topRisks.length})`,
    ``,
    ...topRisks.map((item) => `- ${item}`),
    ``,
    `#### Top Opportunities (${topOpportunities.length})`,
    ``,
    ...topOpportunities.map((item) => `- ${item}`),
  ];

  const issueComment = commentLines.join("\n");

  await writeState(ctx, companyId, `founder-${cadence}-latest`, {
    headline,
    cadence,
    reportDate,
    doneYesterdayCount: doneYesterday.length,
    inMotionTodayCount: inMotionToday.length,
    blockedCount: blocked.length,
    needsFounderCount: needsFounder.length,
    topRisksCount: topRisks.length,
    topOpportunitiesCount: topOpportunities.length,
    doneYesterday,
    inMotionToday,
    blocked,
    needsFounder,
    topRisks,
    topOpportunities,
    outcome: "done",
  });

  return {
    issueComment,
    outcome: "done",
    data: {
      headline,
      cadence,
      reportDate,
      doneYesterdayCount: doneYesterday.length,
      inMotionTodayCount: inMotionToday.length,
      blockedCount: blocked.length,
      needsFounderCount: needsFounder.length,
      topRisksCount: topRisks.length,
      topOpportunitiesCount: topOpportunities.length,
    },
  };
}
