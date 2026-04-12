import {
  buildHumanBlockerSubjectTag,
  renderHumanBlockerCorrelationSection,
} from "./human-reply-routing";

export type HumanBlockerPacket = {
  blockerId?: string;
  title: string;
  summary: string;
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
    `<p style="margin:0 0 16px;"><strong>Why This Is Blocked</strong><br />${paragraph(packet.whyBlocked)}</p>`,
    `<div style="margin:0 0 16px;"><strong>Alternatives</strong><ol style="margin:8px 0 0 20px;padding:0;">${alternatives || "<li>None.</li>"}</ol></div>`,
    `<p style="margin:0 0 16px;"><strong>Risk</strong><br />${paragraph(packet.risk)}</p>`,
    `<div style="margin:0 0 16px;"><strong>What Happens After Reply</strong><ul style="margin:8px 0 0 20px;padding:0;"><li><strong>Owner:</strong> ${paragraph(packet.executionOwner)}</li><li><strong>Immediate next action:</strong> ${paragraph(packet.immediateNextAction)}</li><li><strong>Deadline / checkpoint:</strong> ${paragraph(packet.deadline)}</li></ul></div>`,
    `<div style="margin:0 0 16px;"><strong>Evidence</strong><ul style="margin:8px 0 0 20px;padding:0;">${evidence || "<li>None recorded.</li>"}</ul></div>`,
    `<p style="margin:0;"><strong>Non-Scope</strong><br />${paragraph(packet.nonScope)}</p>`,
    `</div>`,
  ].join("");
}
