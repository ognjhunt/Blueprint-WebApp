type IssueSummary = {
  id: string;
  identifier?: string | null;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  parentId?: string | null;
  updatedAt?: string | null;
  activeRun?: unknown;
};

type InboxLiteIssue = IssueSummary;

type HeartbeatContext = {
  issue: {
    id: string;
    identifier?: string | null;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    projectId?: string | null;
    goalId?: string | null;
    parentId?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    updatedAt?: string | null;
  };
  ancestors?: Array<{
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    priority: string;
  }>;
  project?: {
    id: string;
    name: string;
    status?: string | null;
    targetDate?: string | null;
  } | null;
  goal?: {
    id: string;
    title: string;
    status?: string | null;
    level?: string | null;
    parentId?: string | null;
  } | null;
  commentCursor?: unknown;
  wakeComment?: unknown;
};

type Company = {
  id: string;
  name: string;
};

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID ?? null;
const PAPERCLIP_AGENT_ID = process.env.PAPERCLIP_AGENT_ID ?? null;
const PAPERCLIP_TASK_ID = process.env.PAPERCLIP_TASK_ID ?? null;
const COMPANY_NAME = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";

function printHelp() {
  console.log(`Usage: npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts [options]

Read-only Paperclip heartbeat helper for Blueprint agents.

Options:
  --assigned-open          List assigned open issues. Tries /agents/me/inbox-lite first.
  --open                   List open issues for the current company.
  --issue-id <id>          Read one issue by UUID or identifier.
  --heartbeat-context      Read compact heartbeat context for --issue-id or PAPERCLIP_TASK_ID.
  --agent-id <id>          Override PAPERCLIP_AGENT_ID for --assigned-open fallback filtering.
  --limit <n>              Maximum rows to print for list modes. Default: 20.
  --plain                  Print concise human-readable output.
  --json                   Print normalized JSON output.
  --help                   Show this message.

Examples:
  npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain
  npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --issue-id "$PAPERCLIP_TASK_ID" --plain
  npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --heartbeat-context --issue-id "$PAPERCLIP_TASK_ID" --plain`);
}

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

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildHeaders() {
  const headers = new Headers();
  if (PAPERCLIP_API_KEY) {
    headers.set("Authorization", `Bearer ${PAPERCLIP_API_KEY}`);
  }
  return headers;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatIssueLine(issue: IssueSummary) {
  const identifier = issue.identifier ?? issue.id;
  const status = issue.status.padStart(12);
  const priority = issue.priority.padStart(8);
  return `${identifier} ${status} ${priority} ${issue.title}`;
}

function printIssueList(heading: string, issues: IssueSummary[], limit: number) {
  console.log(heading);
  const visible = issues.slice(0, limit);
  if (visible.length === 0) {
    console.log("No matching issues.");
    return;
  }
  for (const issue of visible) {
    console.log(formatIssueLine(issue));
  }
  if (issues.length > visible.length) {
    console.log(`... ${issues.length - visible.length} more`);
  }
}

function printIssueDetail(issue: IssueSummary) {
  console.log(formatIssueLine(issue));
  if (issue.updatedAt) {
    console.log(`updatedAt ${issue.updatedAt}`);
  }
  if (issue.assigneeAgentId) {
    console.log(`assigneeAgentId ${issue.assigneeAgentId}`);
  }
  if (issue.projectId) {
    console.log(`projectId ${issue.projectId}`);
  }
  if (issue.goalId) {
    console.log(`goalId ${issue.goalId}`);
  }
}

function printHeartbeatContext(context: HeartbeatContext) {
  printIssueDetail(context.issue);
  if (asArray(context.ancestors).length > 0) {
    console.log("ancestors");
    for (const ancestor of asArray<NonNullable<HeartbeatContext["ancestors"]>[number]>(context.ancestors)) {
      console.log(`- ${ancestor.identifier ?? ancestor.id} ${ancestor.status} ${ancestor.title}`);
    }
  }
  if (context.project) {
    console.log(`project ${context.project.name} (${context.project.status ?? "unknown"})`);
  }
  if (context.goal) {
    console.log(`goal ${context.goal.title} (${context.goal.status ?? "unknown"})`);
  }
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

async function tryInboxLite(): Promise<InboxLiteIssue[] | null> {
  if (!PAPERCLIP_API_KEY) return null;
  const response = await fetch(`${PAPERCLIP_API_URL}/api/agents/me/inbox-lite`, {
    headers: buildHeaders(),
  });
  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for /api/agents/me/inbox-lite`);
  }
  return response.json() as Promise<InboxLiteIssue[]>;
}

async function resolveCompanyId(): Promise<string> {
  if (PAPERCLIP_COMPANY_ID) return PAPERCLIP_COMPANY_ID;
  const companies = await fetchJson<Company[]>("/api/companies");
  const match = companies.find((company) => company.name === COMPANY_NAME);
  if (!match) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }
  return match.id;
}

function buildListPayload(issues: IssueSummary[], kind: string, limit: number, agentId?: string | null) {
  return {
    generatedAt: new Date().toISOString(),
    kind,
    limit,
    agentId: agentId ?? null,
    count: issues.length,
    issues: issues.slice(0, limit).map((issue) => ({
      id: issue.id,
      identifier: issue.identifier ?? null,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId ?? null,
      projectId: issue.projectId ?? null,
      goalId: issue.goalId ?? null,
      parentId: issue.parentId ?? null,
      updatedAt: issue.updatedAt ?? null,
    })),
  };
}

async function listAssignedOpen(agentId: string | null, limit: number, plain: boolean, json: boolean) {
  const inboxLite = await tryInboxLite();
  if (inboxLite) {
    if (json || !plain) {
      console.log(JSON.stringify(buildListPayload(inboxLite, "assigned_open", limit, PAPERCLIP_AGENT_ID), null, 2));
      return;
    }
    printIssueList("Assigned open issues (inbox-lite)", inboxLite, limit);
    return;
  }

  const resolvedAgentId = agentId ?? PAPERCLIP_AGENT_ID;
  if (!resolvedAgentId) {
    throw new Error("--agent-id is required when inbox-lite is unavailable and PAPERCLIP_AGENT_ID is unset");
  }
  const companyId = await resolveCompanyId();
  const issues = await fetchJson<IssueSummary[]>(`/api/companies/${companyId}/issues`);
  const assignedIssues = issues.filter(
    (issue) => issue.assigneeAgentId === resolvedAgentId && !["done", "cancelled"].includes(issue.status),
  );
  if (json || !plain) {
    console.log(JSON.stringify(buildListPayload(assignedIssues, "assigned_open_fallback", limit, resolvedAgentId), null, 2));
    return;
  }
  printIssueList(`Assigned open issues for ${resolvedAgentId}`, assignedIssues, limit);
}

async function listOpen(limit: number, plain: boolean, json: boolean) {
  const companyId = await resolveCompanyId();
  const issues = await fetchJson<IssueSummary[]>(`/api/companies/${companyId}/issues`);
  const openIssues = issues.filter((issue) => !["done", "cancelled"].includes(issue.status));
  if (json || !plain) {
    console.log(JSON.stringify(buildListPayload(openIssues, "open", limit), null, 2));
    return;
  }
  printIssueList("Open issues", openIssues, limit);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.get("help") === "true") {
    printHelp();
    return;
  }

  const assignedOpen = args.get("assigned-open") === "true";
  const openOnly = args.get("open") === "true";
  const heartbeatContext = args.get("heartbeat-context") === "true";
  const plain = args.get("plain") === "true";
  const json = args.get("json") === "true";
  const limit = asPositiveInt(args.get("limit"), 20);
  const agentId = args.get("agent-id") ?? null;
  const issueId = args.get("issue-id") ?? PAPERCLIP_TASK_ID;

  if (heartbeatContext) {
    if (!issueId) {
      throw new Error("--heartbeat-context requires --issue-id or PAPERCLIP_TASK_ID");
    }
    const context = await fetchJson<HeartbeatContext>(`/api/issues/${issueId}/heartbeat-context`);
    if (json || !plain) {
      console.log(JSON.stringify(context, null, 2));
      return;
    }
    printHeartbeatContext(context);
    return;
  }

  if (issueId && !assignedOpen && !openOnly) {
    const issue = await fetchJson<IssueSummary>(`/api/issues/${issueId}`);
    if (json || !plain) {
      console.log(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            kind: "issue",
            issue: {
              id: issue.id,
              identifier: issue.identifier ?? null,
              title: issue.title,
              status: issue.status,
              priority: issue.priority,
              assigneeAgentId: issue.assigneeAgentId ?? null,
              projectId: issue.projectId ?? null,
              goalId: issue.goalId ?? null,
              parentId: issue.parentId ?? null,
              updatedAt: issue.updatedAt ?? null,
            },
          },
          null,
          2,
        ),
      );
      return;
    }
    printIssueDetail(issue);
    return;
  }

  if (assignedOpen) {
    await listAssignedOpen(agentId, limit, plain, json);
    return;
  }

  if (openOnly) {
    await listOpen(limit, plain, json);
    return;
  }

  printHelp();
}

await main();
