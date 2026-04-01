import { pathToFileURL } from "node:url";

type Company = { id: string; name: string };
type Agent = { id: string; name?: string | null; urlKey?: string | null };
type Issue = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  project?: { name?: string | null } | null;
};

type RouteDecision = {
  assigneeKey: string;
  rationale: string;
  comment: string;
  status?: "todo";
};

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
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

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function inferChiefOfStaffRoute(issue: Pick<Issue, "title" | "status" | "project">): RouteDecision | null {
  const title = normalize(issue.title);
  const projectName = normalize(issue.project?.name);

  const route = (assigneeKey: string, rationale: string): RouteDecision => ({
    assigneeKey,
    rationale,
    status: issue.status === "backlog" ? "todo" : undefined,
    comment: `Deterministic chief-of-staff routing moved this issue to ${assigneeKey} because ${rationale}.`,
  });

  if (title.includes("notion drift") || title.startsWith("notion work queue:") || title.includes("founder os") || title.includes("blueprint hub")) {
    return route("notion-manager-agent", "the issue is about Blueprint-managed Notion structure or workspace drift");
  }
  if (title.startsWith("stripe:") || /payout|refund|dispute|support ticket|support:/i.test(issue.title)) {
    return route("finance-support-agent", "the issue is a finance or support operations thread");
  }
  if (title.includes("city launch")) {
    return route("city-launch-agent", "the issue is a city-specific launch planning thread");
  }
  if (title.includes("market intel")) {
    return route("market-intel-agent", "the issue is market research or competitor signal work");
  }
  if (title.includes("supply intel")) {
    return route("supply-intel-agent", "the issue is supply-side research or capturer-market signal work");
  }
  if (title.includes("demand intel")) {
    return route("demand-intel-agent", "the issue is buyer demand research or proof signal work");
  }
  if (title.includes("capturer growth")) {
    return route("capturer-growth-agent", "the issue is capturer acquisition or supply growth work");
  }
  if (title.includes("security procurement") || title.includes("security questionnaire") || title.includes("procurement")) {
    return route("security-procurement-agent", "the issue is a buyer security or procurement review thread");
  }
  if (title.includes("solutions engineering") || title.includes("proof pack") || title.includes("hosted-evaluation") || title.includes("delivery review")) {
    return route("solutions-engineering-agent", "the issue is a technical buyer enablement or delivery thread");
  }
  if (title.includes("ci failure") || title.includes("branch drift")) {
    if (projectName.includes("webapp")) return route("webapp-codex", "the issue is a Blueprint-WebApp engineering execution thread");
    if (projectName.includes("pipeline")) return route("pipeline-codex", "the issue is a BlueprintCapturePipeline engineering execution thread");
    if (projectName.includes("capture")) return route("capture-codex", "the issue is a BlueprintCapture engineering execution thread");
  }
  if (projectName.includes("executive")) {
    return route("ops-lead", "the issue lives in executive ops and lacks a more specific specialist match");
  }

  return null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PAPERCLIP_API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issueId = args.get("issue-id");
  const apply = args.get("apply") === "true";

  if (!issueId) {
    throw new Error("--issue-id is required");
  }

  const companies = await fetchJson<Company[]>("/api/companies");
  const company = companies.find((entry) => entry.name === COMPANY_NAME);
  if (!company) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }

  const [issue, agents] = await Promise.all([
    fetchJson<Issue>(`/api/issues/${issueId}`),
    fetchJson<Agent[]>(`/api/companies/${company.id}/agents`),
  ]);

  const route = inferChiefOfStaffRoute(issue);
  if (!route) {
    console.log(JSON.stringify({ issueId, routed: false, reason: "no deterministic route matched" }, null, 2));
    return;
  }

  const assignee = agents.find((agent) => normalize(agent.urlKey) === route.assigneeKey);
  if (!assignee) {
    throw new Error(`Agent not found for route key: ${route.assigneeKey}`);
  }

  const alreadyAssigned = issue.assigneeAgentId === assignee.id;

  if (apply && !alreadyAssigned) {
    await fetchJson(`/api/issues/${issue.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        assigneeAgentId: assignee.id,
        ...(route.status ? { status: route.status } : {}),
        comment: route.comment,
      }),
    });
  }

  console.log(
    JSON.stringify(
      {
        issueId,
        routed: true,
        apply,
        alreadyAssigned,
        assigneeKey: route.assigneeKey,
        assigneeAgentId: assignee.id,
        rationale: route.rationale,
        comment: route.comment,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
