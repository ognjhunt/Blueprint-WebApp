export type SlackAlertCopy = {
  title: string;
  summary: string[];
};

type AgentConversationSlackCopyInput =
  | {
    kind: "comment";
    actor: string;
    target?: string | null;
    issueIdentifier?: string | null;
    issueTitle: string;
    bodySnippet: string;
  }
  | {
    kind: "handoff_request";
    actor: string;
    target: string;
    issueIdentifier?: string | null;
    issueTitle: string;
    summary: string;
    expectedOutcome: string;
    priority?: string | null;
  }
  | {
    kind: "handoff_response";
    actor: string;
    target: string;
    issueIdentifier?: string | null;
    issueTitle: string;
    outcome: "done" | "blocked";
    followUpReason?: string | null;
    proofLinkCount?: number;
  };

type ManagedIssueSlackEvent = "opened" | "updated" | "resolved";

type ManagedIssueSlackCopyInput = {
  event: ManagedIssueSlackEvent;
  sourceType: string;
  issueTitle: string;
  projectName: string;
  assignee?: string | null;
  priority?: string | null;
  status?: string | null;
  signalUrl?: string | null;
};

type ManagerIssueSlackCopyInput = {
  eventType: "issue.created" | "issue.updated";
  issueTitle: string;
  status: string;
  priority?: string | null;
  owner?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function sentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function cleanIssueTitle(title: string) {
  return title.replace(/^\[Handoff\]\s*/i, "").trim();
}

export function formatIssueStatus(value: string | null | undefined) {
  if (!value) return null;
  return STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

export function formatIssuePriority(value: string | null | undefined) {
  if (!value) return null;
  return PRIORITY_LABELS[value] ?? value;
}

export function formatAgentName(value: string | null | undefined) {
  if (!value) return "Unassigned";
  return value.replace(/-/g, " ");
}

function describeIssue(input: { issueIdentifier?: string | null; issueTitle: string }) {
  return input.issueIdentifier?.trim() || cleanIssueTitle(input.issueTitle);
}

export function buildAgentConversationSlackCopy(input: AgentConversationSlackCopyInput): SlackAlertCopy {
  const issueLabel = describeIssue(input);

  if (input.kind === "handoff_request") {
    const summary = [
      `What happened: ${formatAgentName(input.actor)} asked ${formatAgentName(input.target)} to take the next step.`,
      `Task: ${issueLabel}`,
      `Requested outcome: ${sentence(input.expectedOutcome)}`,
      `Context: ${sentence(input.summary)}`,
    ];
    const priority = formatIssuePriority(input.priority);
    if (priority) summary.push(`Priority: ${priority}`);

    return {
      title: `Handoff: ${formatAgentName(input.actor)} -> ${formatAgentName(input.target)}`,
      summary,
    };
  }

  if (input.kind === "handoff_response") {
    const summary = [
      `What happened: ${formatAgentName(input.actor)} replied to ${formatAgentName(input.target)} on an active handoff.`,
      `Task: ${issueLabel}`,
      `Outcome: ${input.outcome === "done" ? "Done" : "Blocked"}`,
    ];
    if (typeof input.proofLinkCount === "number") {
      summary.push(`Proof links: ${input.proofLinkCount}`);
    }
    if (input.followUpReason) {
      summary.push(`Next step: ${sentence(input.followUpReason)}`);
    }

    return {
      title: `Handoff response from ${formatAgentName(input.actor)}`,
      summary,
    };
  }

  return {
    title: `${formatAgentName(input.actor)} commented on ${issueLabel}`,
    summary: [
      `What happened: ${formatAgentName(input.actor)} left a coordination note${input.target ? ` for ${formatAgentName(input.target)}` : ""}.`,
      `Task: ${issueLabel}`,
      `Comment: ${sentence(input.bodySnippet)}`,
    ],
  };
}

function buildManagedIssueTitle(input: ManagedIssueSlackCopyInput) {
  const { event, sourceType, projectName, issueTitle } = input;

  switch (sourceType) {
    case "repo-scan-error":
      return event === "resolved"
        ? `Repo scan recovered in ${projectName}`
        : `Repo scan failed in ${projectName}`;
    case "repo-dirty":
      return event === "resolved"
        ? `Shared workspace is clean again in ${projectName}`
        : `Shared workspace has local changes in ${projectName}`;
    case "repo-branch-drift":
      return event === "resolved"
        ? `Shared workspace is back on the expected branch in ${projectName}`
        : `Shared workspace is off the expected branch in ${projectName}`;
    case "github-workflow":
      return event === "resolved"
        ? `CI recovered in ${projectName}`
        : `CI failed in ${projectName}`;
    case "github-review":
      return event === "resolved"
        ? `PR review changes cleared in ${projectName}`
        : `PR review changes requested in ${projectName}`;
    case "handoff-escalation":
      return event === "resolved"
        ? "Stuck handoff cleared"
        : "Stuck handoff needs follow-through";
    case "notion-work-queue":
      return `New Notion work item in ${projectName}`;
    default:
      if (event === "resolved") return `Resolved in ${projectName}`;
      if (event === "opened") return `Needs attention in ${projectName}`;
      return `Update in ${projectName}`;
  }
}

function buildManagedIssueWhatHappened(input: ManagedIssueSlackCopyInput) {
  const { event, sourceType, projectName } = input;

  switch (sourceType) {
    case "repo-scan-error":
      return event === "resolved"
        ? `Automation can scan ${projectName} again, so repo health checks are back to normal`
        : `Automation could not scan ${projectName}, so repo health checks are unreliable until this is fixed`;
    case "repo-dirty":
      return event === "resolved"
        ? `The shared ${projectName} workspace is clean again`
        : `The shared ${projectName} workspace has local changes and needs a quick review before more automation runs there`;
    case "repo-branch-drift":
      return event === "resolved"
        ? `The shared ${projectName} workspace is back on the expected branch and sync state`
        : `The shared ${projectName} workspace is not on the expected branch or sync state`;
    case "github-workflow":
      return event === "resolved"
        ? `The latest GitHub Actions run passed in ${projectName}`
        : `A GitHub Actions workflow failed in ${projectName}`;
    case "github-review":
      return event === "resolved"
        ? `The pull request is no longer blocked on requested review changes`
        : `A GitHub review requested changes before the pull request can move forward`;
    case "handoff-escalation":
      return event === "resolved"
        ? "The stuck handoff was cleared"
        : "A handoff got stuck and was escalated for follow-through";
    case "notion-work-queue":
      return "A Notion work queue item was synced into Paperclip for active follow-up";
    default:
      return event === "resolved"
        ? `${cleanIssueTitle(input.issueTitle)} is resolved`
        : `${cleanIssueTitle(input.issueTitle)} needs attention`;
  }
}

export function buildManagedIssueSlackCopy(input: ManagedIssueSlackCopyInput): SlackAlertCopy {
  const summary = [
    `What happened: ${sentence(buildManagedIssueWhatHappened(input))}`,
    `Task: ${cleanIssueTitle(input.issueTitle)}`,
  ];

  if (input.event === "resolved") {
    const status = formatIssueStatus(input.status ?? "done");
    if (status) summary.push(`Status: ${status}`);
  } else {
    summary.push(`Action needed: Yes`);

    const owner = formatAgentName(input.assignee);
    if (owner) summary.push(`Owner: ${owner}`);

    const priority = formatIssuePriority(input.priority);
    if (priority) summary.push(`Priority: ${priority}`);

    const status = formatIssueStatus(input.status);
    if (status) summary.push(`Status: ${status}`);
  }

  if (input.signalUrl) {
    summary.push(`Link: ${input.signalUrl}`);
  }

  return {
    title: buildManagedIssueTitle(input),
    summary,
  };
}

export function shouldPostManagerIssueEventToSlack(input: {
  eventType: "issue.created" | "issue.updated";
  status: string;
  priority?: string | null;
  assigneeAgentId?: string | null;
}): boolean {
  const unassigned = !input.assigneeAgentId;

  if (input.eventType === "issue.created") {
    return input.status === "blocked" || unassigned;
  }

  return input.status === "blocked" || unassigned;
}

export function buildManagerIssueSlackCopy(input: ManagerIssueSlackCopyInput): SlackAlertCopy {
  const status = formatIssueStatus(input.status) ?? input.status;
  const priority = formatIssuePriority(input.priority);
  const owner = input.owner?.trim() || "Unassigned";
  const unassigned = owner === "Unassigned";
  const task = cleanIssueTitle(input.issueTitle);

  if (input.eventType === "issue.created") {
    if (input.status === "blocked") {
      return {
        title: "Manager update: blocked issue opened",
        summary: [
          "What happened: A new issue entered Paperclip already blocked.",
          `Task: ${task}`,
          `Status: ${status}`,
          `Owner: ${owner}`,
          "Next move: Decide whether to reroute, unblock, or escalate immediately.",
        ],
      };
    }

    if (unassigned) {
      return {
        title: "Manager update: new issue needs an owner",
        summary: [
          "What happened: A new Paperclip issue was created without a real owner.",
          `Task: ${task}`,
          `Status: ${status}`,
          "Owner: Unassigned",
          "Next move: Assign the next accountable agent before the thread cools off.",
        ],
      };
    }

  }

  if (input.status === "blocked") {
    return {
      title: "Manager update: issue is blocked",
      summary: [
        "What happened: An active Paperclip issue is now blocked.",
        `Task: ${task}`,
        `Status: ${status}`,
        `Owner: ${owner}`,
        ...(priority ? [`Priority: ${priority}`] : []),
        "Next move: Create the unblock path or delegate the blocker explicitly.",
      ],
    };
  }

  if (unassigned) {
    return {
      title: "Manager update: issue lost its owner",
      summary: [
        "What happened: An active Paperclip issue no longer has an assigned owner.",
        `Task: ${task}`,
        `Status: ${status}`,
        "Owner: Unassigned",
        ...(priority ? [`Priority: ${priority}`] : []),
        "Next move: Reassign the issue or close it if the work is no longer real.",
      ],
    };
  }

  return {
    title: "Manager update: issue needs an owner",
    summary: [
      "What happened: An active Paperclip issue no longer has a clear owner.",
      `Task: ${task}`,
      `Status: ${status}`,
      "Owner: Unassigned",
      ...(priority ? [`Priority: ${priority}`] : []),
      "Next move: Reassign the issue or close it if the work is no longer real.",
    ],
  };
}
