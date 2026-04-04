import type { PluginContext } from "@paperclipai/plugin-sdk";
import { asString, nowIso, writeState } from "./report-helpers.js";

type MarketIntelReportConfig = Record<string, unknown>;

export type MarketIntelOutputProof = {
  issueComment: string;
  outcome: "done";
  data: {
    headline: string;
    signalCount: number;
    competitorCount: number;
    techFindingCount: number;
    actionCount: number;
    reportDate: string;
    cadence: string;
  };
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function buildMarketIntelOutputProof(
  ctx: PluginContext,
  _config: MarketIntelReportConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<MarketIntelOutputProof> {
  const payload = params as Record<string, unknown>;
  const reportParams = (payload.params ?? payload) as Record<string, unknown>;

  const headline = asString(reportParams.headline) ?? "Market Intelligence Report";
  const cadence = asString(reportParams.cadence) ?? "weekly";
  const signals = Array.isArray(reportParams.signals) ? reportParams.signals : [];
  const competitorUpdates = Array.isArray(reportParams.competitorUpdates) ? reportParams.competitorUpdates : [];
  const technologyFindings = Array.isArray(reportParams.technologyFindings) ? reportParams.technologyFindings : [];
  const recommendedActions = Array.isArray(reportParams.recommendedActions) ? reportParams.recommendedActions : [];
  const sourcesAnalyzed = Array.isArray(reportParams.sourcesAnalyzed) ? reportParams.sourcesAnalyzed : [];
  const reportDate = asString(reportParams.reportDate) ?? nowIso();

  const commentLines = [
    `## Market Intel ${capitalize(cadence)} Report — ${reportDate}`,
    ``,
    `### ${headline}`,
    ``,
    `#### Signals (${signals.length})`,
  ];

  for (const s of signals as Array<Record<string, unknown>>) {
    const relevance = s.relevance ?? "?";
    commentLines.push(`- **${s.title}** (relevance: ${relevance}/10) — ${s.summary ?? ""}`);
    if (s.source) commentLines.push(`  Source: ${s.source} | ${s.date ?? ""}`);
  }

  commentLines.push(``, `#### Competitor Updates (${competitorUpdates.length})`);
  for (const c of competitorUpdates as Array<Record<string, unknown>>) {
    commentLines.push(`- **${c.company}** [${c.threatLevel ?? "unknown"}]: ${c.update ?? ""}`);
  }

  commentLines.push(``, `#### Technology Findings (${technologyFindings.length})`);
  for (const t of technologyFindings as Array<Record<string, unknown>>) {
    commentLines.push(`- **${t.title}** (relevance: ${t.relevance ?? "?"}/10) — ${t.summary ?? ""}`);
  }

  commentLines.push(``, `#### Recommended Actions (${recommendedActions.length})`);
  for (const a of recommendedActions as Array<Record<string, unknown>>) {
    commentLines.push(`- [${a.priority ?? "medium"}] ${a.action} — ${a.rationale ?? ""}`);
  }

  commentLines.push(``, `#### Sources Analyzed`);
  for (const s of sourcesAnalyzed as string[]) {
    commentLines.push(`- ${s}`);
  }

  const issueComment = commentLines.join("\n");

  await writeState(ctx, companyId, `market-intel-${cadence}-latest`, {
    headline,
    cadence,
    reportDate,
    signalCount: signals.length,
    competitorCount: competitorUpdates.length,
    techFindingCount: technologyFindings.length,
    actionCount: recommendedActions.length,
    sourceCount: sourcesAnalyzed.length,
    outcome: "done",
    comment: issueComment,
  });

  return {
    issueComment,
    outcome: "done",
    data: {
      headline,
      signalCount: signals.length,
      competitorCount: competitorUpdates.length,
      techFindingCount: technologyFindings.length,
      actionCount: recommendedActions.length,
      reportDate,
      cadence,
    },
  };
}
