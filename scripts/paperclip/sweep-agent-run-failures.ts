type HeartbeatRunRecord = {
  id: string;
  agentId: string;
  companyId: string;
  contextSnapshot?: Record<string, unknown> | null;
  createdAt?: string | null;
  error?: string | null;
  errorCode?: string | null;
  finishedAt?: string | null;
  invocationSource?: string | null;
  resultJson?: Record<string, unknown> | null;
  startedAt?: string | null;
  status?: string | null;
  stdoutExcerpt?: string | null;
  stderrExcerpt?: string | null;
  triggerDetail?: string | null;
  updatedAt?: string | null;
};

type AgentRecord = {
  id: string;
  name?: string | null;
  urlKey?: string | null;
  adapterType?: string | null;
};

type IssueRecord = {
  id: string;
  identifier?: string | null;
  title?: string | null;
};

type SignatureCategory =
  | "shared_prompt_guardrail"
  | "route_contract"
  | "auth_or_env"
  | "tooling_gap"
  | "runtime_capacity"
  | "agent_logic"
  | "unknown";

type FailureSignature = {
  key: string;
  title: string;
  category: SignatureCategory;
  fixLayer: string;
  matchedBy: string;
};

type CandidateRun = {
  run: HeartbeatRunRecord;
  agent?: AgentRecord;
  issues: IssueRecord[];
  logText?: string;
  bestText: string;
  signature: FailureSignature;
  stalled: boolean;
};

type Cluster = {
  signature: FailureSignature;
  count: number;
  stalledCount: number;
  failedCount: number;
  timedOutCount: number;
  agents: string[];
  agentKeys: string[];
  runIds: string[];
  issueIdentifiers: string[];
  examples: Array<{
    runId: string;
    status: string;
    agent: string;
    issueIdentifiers: string[];
    bestText: string;
  }>;
};

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID ?? "";
const COMPANY_NAME = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, value);
    index += 1;
  }
  return args;
}

function buildHeaders() {
  const headers = new Headers();
  if (PAPERCLIP_API_KEY) {
    headers.set("Authorization", `Bearer ${PAPERCLIP_API_KEY}`);
  }
  return headers;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${PAPERCLIP_API_URL}${path}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeDateRank(value: string | undefined | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForSignature(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,36}/gi, "<uuid>")
    .replace(/\b[A-Z]{2,10}-\d+\b/g, "<issue>")
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z\b/gi, "<iso_datetime>")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>")
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/\/Users\/\S+/g, "<path>")
    .replace(/"[^"]{12,}"/g, "\"<string>\"")
    .replace(/\b\d+\b/g, "<num>");
}

