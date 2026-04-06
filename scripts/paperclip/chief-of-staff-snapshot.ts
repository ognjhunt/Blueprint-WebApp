type Issue = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  originKind?: string | null;
  updatedAt?: string | null;
  identifier?: string | null;
};

type Routine = {
  id: string;
  title: string;
  status: string;
  triggers?: Array<{ kind?: string | null; enabled?: boolean | null }>;
};

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const COMPANY_NAME = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";
const CHIEF_OF_STAFF_AGENT_KEY = "blueprint-chief-of-staff";
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_AGENT_ID = process.env.PAPERCLIP_AGENT_ID;

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

function formatIssueLine(issue: Issue) {
  const identifier = issue.identifier ?? issue.id;
  const status = issue.status.padStart(12);
  const priority = issue.priority.padStart(8);
  return `${identifier} ${status} ${priority} ${issue.title}`;
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

function buildListPayload(issues: Issue[], kind: "assigned_open" | "open", limit: number, agentId?: string | null) {
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
      updatedAt: issue.updatedAt ?? null,
    })),
  };
}

function printIssueList(heading: string, issues: Issue[], limit: number) {
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

function printIssueDetail(issue: Issue) {
  console.log(formatIssueLine(issue));
  if (issue.updatedAt) {
    console.log(`updatedAt ${issue.updatedAt}`);
  }
  if (issue.assigneeAgentId) {
    console.log(`assigneeAgentId ${issue.assigneeAgentId}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assignedOpen = args.get("assigned-open") === "true";
  const openOnly = args.get("open") === "true";
  const issueId = args.get("issue-id");
  const json = args.get("json") === "true";
  const plain = args.get("plain") === "true";
  const limit = asPositiveInt(args.get("limit"), 20);

  if (issueId) {
    const issue = await fetchJson<Issue>(`/api/issues/${issueId}`);
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
              originKind: issue.originKind ?? null,
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

  const companies = await fetchJson<Array<{ id: string; name: string }>>("/api/companies");
  const company = companies.find((entry) => entry.name === COMPANY_NAME);
  if (!company) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }

  if (assignedOpen || openOnly) {
    const issues = await fetchJson<Issue[]>(`/api/companies/${company.id}/issues`);
    const openIssues = issues.filter((issue) => !["done", "cancelled"].includes(issue.status));

    if (assignedOpen) {
      const agentId = args.get("agent-id") ?? PAPERCLIP_AGENT_ID;
      if (!agentId) {
        throw new Error("--agent-id is required when PAPERCLIP_AGENT_ID is unavailable");
      }
      const assignedIssues = openIssues.filter((issue) => issue.assigneeAgentId === agentId);
      if (json || !plain) {
        console.log(JSON.stringify(buildListPayload(assignedIssues, "assigned_open", limit, agentId), null, 2));
        return;
      }
      printIssueList(`Assigned open issues for ${agentId}`, assignedIssues, limit);
      return;
    }

    if (json || !plain) {
      console.log(JSON.stringify(buildListPayload(openIssues, "open", limit), null, 2));
      return;
    }
    printIssueList(`Open issues in ${company.name}`, openIssues, limit);
    return;
  }

  const [agents, issues, routines] = await Promise.all([
    fetchJson<Array<{ id: string; urlKey?: string | null; name?: string | null }>>(`/api/companies/${company.id}/agents`),
    fetchJson<Issue[]>(`/api/companies/${company.id}/issues`),
    fetchJson<Routine[]>(`/api/companies/${company.id}/routines`),
  ]);

  const chiefOfStaff = agents.find((agent) => agent.urlKey === CHIEF_OF_STAFF_AGENT_KEY);
  const openIssues = issues.filter((issue) => !["done", "cancelled"].includes(issue.status));
  const blockedIssues = openIssues.filter((issue) => issue.status === "blocked");
  const assignedToChiefOfStaff = chiefOfStaff
    ? openIssues.filter((issue) => issue.assigneeAgentId === chiefOfStaff.id)
    : [];
  const unassignedActive = openIssues.filter((issue) => !issue.assigneeAgentId);
  const routineExecution = openIssues.filter((issue) => issue.originKind === "routine_execution");
  const duplicateTitles = new Set(
    routines
      .map((routine) => routine.title)
      .filter((title, _, all) => all.filter((value) => value === title).length > 1),
  );

  const enabledScheduleCount = (routine: Routine) =>
    (routine.triggers ?? []).filter((trigger) => trigger.kind === "schedule" && trigger.enabled !== false).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    companyId: company.id,
    chiefOfStaffAgentId: chiefOfStaff?.id ?? null,
    counts: {
      openIssues: openIssues.length,
      blockedIssues: blockedIssues.length,
      chiefOfStaffAssigned: assignedToChiefOfStaff.length,
      unassignedActive: unassignedActive.length,
      openRoutineExecution: routineExecution.length,
      activeRoutines: routines.filter((routine) => routine.status === "active").length,
      pausedRoutines: routines.filter((routine) => routine.status === "paused").length,
      duplicateRoutineTitles: duplicateTitles.size,
    },
    chiefOfStaffAssigned: assignedToChiefOfStaff.slice(0, 10).map((issue) => ({
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      updatedAt: issue.updatedAt,
    })),
    blocked: blockedIssues.slice(0, 10).map((issue) => ({
      identifier: issue.identifier,
      title: issue.title,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId ?? null,
    })),
    routinesWithEnabledSchedules: routines
      .filter((routine) => enabledScheduleCount(routine) > 0)
      .slice(0, 20)
      .map((routine) => ({
        title: routine.title,
        status: routine.status,
        enabledScheduleCount: enabledScheduleCount(routine),
      })),
  };

  console.log(JSON.stringify(payload, null, 2));
}

await main();
