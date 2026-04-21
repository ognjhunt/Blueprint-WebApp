import {
  buildHumanBlockerSubjectTag,
  renderHumanBlockerCorrelationSection,
  type HumanResumeActionKind,
} from "./human-reply-routing";

export type HumanBlockerPacket = {
  blockerId?: string;
  title: string;
  summary: string;
  decisionType?: string | null;
  irreversibleActionClass?: string | null;
  recommendedAnswer: string;
  exactResponseNeeded: string;
  whyBlocked: string;
  alternatives: string[];
  risk: string;
  executionOwner: string;
  immediateNextAction: string;
  deadline: string;
  evidence: string[];
  nonScope: string;
  repoContext?: {
    repo: string;
    project?: string | null;
    issueId?: string | null;
    opsWorkItemId?: string | null;
    sourceRef?: string | null;
  } | null;
  policyContext?: {
    gateMode: "universal_founder_inbox" | "repo_local_no_send";
    reasonCategory?: string | null;
    autoExecutionEligible?: boolean | null;
  } | null;
  resumeAction?: {
    kind: HumanResumeActionKind;
    description?: string;
    metadata?: Record<string, unknown>;
  };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

export function renderHumanBlockerPacketEmailSubject(title: string, blockerId?: string) {
  const correlation = blockerId ? ` ${buildHumanBlockerSubjectTag(blockerId)}` : "";
  return `[Blueprint Blocker]${correlation} ${title}`.replace(/\s+/g, " ").trim();
}

export function renderHumanBlockerPacketText(packet: HumanBlockerPacket) {
  const alternatives =
    packet.alternatives.length > 0
      ? packet.alternatives.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "None.";
  const evidence =
    packet.evidence.length > 0
      ? packet.evidence.map((item) => `- ${item}`).join("\n")
      : "- None recorded.";

  return [
    ...(packet.blockerId
      ? [renderHumanBlockerCorrelationSection(packet.blockerId), ""]
      : []),
    `Summary`,
    packet.summary,
    "",
    `Recommended Answer`,
    packet.recommendedAnswer,
    "",
    `What I Need From You`,
    packet.exactResponseNeeded,
    ...(packet.decisionType || packet.irreversibleActionClass
      ? [
          "",
          `Decision Context`,
          ...(packet.decisionType ? [`- Decision type: ${packet.decisionType}`] : []),
          ...(packet.irreversibleActionClass
            ? [`- Irreversible action class: ${packet.irreversibleActionClass}`]
            : []),
        ]
      : []),
    "",
    `Why This Is Blocked`,
    packet.whyBlocked,
    "",
    `Alternatives`,
    alternatives,
    "",
    `Risk`,
    packet.risk,
    "",
    `What Happens After Reply`,
    `- Owner: ${packet.executionOwner}`,
    `- Immediate next action: ${packet.immediateNextAction}`,
    `- Deadline / checkpoint: ${packet.deadline}`,
    "",
    `Evidence`,
    evidence,
    ...(packet.repoContext
      ? [
          "",
          `Repo Context`,
          `- Repo: ${packet.repoContext.repo}`,
          ...(packet.repoContext.project ? [`- Project: ${packet.repoContext.project}`] : []),
          ...(packet.repoContext.issueId ? [`- Issue: ${packet.repoContext.issueId}`] : []),
          ...(packet.repoContext.opsWorkItemId
            ? [`- Ops work item: ${packet.repoContext.opsWorkItemId}`]
            : []),
          ...(packet.repoContext.sourceRef ? [`- Source ref: ${packet.repoContext.sourceRef}`] : []),
        ]
      : []),
    ...(packet.policyContext
      ? [
          "",
          `Policy Context`,
          `- Gate mode: ${packet.policyContext.gateMode}`,
          ...(packet.policyContext.reasonCategory
            ? [`- Reason category: ${packet.policyContext.reasonCategory}`]
            : []),
          ...(packet.policyContext.autoExecutionEligible !== null
            && packet.policyContext.autoExecutionEligible !== undefined
            ? [`- Auto execution eligible: ${packet.policyContext.autoExecutionEligible ? "yes" : "no"}`]
            : []),
        ]
      : []),
    "",
    `Non-Scope`,
    packet.nonScope,
  ].join("\n");
}

export function renderHumanBlockerPacketSlack(packet: HumanBlockerPacket) {
  const alternatives =
    packet.alternatives.length > 0
      ? packet.alternatives.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "None.";
  const evidence =
    packet.evidence.length > 0
      ? packet.evidence.map((item) => `- ${item}`).join("\n")
      : "- None recorded.";

  return [
    ...(packet.blockerId
      ? [`*Correlation:* ${buildHumanBlockerSubjectTag(packet.blockerId)} · \`${packet.blockerId}\``, ""]
      : []),
    `*Blocked:* ${packet.title}`,
    "",
    `*Summary:* ${packet.summary}`,
    "",
    `*Recommended answer:* ${packet.recommendedAnswer}`,
    "",
    `*What I need from you:* ${packet.exactResponseNeeded}`,
    ...(packet.decisionType || packet.irreversibleActionClass
      ? [
          "",
          `*Decision context:*`,
          ...(packet.decisionType ? [`- Decision type: ${packet.decisionType}`] : []),
          ...(packet.irreversibleActionClass
            ? [`- Irreversible action class: ${packet.irreversibleActionClass}`]
            : []),
        ]
      : []),
    "",
    `*Why this is blocked:* ${packet.whyBlocked}`,
    "",
    `*Alternatives:*`,
    alternatives,
    "",
    `*Risk:* ${packet.risk}`,
    "",
    `*After reply:*`,
    `- *Owner:* ${packet.executionOwner}`,
    `- *Next action:* ${packet.immediateNextAction}`,
    `- *Deadline:* ${packet.deadline}`,
    "",
    `*Evidence:*`,
    evidence,
    ...(packet.repoContext
      ? [
          "",
          `*Repo context:*`,
          `- Repo: ${packet.repoContext.repo}`,
          ...(packet.repoContext.project ? [`- Project: ${packet.repoContext.project}`] : []),
          ...(packet.repoContext.issueId ? [`- Issue: ${packet.repoContext.issueId}`] : []),
          ...(packet.repoContext.opsWorkItemId ? [`- Ops work item: ${packet.repoContext.opsWorkItemId}`] : []),
        ]
      : []),
    ...(packet.policyContext
      ? [
          "",
          `*Policy context:*`,
          `- Gate mode: ${packet.policyContext.gateMode}`,
          ...(packet.policyContext.reasonCategory ? [`- Reason category: ${packet.policyContext.reasonCategory}`] : []),
        ]
      : []),
    "",
    `*Non-scope:* ${packet.nonScope}`,
  ].join("\n");
}

export function renderHumanBlockerPacketHtml(packet: HumanBlockerPacket) {
  const alternatives = packet.alternatives
    .map((item) => `<li>${paragraph(item)}</li>`)
    .join("");
  const evidence = packet.evidence
    .map((item) => `<li>${paragraph(item)}</li>`)
    .join("");

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.55;font-size:14px;">`,
    ...(packet.blockerId
      ? [
          `<p style="margin:0 0 16px;"><strong>Correlation</strong><br />${paragraph(
            `Blocker id: ${packet.blockerId}\nReply tag: ${buildHumanBlockerSubjectTag(packet.blockerId)}`,
          )}</p>`,
        ]
      : []),
    `<p style="margin:0 0 16px;"><strong>Summary</strong><br />${paragraph(packet.summary)}</p>`,
    `<p style="margin:0 0 16px;"><strong>Recommended Answer</strong><br />${paragraph(packet.recommendedAnswer)}</p>`,
    `<p style="margin:0 0 16px;"><strong>What I Need From You</strong><br />${paragraph(packet.exactResponseNeeded)}</p>`,
    ...((packet.decisionType || packet.irreversibleActionClass)
      ? [
          `<div style="margin:0 0 16px;"><strong>Decision Context</strong><ul style="margin:8px 0 0 20px;padding:0;">${
            [
              packet.decisionType
                ? `<li><strong>Decision type:</strong> ${paragraph(packet.decisionType)}</li>`
                : "",
              packet.irreversibleActionClass
                ? `<li><strong>Irreversible action class:</strong> ${paragraph(packet.irreversibleActionClass)}</li>`
                : "",
            ]
              .filter(Boolean)
              .join("")
          }</ul></div>`,
        ]
      : []),
    `<p style="margin:0 0 16px;"><strong>Why This Is Blocked</strong><br />${paragraph(packet.whyBlocked)}</p>`,
    `<div style="margin:0 0 16px;"><strong>Alternatives</strong><ol style="margin:8px 0 0 20px;padding:0;">${alternatives || "<li>None.</li>"}</ol></div>`,
    `<p style="margin:0 0 16px;"><strong>Risk</strong><br />${paragraph(packet.risk)}</p>`,
    `<div style="margin:0 0 16px;"><strong>What Happens After Reply</strong><ul style="margin:8px 0 0 20px;padding:0;"><li><strong>Owner:</strong> ${paragraph(packet.executionOwner)}</li><li><strong>Immediate next action:</strong> ${paragraph(packet.immediateNextAction)}</li><li><strong>Deadline / checkpoint:</strong> ${paragraph(packet.deadline)}</li></ul></div>`,
    `<div style="margin:0 0 16px;"><strong>Evidence</strong><ul style="margin:8px 0 0 20px;padding:0;">${evidence || "<li>None recorded.</li>"}</ul></div>`,
    ...(packet.repoContext
      ? [
          `<div style="margin:0 0 16px;"><strong>Repo Context</strong><ul style="margin:8px 0 0 20px;padding:0;">${
            [
              `<li><strong>Repo:</strong> ${paragraph(packet.repoContext.repo)}</li>`,
              packet.repoContext.project
                ? `<li><strong>Project:</strong> ${paragraph(packet.repoContext.project)}</li>`
                : "",
              packet.repoContext.issueId
                ? `<li><strong>Issue:</strong> ${paragraph(packet.repoContext.issueId)}</li>`
                : "",
              packet.repoContext.opsWorkItemId
                ? `<li><strong>Ops work item:</strong> ${paragraph(packet.repoContext.opsWorkItemId)}</li>`
                : "",
              packet.repoContext.sourceRef
                ? `<li><strong>Source ref:</strong> ${paragraph(packet.repoContext.sourceRef)}</li>`
                : "",
            ]
              .filter(Boolean)
              .join("")
          }</ul></div>`,
        ]
      : []),
    ...(packet.policyContext
      ? [
          `<div style="margin:0 0 16px;"><strong>Policy Context</strong><ul style="margin:8px 0 0 20px;padding:0;">${
            [
              `<li><strong>Gate mode:</strong> ${paragraph(packet.policyContext.gateMode)}</li>`,
              packet.policyContext.reasonCategory
                ? `<li><strong>Reason category:</strong> ${paragraph(packet.policyContext.reasonCategory)}</li>`
                : "",
              packet.policyContext.autoExecutionEligible !== null
                && packet.policyContext.autoExecutionEligible !== undefined
                ? `<li><strong>Auto execution eligible:</strong> ${paragraph(packet.policyContext.autoExecutionEligible ? "yes" : "no")}</li>`
                : "",
            ]
              .filter(Boolean)
              .join("")
          }</ul></div>`,
        ]
      : []),
    `<p style="margin:0;"><strong>Non-Scope</strong><br />${paragraph(packet.nonScope)}</p>`,
    `</div>`,
  ].join("");
}