function compactSnippet(value: string | undefined, maxLength = 220) {
  const normalized = normalizeWhitespace(value ?? "");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function logicalFailureText(run: HeartbeatRunRecord, logText?: string, bestText?: string) {
  return normalizeWhitespace(
    [bestText ?? "", logText ?? "", asString(run.error), asString(run.stderrExcerpt), asString(run.stdoutExcerpt)]
      .filter(Boolean)
      .join("\n"),
  );
}

export function isLogicalFailureSucceededRun(input: {
  run: HeartbeatRunRecord;
  logText?: string;
  bestText?: string;
}) {
  const status = normalizeWhitespace(input.run.status ?? "").toLowerCase();
  if (status !== "succeeded") return false;
  const rawText = logicalFailureText(input.run, input.logText, input.bestText).toLowerCase();
  if (rawText.length === 0) return false;

  return (
    rawText.includes("api call failed after")
    || rawText.includes("rate limit persisted after")
    || rawText.includes("final error: http 429")
    || rawText.includes("final error: http 402")
    || rawText.includes("final error: http 404")
    || rawText.includes("non-retryable client error (http 402). aborting")
    || rawText.includes("non-retryable client error (http 404). aborting")
    || rawText.includes("insufficient credits")
    || rawText.includes("spend limit exceeded")
    || rawText.includes("no endpoints found for")
  );
}

function bestRunText(run: HeartbeatRunRecord, logText?: string) {
  const resultJson = asRecord(run.resultJson);
  return [
    asString(run.error),
    asString(run.errorCode),
    asString(run.stderrExcerpt),
    asString(run.stdoutExcerpt),
    asString(resultJson?.summary),
    asString(resultJson?.message),
    asString(resultJson?.result),
    asString(logText),
  ].find((value) => value && value.trim().length > 0) ?? "";
}

export function classifyFailureSignature(input: {
  run: HeartbeatRunRecord;
  logText?: string;
  bestText?: string;
}) {
  const { run } = input;
  const context = asRecord(run.contextSnapshot);
  const issueBound = Boolean(asString(context?.issueId));
  const sourceText = logicalFailureText(run, input.logText, input.bestText);
  const rawText = normalizeWhitespace(sourceText).toLowerCase();
  const text = normalizeForSignature(sourceText);
  const logicalSucceededFailure = isLogicalFailureSucceededRun(input);

  if (
    logicalSucceededFailure
    && (
      rawText.includes("rate limit exceeded")
      || rawText.includes("rate limit persisted after")
      || rawText.includes("api call failed after")
      || rawText.includes("final error: http 429")
      || rawText.includes("final error: http 402")
      || rawText.includes("insufficient credits")
      || rawText.includes("spend limit exceeded")
    )
  ) {
    return {
      key: "provider_quota_or_rate_limit_marked_succeeded",
      title: "Provider quota/rate-limit failure was recorded as succeeded",
      category: "runtime_capacity" as const,
      fixLayer: "Hermes ladder fallback and run-result mapping",
      matchedBy: "429/rate-limit output in a succeeded run",
    };
  }

  if (
    rawText.includes("rate limit exceeded")
    || rawText.includes("rate limit persisted after")
    || rawText.includes("api call failed after")
    || rawText.includes("final error: http 429")
    || rawText.includes("free-models-per-min")
    || rawText.includes("free-models-per-day-high-balance")
    || rawText.includes("insufficient credits")
    || rawText.includes("spend limit exceeded")
  ) {
    return {
      key: "provider_quota_or_rate_limit",
      title: "Provider quota/rate-limit interrupted the run",
      category: "runtime_capacity" as const,
      fixLayer: "Hermes ladder fallback, provider quota policy, or lane cooldown recovery",
      matchedBy: "429/quota output in run logs",
    };
  }

  if (
    logicalSucceededFailure
    && (
      rawText.includes("no endpoints found for")
      || rawText.includes("non-retryable client error (http 404). aborting")
      || rawText.includes("final error: http 404")
    )
  ) {
    return {
      key: "provider_model_contract_failure_marked_succeeded",
      title: "Invalid provider/model config was recorded as succeeded",
      category: "route_contract" as const,
      fixLayer: "shared Hermes model ladder sanitization and run-result mapping",
      matchedBy: "404/no-endpoints output in a succeeded run",
    };
  }

  if (
    (rawText.includes("jq: error") || rawText.includes(" is not defined at <top-level>") || rawText.includes("[exit 3]"))
    && rawText.includes("jq")
  ) {
    if (rawText.includes("/api/runs") || rawText.includes("recent runs")) {
      return {
        key: issueBound ? "paperclip_runs_probe_invalid_jq_issue_bound" : "paperclip_runs_probe_invalid_jq",
        title: issueBound
          ? "Issue-bound wake widened into /api/runs probing and failed on invalid jq"
          : "Ad hoc /api/runs probing failed on invalid jq",
        category: "shared_prompt_guardrail" as const,
        fixLayer: "shared Paperclip read fallback and issue-scope guardrails",
        matchedBy: "jq parse failure + ad hoc /api/runs probe",
      };
    }
    return {
      key: "invalid_jq_filter",
      title: "Hand-written jq filter failed at runtime",
      category: "shared_prompt_guardrail" as const,
      fixLayer: "shared shell helpers and prompt guardrails",
      matchedBy: "jq parse failure",
    };
  }

  if (rawText.includes("/api/runs")) {
    return {
      key: issueBound ? "paperclip_runs_probe_issue_bound" : "paperclip_runs_probe",
      title: issueBound
        ? "Issue-bound wake widened into unsupported /api/runs probing"
        : "Agent improvised unsupported /api/runs probing",
      category: "route_contract" as const,
      fixLayer: "shared route-contract guidance and deterministic Paperclip readers",
      matchedBy: "/api/runs usage in run output",
    };
  }

  if (
    rawText.includes("401 forbidden")
    || rawText.includes("403 forbidden")
    || rawText.includes("401 unauthorized")
    || rawText.includes("403 unauthorized")
    || rawText.includes("paperclip_api_key is missing")
    || rawText.includes("agent authentication required")
  ) {
    return {
      key: "paperclip_auth_or_env_missing",
      title: "Paperclip auth/env regression blocked the run",
      category: "auth_or_env" as const,
      fixLayer: "env bootstrap and auth fallback policy",
      matchedBy: "401/403 or missing Paperclip auth signal",
    };
  }

  if (
    (normalizeWhitespace(run.status ?? "").toLowerCase() === "queued"
      || normalizeWhitespace(run.status ?? "").toLowerCase() === "running")
    && rawText.length === 0
  ) {
    return {
      key: "stalled_run_without_output",
      title: "Queued or running run produced no useful output",
      category: "runtime_capacity" as const,
      fixLayer: "scheduler, runner, or wakeup monitoring",
      matchedBy: "stalled queued/running run without error text",
    };
  }

  if (
    rawText.includes("issue-bound wake")
    || (issueBound && (rawText.includes("/agents/me/inbox-lite") || rawText.includes("/api/companies/") || rawText.includes("check the inbox")))
  ) {
    return {
      key: "issue_bound_wake_widened_scope",
      title: "Issue-bound wake widened into queue discovery",
      category: "shared_prompt_guardrail" as const,
      fixLayer: "issue-scope runtime guardrails",
      matchedBy: "issue-bound wake plus inbox/queue exploration",
    };
  }

  if (
    rawText.includes("timed out while running")
    || rawText.includes("provider=openrouter")
    || rawText.includes(" via openrouter")
  ) {
    return {
      key: "provider_or_model_timeout",
      title: "Provider or model timeout interrupted the run",
      category: "runtime_capacity" as const,
      fixLayer: "model ladder, timeout policy, or fallback lane",
      matchedBy: "provider/model timeout signal",
    };
  }

  if (rawText.includes("process lost -- server may have restarted")) {
    return {
      key: "process_loss_or_service_restart",
      title: "Agent process was lost during the run",
      category: "runtime_capacity" as const,
      fixLayer: "runner stability and service restart handling",
      matchedBy: "process loss signal",
    };
  }

  if (
    rawText.includes("since i can't directly access notion")
    || rawText.includes("notion drift")
    || rawText.includes("notion-related endpoints")
    || rawText.includes("verify this manually")
  ) {
    return {
      key: "notion_capability_gap_then_manual_probe",
      title: "Notion capability gap triggered manual probing instead of a clean block",
      category: "tooling_gap" as const,
      fixLayer: "Notion tool-path enforcement and clean blocked exits",
      matchedBy: "Notion access gap language in run output",
    };
  }

  if (
    rawText.includes("context length")
    || rawText.includes("maximum context")
    || rawText.includes("prompt is too long")
    || rawText.includes("token limit")
    || rawText.includes("output limit")
  ) {
    return {
      key: "runtime_context_or_output_limit",
      title: "Run hit context or output limits",
      category: "runtime_capacity" as const,
      fixLayer: "session compaction and retry policy",
      matchedBy: "context/output limit signal",
    };
  }

  if (
    rawText.includes("404 not found for /api/")
    || rawText.includes("route not found")
    || rawText.includes("issue not found")
  ) {
    return {
      key: "paperclip_route_contract_mismatch",
      title: "Paperclip route contract mismatch",
      category: "route_contract" as const,
      fixLayer: "canonical route guidance and helper scripts",
      matchedBy: "404/route mismatch signal",
    };
  }

  const fallback = normalizeForSignature(compactSnippet(sourceText, 180)) || normalizeForSignature(asString(run.status) ?? "unknown run failure");
  return {
    key: `generic:${fallback.slice(0, 120) || "unknown"}`,
    title: compactSnippet(sourceText, 90) || "Unclassified run failure",
    category: "unknown" as const,
    fixLayer: "manual inspection",
    matchedBy: "normalized fallback signature",
  };
}

export function clusterRunFailures(runs: CandidateRun[]) {
  const clusters = new Map<string, Cluster>();

  for (const item of runs) {
    const key = item.signature.key;
    const existing = clusters.get(key);
    const agentName = item.agent?.name ?? item.agent?.urlKey ?? item.run.agentId;
    const agentKey = item.agent?.urlKey ?? item.run.agentId;
    const issueIdentifiers = item.issues
      .map((issue) => issue.identifier ?? issue.id)
      .filter((value): value is string => Boolean(value));

    if (!existing) {
      clusters.set(key, {
        signature: item.signature,
        count: 1,
        stalledCount: item.stalled ? 1 : 0,
        failedCount: normalizeWhitespace(item.run.status ?? "") === "failed" ? 1 : 0,
        timedOutCount: normalizeWhitespace(item.run.status ?? "") === "timed_out" ? 1 : 0,
        agents: [agentName],
        agentKeys: [agentKey],
        runIds: [item.run.id],
        issueIdentifiers,
        examples: [
          {
            runId: item.run.id,
            status: item.run.status ?? "unknown",
            agent: agentName,
            issueIdentifiers,
            bestText: compactSnippet(item.bestText, 220),
          },
        ],
      });
      continue;
    }

    existing.count += 1;
    existing.stalledCount += item.stalled ? 1 : 0;
    existing.failedCount += normalizeWhitespace(item.run.status ?? "") === "failed" ? 1 : 0;
    existing.timedOutCount += normalizeWhitespace(item.run.status ?? "") === "timed_out" ? 1 : 0;
    if (!existing.agents.includes(agentName)) existing.agents.push(agentName);
    if (!existing.agentKeys.includes(agentKey)) existing.agentKeys.push(agentKey);
    if (!existing.runIds.includes(item.run.id)) existing.runIds.push(item.run.id);
    for (const identifier of issueIdentifiers) {
      if (!existing.issueIdentifiers.includes(identifier)) {
        existing.issueIdentifiers.push(identifier);
      }
    }
    if (existing.examples.length < 3) {
      existing.examples.push({
        runId: item.run.id,
        status: item.run.status ?? "unknown",
        agent: agentName,
        issueIdentifiers,
        bestText: compactSnippet(item.bestText, 220),
      });
    }
  }

  return [...clusters.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.signature.title.localeCompare(right.signature.title);
  });
}

