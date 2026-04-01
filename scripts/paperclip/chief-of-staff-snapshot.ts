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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${PAPERCLIP_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

async function main() {
  const companies = await fetchJson<Array<{ id: string; name: string }>>("/api/companies");
  const company = companies.find((entry) => entry.name === COMPANY_NAME);
  if (!company) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
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
