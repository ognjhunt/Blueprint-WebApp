export type ChiefOfStaffRoutingIssue = {
  title: string;
  status: string;
  project?: { name?: string | null } | null;
};

export type ChiefOfStaffRouteDecision = {
  assigneeKey: string;
  rationale: string;
  comment: string;
  status?: "todo";
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function inferChiefOfStaffRoute(
  issue: ChiefOfStaffRoutingIssue,
): ChiefOfStaffRouteDecision | null {
  const title = normalize(issue.title);
  const projectName = normalize(issue.project?.name);

  const route = (assigneeKey: string, rationale: string): ChiefOfStaffRouteDecision => ({
    assigneeKey,
    rationale,
    status: issue.status === "backlog" ? "todo" : undefined,
    comment: `Deterministic chief-of-staff routing moved this issue to ${assigneeKey} because ${rationale}.`,
  });

  if (
    title.includes("notion drift")
    || title.startsWith("notion work queue:")
    || title.includes("founder os")
    || title.includes("blueprint hub")
  ) {
    return route(
      "notion-manager-agent",
      "the issue is about Blueprint-managed Notion structure or workspace drift",
    );
  }
  if (
    title.startsWith("stripe:")
    || /payout|refund|dispute|support ticket|support:/i.test(issue.title)
  ) {
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
  if (
    title.includes("security procurement")
    || title.includes("security questionnaire")
    || title.includes("procurement")
  ) {
    return route(
      "security-procurement-agent",
      "the issue is a buyer security or procurement review thread",
    );
  }
  if (
    /solutions engineering|proof[- ]pack|hosted[- ](?:evaluation|review)|delivery review/i.test(issue.title)
  ) {
    return route(
      "solutions-engineering-agent",
      "the issue is a technical buyer enablement or delivery thread",
    );
  }
  if (title.includes("ci failure") || title.includes("branch drift")) {
    if (projectName.includes("webapp")) {
      return route("webapp-codex", "the issue is a Blueprint-WebApp engineering execution thread");
    }
    if (projectName.includes("pipeline")) {
      return route(
        "pipeline-codex",
        "the issue is a BlueprintCapturePipeline engineering execution thread",
      );
    }
    if (projectName.includes("capture")) {
      return route("capture-codex", "the issue is a BlueprintCapture engineering execution thread");
    }
  }
  if (projectName.includes("executive")) {
    return route(
      "ops-lead",
      "the issue lives in executive ops and lacks a more specific specialist match",
    );
  }

  return null;
}