export function resolveSinceTimestamp(input: {
  since?: string;
  sinceHours?: number | null;
  now?: Date;
}) {
  if (input.sinceHours && Number.isFinite(input.sinceHours) && input.sinceHours > 0) {
    const now = input.now ?? new Date();
    return new Date(now.getTime() - input.sinceHours * 60 * 60 * 1000).toISOString();
  }
  const explicit = asString(input.since);
  if (!explicit) return null;
  const parsed = Date.parse(explicit);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid --since value: ${explicit}`);
  }
  return new Date(parsed).toISOString();
}

function printHelp() {
  console.log(`Usage: npm exec tsx -- scripts/paperclip/sweep-agent-run-failures.ts [options]

Cluster recent Paperclip heartbeat run failures into shared fix families.

Options:
  --company-id <id>         Paperclip company id. Defaults to PAPERCLIP_COMPANY_ID or COMPANY_NAME lookup.
  --agent-id <id>           Limit the sweep to one agent.
  --limit <n>               Max runs to inspect. Default: 250.
  --stalled-minutes <n>     Treat running/queued runs older than this as stalled. Default: 20.
  --since <iso8601>         Only inspect runs created at or after this timestamp.
  --since-hours <n>         Only inspect runs from the last N hours.
  --max-log-bytes <n>       Max log bytes to read per candidate run. Default: 32768.
  --markdown                Output markdown report. Default.
  --json                    Output JSON.
  --help                    Show this message.
`);
}

async function resolveCompanyId(explicitCompanyId?: string) {
  if (explicitCompanyId) return explicitCompanyId;
  if (PAPERCLIP_COMPANY_ID) return PAPERCLIP_COMPANY_ID;
  const companies = await fetchJson<Array<{ id: string; name: string }>>("/api/companies");
  const match = companies.find((company) => company.name === COMPANY_NAME);
  if (!match) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }
  return match.id;
}

function isCandidateRun(run: HeartbeatRunRecord, stalledMinutes: number) {
  const status = normalizeWhitespace(run.status ?? "").toLowerCase();
  if (status === "failed" || status === "timed_out") return { matches: true, stalled: false };
  if (status !== "running" && status !== "queued") return { matches: false, stalled: false };
  const ageMs = Date.now() - Math.max(safeDateRank(run.startedAt), safeDateRank(run.createdAt));
  return { matches: ageMs > stalledMinutes * 60_000, stalled: ageMs > stalledMinutes * 60_000 };
}

async function fetchRunLog(runId: string, maxLogBytes: number) {
  try {
    const payload = await fetchJson<{ content?: string; nextOffset?: number }>(
      `/api/heartbeat-runs/${runId}/log?offset=0&limitBytes=${Math.max(1024, maxLogBytes)}`,
    );
    return asString(payload.content) ?? "";
  } catch {
    return "";
  }
}

async function fetchRunIssues(runId: string) {
  try {
    const issues = await fetchJson<IssueRecord[]>(`/api/heartbeat-runs/${runId}/issues`);
    return Array.isArray(issues) ? issues : [];
  } catch {
    return [];
  }
}

function buildMarkdownReport(input: {
  inspectedRuns: number;
  candidateRuns: number;
  clusters: Cluster[];
  limit: number;
  stalledMinutes: number;
  since?: string | null;
}) {
  const lines: string[] = [];
  lines.push("# Agent Run Failure Sweep");
  lines.push("");
  lines.push(`- Inspected runs: ${input.inspectedRuns}`);
  lines.push(`- Candidate failed/stalled/logical-failure runs: ${input.candidateRuns}`);
  lines.push(`- Failure families: ${input.clusters.length}`);
  lines.push(`- Sweep limit: ${input.limit}`);
  lines.push(`- Stalled threshold: ${input.stalledMinutes} minutes`);
  if (input.since) {
    lines.push(`- Since: ${input.since}`);
  }
  lines.push("");

  if (input.clusters.length === 0) {
    lines.push("No failed, stalled, or logical-failure runs matched the sweep window.");
    return lines.join("\n");
  }

  lines.push("## Top Families");
  lines.push("");
  lines.push("| Family | Count | Agents | Category | Fix layer |");
  lines.push("| --- | ---: | --- | --- | --- |");
  for (const cluster of input.clusters) {
    lines.push(
      `| ${cluster.signature.title} | ${cluster.count} | ${cluster.agentKeys.join(", ")} | ${cluster.signature.category} | ${cluster.signature.fixLayer} |`,
    );
  }

  for (const cluster of input.clusters) {
    lines.push("");
    lines.push(`## ${cluster.signature.title}`);
    lines.push("");
    lines.push(`- Signature key: \`${cluster.signature.key}\``);
    lines.push(`- Count: ${cluster.count}`);
    lines.push(`- Category: ${cluster.signature.category}`);
    lines.push(`- Fix layer: ${cluster.signature.fixLayer}`);
    lines.push(`- Matched by: ${cluster.signature.matchedBy}`);
    lines.push(`- Affected agents: ${cluster.agentKeys.join(", ")}`);
    if (cluster.issueIdentifiers.length > 0) {
      lines.push(`- Related issues: ${cluster.issueIdentifiers.slice(0, 10).join(", ")}`);
    }
    lines.push("- Example runs:");
    for (const example of cluster.examples) {
      lines.push(
        `  - ${example.runId} | ${example.agent} | ${example.status}${example.issueIdentifiers.length > 0 ? ` | ${example.issueIdentifiers.join(", ")}` : ""} | ${example.bestText}`,
      );
    }
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.get("help") === "true") {
    printHelp();
    return;
  }

  const limit = Math.max(1, Math.min(1000, Number.parseInt(args.get("limit") ?? "250", 10) || 250));
  const stalledMinutes = Math.max(1, Number.parseInt(args.get("stalled-minutes") ?? "20", 10) || 20);
  const sinceHoursRaw = args.get("since-hours");
  const sinceHours =
    sinceHoursRaw && Number.isFinite(Number.parseFloat(sinceHoursRaw))
      ? Number.parseFloat(sinceHoursRaw)
      : null;
  const maxLogBytes = Math.max(1024, Number.parseInt(args.get("max-log-bytes") ?? "32768", 10) || 32768);
  const agentId = args.get("agent-id");
  const json = args.get("json") === "true";
  const companyId = await resolveCompanyId(args.get("company-id"));
  const since = resolveSinceTimestamp({
    since: args.get("since"),
    sinceHours,
  });

  const [runs, agents] = await Promise.all([
    fetchJson<HeartbeatRunRecord[]>(
      `/api/companies/${companyId}/heartbeat-runs?limit=${limit}${agentId ? `&agentId=${encodeURIComponent(agentId)}` : ""}`,
    ),
    fetchJson<AgentRecord[]>(`/api/companies/${companyId}/agents`),
  ]);

  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const relevantRuns = (Array.isArray(runs) ? runs : [])
    .slice()
    .sort((left, right) => safeDateRank(right.createdAt) - safeDateRank(left.createdAt));
  const filteredRuns = since
    ? relevantRuns.filter((run) => safeDateRank(run.createdAt) >= safeDateRank(since))
    : relevantRuns;

  const candidates: CandidateRun[] = [];
  for (const run of filteredRuns) {
    const candidate = isCandidateRun(run, stalledMinutes);
    const status = normalizeWhitespace(run.status ?? "").toLowerCase();
    const shouldInspectSucceededRun = status === "succeeded";
    if (!candidate.matches && !shouldInspectSucceededRun) continue;
    const [issues, logText] = await Promise.all([
      fetchRunIssues(run.id),
      fetchRunLog(run.id, maxLogBytes),
    ]);
    const bestText = bestRunText(run, logText);
    const logicalSucceededFailure = isLogicalFailureSucceededRun({ run, logText, bestText });
    if (!candidate.matches && !logicalSucceededFailure) continue;
    candidates.push({
      run,
      agent: agentsById.get(run.agentId),
      issues,
      logText,
      bestText,
      signature: classifyFailureSignature({ run, logText, bestText }),
      stalled: candidate.stalled && !logicalSucceededFailure,
    });
  }

  const clusters = clusterRunFailures(candidates);

  if (json) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
        companyId,
      inspectedRuns: filteredRuns.length,
      candidateRuns: candidates.length,
      limit,
      stalledMinutes,
      since,
      clusters,
    }, null, 2));
    return;
  }

  console.log(buildMarkdownReport({
    inspectedRuns: filteredRuns.length,
    candidateRuns: candidates.length,
    clusters,
    limit,
    stalledMinutes,
    since,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
