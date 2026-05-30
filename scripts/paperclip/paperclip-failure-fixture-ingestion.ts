import {
  buildAutoResearchPromotionQueue,
  buildAutoResearchPromotionQueueMarkdown,
  type AutoResearchPromotionQueueItem,
} from "./autoresearch-promotion-queue.ts";

export const PAPERCLIP_FAILURE_FIXTURE_QUEUE_SCHEMA =
  "blueprint/autoagent-paperclip-failure-fixture-queue/v1";

export type PaperclipFailureIngestionFamily =
  | "repeated_failures"
  | "no_change_churn"
  | "fake_progress"
  | "unsupported_proof"
  | "copy_proof_drift"
  | "retry_loop"
  | "blocked_lane_overreach";

export type PaperclipFailureSignature = {
  key: string;
  title?: string;
  category?: string;
  fixLayer?: string;
  matchedBy?: string;
  blockerId?: string;
};

export type PaperclipFailureCluster = {
  signature: PaperclipFailureSignature;
  count: number;
  stalledCount?: number;
  failedCount?: number;
  timedOutCount?: number;
  agents?: string[];
  agentKeys?: string[];
  runIds?: string[];
  issueIdentifiers?: string[];
  examples?: Array<{
    runId?: string;
    status?: string;
    agent?: string;
    issueIdentifiers?: string[];
    bestText?: string;
  }>;
};

export type PaperclipFailureSweep = {
  generatedAt?: string;
  paperclipApiUrl?: string | null;
  paperclipApiUrlSource?: string | null;
  paperclipApiTargetNote?: string | null;
  companyId?: string | null;
  inspectedRuns?: number;
  candidateRuns?: number;
  suppressedRecoveredRuns?: number;
  clusters?: PaperclipFailureCluster[];
  suppressedRecoveredClusters?: PaperclipFailureCluster[];
};

export type PaperclipFailureFixtureQueueArtifact = {
  schema: typeof PAPERCLIP_FAILURE_FIXTURE_QUEUE_SCHEMA;
  generated_at: string;
  source_sweeps: Array<{
    generated_at: string | null;
    paperclip_api_url: string | null;
    paperclip_api_url_source: string | null;
    company_id: string | null;
    inspected_runs: number;
    candidate_runs: number;
    queued_clusters: number;
    suppressed_recovered_clusters: number;
  }>;
  no_live_mutation: true;
  suppressed_recovered_clusters_queued: false;
  ingestion_families: PaperclipFailureIngestionFamily[];
  normalized_clusters: Array<{
    source_key: string;
    source_title: string;
    normalized_failure_family: string;
    ingestion_family: PaperclipFailureIngestionFamily;
    count: number;
    run_ids: string[];
    issue_identifiers: string[];
    agents: string[];
  }>;
  queue: AutoResearchPromotionQueueItem[];
};

type AutoResearchCluster = Parameters<typeof buildAutoResearchPromotionQueue>[0]["clusters"][number];

const CANONICAL_FAMILY_BY_SCHEMA: Record<PaperclipFailureIngestionFamily, string> = {
  repeated_failures: "repeated_paperclip_hermes_failure",
  no_change_churn: "no_change_closeout_churn",
  fake_progress: "fake_progress_closeout",
  unsupported_proof: "unsupported_proof_claim",
  copy_proof_drift: "public_copy_proof_drift",
  retry_loop: "retry_loop_without_cooldown",
  blocked_lane_overreach: "blocked_lane_overreach",
};

const TITLE_BY_CANONICAL_FAMILY: Record<string, string> = {
  repeated_paperclip_hermes_failure: "Repeated Paperclip/Hermes failure family",
  no_change_closeout_churn: "No-change closeout churn",
  fake_progress_closeout: "Fake progress closeout",
  unsupported_proof_claim: "Unsupported proof claim without owner-system evidence",
  public_copy_proof_drift: "Public copy/proof drift",
  retry_loop_without_cooldown: "Retry loop without cooldown or reroute",
  blocked_lane_overreach: "Blocked-lane overreach",
};

function asArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function clusterText(cluster: PaperclipFailureCluster) {
  return [
    cluster.signature.key,
    cluster.signature.title,
    cluster.signature.category,
    cluster.signature.fixLayer,
    cluster.signature.matchedBy,
    ...asArray(cluster.examples).map((example) => example.bestText ?? ""),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyCluster(cluster: PaperclipFailureCluster): PaperclipFailureIngestionFamily {
  const text = clusterText(cluster);

  if (
    /\bno[-_\s]?change\b/.test(text)
    || /\bno changed artifact\b/.test(text)
    || /\bno new proof\b/.test(text)
  ) {
    return "no_change_churn";
  }

  if (
    /\bfake progress\b/.test(text)
    || /\bfalse progress\b/.test(text)
    || /\bcompleted movement\b/.test(text)
    || /\bmarked (?:done|complete|completed|succeeded)\b[\s\S]{0,160}\bwithout\b/.test(text)
    || /\b(adapter success|exit zero|status only)\b[\s\S]{0,120}\b(completion|done|succeeded)\b/.test(text)
  ) {
    return "fake_progress";
  }

  if (
    /\bpublic[-_\s]?copy\b/.test(text)
    || /\bcopy\/proof drift\b/.test(text)
    || /\bcopy[-_\s]?proof drift\b/.test(text)
    || /\boperational proof\b[\s\S]{0,120}\bpublic/.test(text)
  ) {
    return "copy_proof_drift";
  }

  if (
    /\bunsupported proof\b/.test(text)
    || /\bunsupported hosted[-_\s]?session proof\b/.test(text)
    || /\bhosted[-_\s]?session proof gap\b/.test(text)
    || /\bowning[-_\s]?system proof\b/.test(text)
    || /\bproof\b[\s\S]{0,120}\bwithout\b[\s\S]{0,80}\b(owner|owning|artifact|evidence)\b/.test(text)
  ) {
    return "unsupported_proof";
  }

  if (
    /\bretry loop\b/.test(text)
    || /\brepeated retr(?:y|ies)\b/.test(text)
    || /\bwithout cooldown\b/.test(text)
    || /\bcooldown\b[\s\S]{0,120}\bmissing\b/.test(text)
    || /\brate limit\b/.test(text)
    || /\bquota\b/.test(text)
    || /\btimeout\b/.test(text)
    || /\bstalled run\b/.test(text)
  ) {
    return "retry_loop";
  }

  if (
    /\bblocked[-_\s]?lane overreach\b/.test(text)
    || /\bhigh[-_\s]?risk candidate\b/.test(text)
    || /\bpermanently[_\s-]?blocked\b[\s\S]{0,160}\b(apply|canary|auto[-_\s]?apply|mutation)\b/.test(text)
    || /\blive mutation attempted\b/.test(text)
    || /\bauto[-_\s]?apply\b[\s\S]{0,160}\boutside\b[\s\S]{0,80}\bsupport[_\s-]?triage\b/.test(text)
  ) {
    return "blocked_lane_overreach";
  }

  return cluster.count >= 2 ? "repeated_failures" : "repeated_failures";
}

function canonicalFamilyForCluster(cluster: PaperclipFailureCluster) {
  const ingestionFamily = classifyCluster(cluster);
  return {
    ingestionFamily,
    normalizedFailureFamily: CANONICAL_FAMILY_BY_SCHEMA[ingestionFamily],
  };
}

function sortedUnique(values: string[]) {
  return unique(values).sort((left, right) => left.localeCompare(right));
}

function aggregateClusters(clusters: PaperclipFailureCluster[]) {
  const aggregated = new Map<string, {
    sourceKeys: string[];
    sourceTitles: string[];
    ingestionFamily: PaperclipFailureIngestionFamily;
    normalizedFailureFamily: string;
    count: number;
    stalledCount: number;
    failedCount: number;
    timedOutCount: number;
    agents: string[];
    agentKeys: string[];
    runIds: string[];
    issueIdentifiers: string[];
    examples: NonNullable<PaperclipFailureCluster["examples"]>;
  }>();

  for (const cluster of clusters) {
    if (!cluster?.signature?.key || !Number.isFinite(cluster.count) || cluster.count <= 0) {
      continue;
    }
    const { ingestionFamily, normalizedFailureFamily } = canonicalFamilyForCluster(cluster);
    const existing = aggregated.get(normalizedFailureFamily);
    if (!existing) {
      aggregated.set(normalizedFailureFamily, {
        sourceKeys: [cluster.signature.key],
        sourceTitles: [cluster.signature.title ?? cluster.signature.key],
        ingestionFamily,
        normalizedFailureFamily,
        count: cluster.count,
        stalledCount: cluster.stalledCount ?? 0,
        failedCount: cluster.failedCount ?? 0,
        timedOutCount: cluster.timedOutCount ?? 0,
        agents: asArray(cluster.agents),
        agentKeys: asArray(cluster.agentKeys),
        runIds: asArray(cluster.runIds),
        issueIdentifiers: asArray(cluster.issueIdentifiers),
        examples: asArray(cluster.examples),
      });
      continue;
    }

    existing.sourceKeys = unique([...existing.sourceKeys, cluster.signature.key]);
    existing.sourceTitles = unique([
      ...existing.sourceTitles,
      cluster.signature.title ?? cluster.signature.key,
    ]);
    existing.count += cluster.count;
    existing.stalledCount += cluster.stalledCount ?? 0;
    existing.failedCount += cluster.failedCount ?? 0;
    existing.timedOutCount += cluster.timedOutCount ?? 0;
    existing.agents = unique([...existing.agents, ...asArray(cluster.agents)]);
    existing.agentKeys = unique([...existing.agentKeys, ...asArray(cluster.agentKeys)]);
    existing.runIds = unique([...existing.runIds, ...asArray(cluster.runIds)]);
    existing.issueIdentifiers = unique([
      ...existing.issueIdentifiers,
      ...asArray(cluster.issueIdentifiers),
    ]);
    existing.examples = [...existing.examples, ...asArray(cluster.examples)].slice(0, 3);
  }

  return [...aggregated.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.normalizedFailureFamily.localeCompare(right.normalizedFailureFamily);
  });
}

function normalizedClusterToAutoResearchCluster(
  cluster: ReturnType<typeof aggregateClusters>[number],
): AutoResearchCluster {
  const sourceTitle = cluster.sourceTitles[0] ?? cluster.normalizedFailureFamily;
  return {
    signature: {
      key: cluster.normalizedFailureFamily,
      title: TITLE_BY_CANONICAL_FAMILY[cluster.normalizedFailureFamily] ?? sourceTitle,
      category:
        cluster.ingestionFamily === "retry_loop"
          ? "runtime_capacity"
          : cluster.ingestionFamily === "blocked_lane_overreach"
            ? "shared_prompt_guardrail"
            : "agent_logic",
      matchedBy: `paperclip-failure-fixture-ingestion:${cluster.ingestionFamily}`,
    },
    count: cluster.count,
    stalledCount: cluster.stalledCount,
    failedCount: cluster.failedCount,
    timedOutCount: cluster.timedOutCount,
    agents: sortedUnique(cluster.agents),
    agentKeys: sortedUnique(cluster.agentKeys),
    runIds: cluster.runIds.slice(0, 12),
    issueIdentifiers: cluster.issueIdentifiers.slice(0, 12),
  };
}

function sourceSweepSummary(sweep: PaperclipFailureSweep) {
  return {
    generated_at: sweep.generatedAt ?? null,
    paperclip_api_url: sweep.paperclipApiUrl ?? null,
    paperclip_api_url_source: sweep.paperclipApiUrlSource ?? null,
    company_id: sweep.companyId ?? null,
    inspected_runs: sweep.inspectedRuns ?? 0,
    candidate_runs: sweep.candidateRuns ?? 0,
    queued_clusters: asArray(sweep.clusters).length,
    suppressed_recovered_clusters: asArray(sweep.suppressedRecoveredClusters).length,
  };
}

function sourceUrlForSweeps(sweeps: PaperclipFailureSweep[]) {
  const urls = unique(sweeps.map((sweep) => sweep.paperclipApiUrl ?? "").filter(Boolean));
  if (urls.length === 0) return "paperclip failure sweep artifact";
  return urls.join(", ");
}

export function buildPaperclipFailureFixtureQueueArtifact(input: {
  generatedAt?: string;
  sweeps: PaperclipFailureSweep[];
  maxItems?: number;
}): PaperclipFailureFixtureQueueArtifact {
  const allClusters = input.sweeps.flatMap((sweep) => asArray(sweep.clusters));
  const aggregated = aggregateClusters(allClusters);
  const autoResearchClusters = aggregated.map(normalizedClusterToAutoResearchCluster);
  const queue = buildAutoResearchPromotionQueue({
    clusters: autoResearchClusters,
    paperclipApiUrl: sourceUrlForSweeps(input.sweeps),
    maxItems: input.maxItems,
  });

  return {
    schema: PAPERCLIP_FAILURE_FIXTURE_QUEUE_SCHEMA,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    source_sweeps: input.sweeps.map(sourceSweepSummary),
    no_live_mutation: true,
    suppressed_recovered_clusters_queued: false,
    ingestion_families: sortedUnique(
      aggregated.map((cluster) => cluster.ingestionFamily),
    ) as PaperclipFailureIngestionFamily[],
    normalized_clusters: aggregated.map((cluster) => ({
      source_key: cluster.sourceKeys.join(", "),
      source_title: cluster.sourceTitles.join("; "),
      normalized_failure_family: cluster.normalizedFailureFamily,
      ingestion_family: cluster.ingestionFamily,
      count: cluster.count,
      run_ids: cluster.runIds.slice(0, 12),
      issue_identifiers: cluster.issueIdentifiers.slice(0, 12),
      agents: sortedUnique(cluster.agentKeys.length > 0 ? cluster.agentKeys : cluster.agents),
    })),
    queue,
  };
}

export function renderPaperclipFailureFixtureQueueMarkdown(
  artifact: PaperclipFailureFixtureQueueArtifact,
) {
  const lines: string[] = [];
  lines.push("# Paperclip Failure Fixture Queue");
  lines.push("");
  lines.push(`- Schema: \`${artifact.schema}\``);
  lines.push(`- Generated at: ${artifact.generated_at}`);
  lines.push(`- No live mutation: ${artifact.no_live_mutation}`);
  lines.push(`- Suppressed recovered clusters queued: ${artifact.suppressed_recovered_clusters_queued}`);
  lines.push(`- Ingestion families: ${artifact.ingestion_families.join(", ") || "none"}`);
  lines.push(`- Queue items: ${artifact.queue.length}`);
  lines.push("");
  lines.push("This artifact is a local fixture-drafting queue. It does not authorize live Paperclip/Hermes mutation, provider calls, sends, payments, Notion writes, Firebase/Firestore writes, Render changes, rights/legal decisions, hosted-session fulfillment, city-live claims, or operational launch claims.");
  lines.push("");
  lines.push("## Source Sweeps");
  lines.push("");
  if (artifact.source_sweeps.length === 0) {
    lines.push("- none");
  } else {
    for (const sweep of artifact.source_sweeps) {
      lines.push(
        `- ${sweep.paperclip_api_url ?? "unknown source"}: inspected=${sweep.inspected_runs} candidates=${sweep.candidate_runs} queued_clusters=${sweep.queued_clusters} suppressed_recovered_clusters=${sweep.suppressed_recovered_clusters}`,
      );
    }
  }
  lines.push("");
  lines.push("## Normalized Families");
  lines.push("");
  if (artifact.normalized_clusters.length === 0) {
    lines.push("- none");
  } else {
    for (const cluster of artifact.normalized_clusters) {
      lines.push(
        `- ${cluster.normalized_failure_family}: family=${cluster.ingestion_family} count=${cluster.count} runs=${cluster.run_ids.join(", ") || "none"} issues=${cluster.issue_identifiers.join(", ") || "none"}`,
      );
    }
  }
  lines.push("");
  lines.push("## AutoResearch Promotion Queue");
  lines.push("");
  lines.push(buildAutoResearchPromotionQueueMarkdown({
    generatedAt: artifact.generated_at,
    paperclipApiUrl: artifact.source_sweeps
      .map((sweep) => sweep.paperclip_api_url)
      .filter((value): value is string => Boolean(value))
      .join(", ") || null,
    queue: artifact.queue,
  }));

  return lines.join("\n");
}
