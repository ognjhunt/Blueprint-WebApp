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

export function isNotionManagerRegistryWorkTitle(value?: string | null) {
  const title = normalize(value);
  return (
    title.includes("blueprint agents registry")
    || (
      title.includes("agent registry")
      && (
        title.includes("backfill")
        || title.includes("metadata")
        || title.includes("canonical link")
      )
    )
  );
}

export function isNotionManagerWorkTitle(value?: string | null) {
  const title = normalize(value);
  return (
    title.includes("notion drift")
    || title.startsWith("notion work queue:")
    || title.includes("founder os")
    || title.includes("blueprint hub")
    || (
      title.includes("knowledge db")
      && (title.includes("review timestamp") || title.includes("stale entr"))
    )
    || title.includes("orphaned/empty notion pages")
    || isNotionManagerRegistryWorkTitle(title)
  );
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

  if (isNotionManagerWorkTitle(title)) {
    return route(
      "notion-manager-agent",
      "the issue is about Blueprint-managed Notion structure or workspace drift",
    );
  }
  if (title.includes("investor relations agent bootstrap")) {
    return route("investor-relations-agent", "the issue is bootstrapping the investor relations lane");
  }
  if (title.includes("security procurement agent bootstrap")) {
    return route("security-procurement-agent", "the issue is bootstrapping the security and procurement lane");
  }
  if (title.includes("revenue ops pricing agent bootstrap")) {
    return route("revenue-ops-pricing-agent", "the issue is bootstrapping the pricing operations lane");
  }
  if (title.includes("demand intel agent bootstrap")) {
    return route("demand-intel-agent", "the issue is bootstrapping the buyer demand research lane");
  }
  if (title.includes("city demand agent bootstrap")) {
    return route("city-demand-agent", "the issue is bootstrapping the city demand lane");
  }
  if (title.includes("site operator partnership agent bootstrap")) {
    return route("site-operator-partnership-agent", "the issue is bootstrapping the site-operator partnership lane");
  }
  if (title.includes("runtime provider") || title.includes("smoke launch")) {
    return route("webapp-codex", "the issue is a Blueprint-WebApp runtime configuration thread");
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
  if (title.includes("analytics")) {
    return route("analytics-agent", "the issue is an analytics instrumentation or reporting thread");
  }
  if (
    title.includes("conversion refresh")
    || title.includes("conversion ")
    || title.includes("cro")
    || title.includes("experiment")
  ) {
    return route("conversion-agent", "the issue is a conversion optimization or CRO thread");
  }
  if (title.includes("ci failure")) {
    if (projectName.includes("webapp")) {
      return route("webapp-ci-watch", "the issue is a Blueprint-WebApp CI monitoring thread");
    }
    if (projectName.includes("pipeline")) {
      return route(
        "pipeline-ci-watch",
        "the issue is a BlueprintCapturePipeline CI monitoring thread",
      );
    }
    if (projectName.includes("capture")) {
      return route("capture-ci-watch", "the issue is a BlueprintCapture CI monitoring thread");
    }
  }
  if (title.includes("branch drift")) {
    if (projectName.includes("webapp")) {
      return route("webapp-review", "the issue is a Blueprint-WebApp repo drift review thread");
    }
    if (projectName.includes("pipeline")) {
      return route(
        "pipeline-review",
        "the issue is a BlueprintCapturePipeline repo drift review thread",
      );
    }
    if (projectName.includes("capture")) {
      return route("capture-review", "the issue is a BlueprintCapture repo drift review thread");
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
