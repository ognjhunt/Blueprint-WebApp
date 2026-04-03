import { pathToFileURL } from "node:url";
import {
  inferChiefOfStaffRoute,
  type ChiefOfStaffRouteDecision as RouteDecision,
} from "../../ops/paperclip/chief-of-staff-routing.js";

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

export { inferChiefOfStaffRoute };

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
