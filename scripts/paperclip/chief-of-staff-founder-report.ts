import {
  createNotionClient,
  type NotionUpsertResult,
  upsertKnowledgeEntry,
} from "../../ops/paperclip/plugins/blueprint-automation/src/notion.ts";
import { pathToFileURL } from "node:url";

type Company = { id: string; name: string };
type Agent = { id: string; name?: string | null; urlKey?: string | null };
type Issue = {
  id: string;
  identifier?: string | null;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  description?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  projectName?: string | null;
};

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const COMPANY_NAME = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";
const NOTION_API_TOKEN = process.env.NOTION_API_TOKEN;
const DEFAULT_SLACK_EXEC_WEBHOOK_URL =
  process.env.SLACK_EXEC_WEBHOOK_URL ?? process.env.SLACK_MANAGER_WEBHOOK_URL ?? process.env.SLACK_OPS_WEBHOOK_URL;

type FounderReportKind =
  | "morning"
  | "accountability"
  | "eod"
  | "friday_recap"
  | "weekly_gaps";

type FounderReport = {
  title: string;
  artifactType:
    | "Morning Founder Brief"
    | "Daily Accountability Report"
    | "EoD Founder Brief"
    | "Friday Operating Recap"
    | "Weekly Gaps Report";
  content: string;
  shouldPostSlackDigest: boolean;
};

const PRIORITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 } as const;

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

function normalizeKind(value?: string | null): FounderReportKind | null {
  switch ((value ?? "").trim().toLowerCase()) {
    case "morning":
    case "founder_morning_brief":
      return "morning";
    case "accountability":
    case "daily_accountability":
      return "accountability";
    case "eod":
    case "founder_eod_brief":
      return "eod";
    case "friday":
    case "friday_recap":
    case "operating_recap":
      return "friday_recap";
    case "gaps":
    case "weekly_gaps":
    case "weekly_gaps_report":
      return "weekly_gaps";
    default:
      return null;
  }
}

function etDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const timeZoneName = formatted.find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2] ?? "0", 10);
  const minutes = Number.parseInt(match[3] ?? "0", 10);
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

function reportCutoff(date: string, timeZone = "America/New_York") {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  if (!year || !month || !day) {
    return null;
  }
  const sample = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  const offsetMs = timeZoneOffsetMs(sample, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMs);
}

function resolveReportDate(requestedDate: string | undefined, issue: Pick<Issue, "createdAt">) {
  if (requestedDate) return requestedDate;
  return etDateString(asDate(issue.createdAt) ?? new Date());
}

function compareDesc(left?: string | null, right?: string | null) {
  const leftMs = asDate(left)?.getTime() ?? 0;
  const rightMs = asDate(right)?.getTime() ?? 0;
  return rightMs - leftMs;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function issueSignal(issue: Issue) {
  const title = normalizeWhitespace(issue.title);
  const normalized = title.toLowerCase();

  if (/^stripe:\s*payout\.failed\b/.test(normalized)) {
    return {
      fingerprint: "finance:stripe:payout_failed",
      displayTitle: "Repeated Stripe payout.failed exceptions",
    };
  }

  if ((/firebase admin|firestore|dbadmin/.test(normalized)) && /paperclip|heartbeat|intake|triage/.test(normalized)) {
    return {
      fingerprint: "ops:firebase_admin_access",
      displayTitle: "Paperclip Firebase Admin access remains blocked",
    };
  }

  if (/^notion work queue:\s*/i.test(title)) {
    const stripped = normalizeWhitespace(title.replace(/^notion work queue:\s*/i, ""));
    return {
      fingerprint: `notion:${stripped.toLowerCase()}`,
      displayTitle: `Notion Work Queue: ${stripped}`,
    };
  }

  const canonical = normalizeWhitespace(
    normalized
      .replace(/\(evt_[^)]+\)/g, "")
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/g, "")
      .replace(/\s+/g, " "),
  );

  return {
    fingerprint: canonical || issue.id,
    displayTitle: title,
  };
}

function issueFingerprint(issue: Issue) {
  return issueSignal(issue).fingerprint;
}

function issueDisplayTitle(issue: Issue) {
  return issueSignal(issue).displayTitle;
}

function issueLine(issue: Issue, assigneeNameById: Map<string, string>) {
  const owner = issue.assigneeAgentId ? (assigneeNameById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : "unassigned";
  return `- ${issue.identifier ?? issue.id}: [${issue.priority}] ${issueDisplayTitle(issue)} (${owner})`;
}

function laneLabel(issue: Issue) {
  const projectName = (issue.projectName ?? "").toLowerCase();
  if (projectName.includes("webapp")) return "WebApp";
  if (projectName.includes("capture pipeline")) return "Capture Pipeline";
  if (projectName.includes("capture")) return "Capture";
  if (projectName.includes("executive")) return "Executive Ops";
  if (/analytics|metric|experiment/i.test(issue.title)) return "Analytics";
  if (/buyer|funnel|conversion/i.test(issue.title)) return "Buyer";
  if (/capturer|city launch|launch/i.test(issue.title)) return "Growth";
  if (/finance|payout|stripe|revenue/i.test(issue.title)) return "Finance";
  if (/rights|privacy|legal|contract/i.test(issue.title)) return "Rights";
  if (/ops|field/i.test(issue.title)) return "Ops";
  return issue.projectName?.replace(/^blueprint-/, "").replace(/-/g, " ") || "Operations";
}

function checkpoint(issue: Issue) {
  if (issue.status === "blocked") return "unblock or escalate";
  if (issue.priority === "critical") return "next founder checkpoint";
  if (issue.priority === "high") return "next scheduled follow-through";
  return "next owner update";
}

function founderBullet(issue: Issue, assigneeNameById: Map<string, string>) {
  const owner = issue.assigneeAgentId ? (assigneeNameById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : "unassigned";
  return `- [${laneLabel(issue)}] ${issueDisplayTitle(issue)} — ${owner}, ${checkpoint(issue)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPacketValue(description: string | null | undefined, labels: string[]) {
  if (!description) return null;
  const source = description.replace(/\r\n/g, "\n");
  const lines = source.split("\n");

  for (const label of labels) {
    const headingRe = new RegExp(`^##\\s+${escapeRegExp(label)}\\s*$`, "i");
    const headingIndex = lines.findIndex((line) => headingRe.test(line));
    if (headingIndex >= 0) {
      const valueLines: string[] = [];
      for (let index = headingIndex + 1; index < lines.length; index += 1) {
        if (/^##\s+/.test(lines[index] ?? "")) break;
        valueLines.push(lines[index] ?? "");
      }
      const value = valueLines.join("\n").trim().replace(/\n+/g, " ");
      if (value) return value;
    }

    const inlineMatch = source.match(
      new RegExp(`^(?:[-*]\\s*)?${escapeRegExp(label)}\\s*:\\s*(.+)$`, "im"),
    );
    if (inlineMatch?.[1]) {
      return inlineMatch[1].trim();
    }
  }

  return null;
}

function fallbackFounderWhyNow(issue: Issue) {
  if (issue.status === "blocked") {
    return "This is flagged for founder review, but the packet does not state the irreversible decision clearly enough.";
  }
  if (issue.priority === "critical") {
    return "This is the highest-priority founder-gated item still open.";
  }
  if (issue.priority === "high") {
    return "This is an active founder-gated item that will keep creating queue noise until it is answered.";
  }
  return "This item is still flagged for founder attention and needs a bounded answer or deferral.";
}

function fallbackFounderRecommendation(issue: Issue) {
  const normalized = issue.title.toLowerCase();
  if (normalized.includes("chicago") && normalized.includes("launch")) {
    return "Defer Chicago. Keep it plan-only until Austin proof exists or a new Chicago anchor signal changes the evidence.";
  }
  if (/(rights|privacy|legal|security)/i.test(issue.title)) {
    return "Do not approve by default. Require the named reviewer and the explicit risk boundary first.";
  }
  if (/(pricing|discount|terms|contract|commercial)/i.test(issue.title)) {
    return "Do not approve by default. Require one bounded commercial recommendation with downside and named executor.";
  }
  if (/(credential|access|token|api key)/i.test(issue.title)) {
    return "Provide the missing credential or explicitly deny it so the queue can move.";
  }
  return "Missing structured recommendation — send this back to Chief of Staff as an incomplete founder packet.";
}

function founderDecisionPacket(issue: Issue, assigneeNameById: Map<string, string>) {
  const owner = issue.assigneeAgentId ? (assigneeNameById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : "unassigned";
  const whyNow = extractPacketValue(issue.description, [
    "Why Decision Is Needed Now",
    "Why This Is Open",
    "Why now",
  ]) ?? fallbackFounderWhyNow(issue);
  const recommendedAnswer = extractPacketValue(issue.description, [
    "Recommended Answer",
    "Recommended answer",
  ]) ?? fallbackFounderRecommendation(issue);
  const alternatives = extractPacketValue(issue.description, ["Alternatives", "Alternative"])
    ?? "Missing alternatives — packet incomplete.";
  const downside = extractPacketValue(issue.description, [
    "Downside / Risk",
    "Downside",
    "Risk",
    "Risks",
  ]) ?? "Missing downside/risk — packet incomplete.";
  const approvalNeeded = extractPacketValue(issue.description, [
    "Exact Approval Or Info Needed",
    "Approval Needed",
    "Decision Needed",
  ]) ?? "Approve, defer, or return for a completed packet.";
  const immediateExecutor = extractPacketValue(issue.description, [
    "Immediate Executor",
    "Who Executes Immediately After Approval",
    "Suggested Owner",
  ]) ?? owner;
  const byWhen = extractPacketValue(issue.description, [
    "By When",
    "Deadline",
  ]) ?? checkpoint(issue);
  const blockerOrDecisionId = extractPacketValue(issue.description, [
    "Blocker Id",
    "Blocker ID",
    "Decision Id",
    "Decision ID",
    "Durable Blocker Id",
    "Durable blocker id",
  ]) ?? "Missing durable blocker/decision id — packet incomplete.";
  const evidencePacket = extractPacketValue(issue.description, [
    "Evidence Packet",
    "Evidence packet",
    "Evidence",
    "Proof Path",
    "Proof Paths",
  ]) ?? "Missing evidence packet path — packet incomplete.";
  const resumeCondition = extractPacketValue(issue.description, [
    "Resume Condition",
    "Retry Condition",
    "Retry / Resume Condition",
    "Retry/resume condition",
  ]) ?? "Missing resume condition — packet incomplete.";
  const watcherOwner = extractPacketValue(issue.description, [
    "Watcher / Resume Owner",
    "Watcher/Resume Owner",
    "Watcher Owner",
    "Watcher/owner",
    "Reply Watcher",
    "Execution Owner After Reply",
  ]) ?? owner;

  return [
    `### ${issueDisplayTitle(issue)}`,
    `- Why decision is needed now: ${whyNow}`,
    `- Recommended answer: ${recommendedAnswer}`,
    `- Alternatives: ${alternatives}`,
    `- Downside / risk: ${downside}`,
    `- Exact approval or info needed: ${approvalNeeded}`,
    `- Blocker / decision id: ${blockerOrDecisionId}`,
    `- Evidence packet: ${evidencePacket}`,
    `- Who executes immediately after approval: ${immediateExecutor}`,
    `- Watcher / resume owner: ${watcherOwner}`,
    `- Resume condition: ${resumeCondition}`,
    `- By when: ${byWhen}`,
  ].join("\n");
}

function section(title: string, lines: string[]) {
  return `## ${title}\n${lines.length > 0 ? lines.join("\n") : "- None."}`;
}

function issueSearchText(issue: Issue) {
  return `${issue.title}\n${issue.description ?? ""}`;
}

function hasStructuredFounderPacket(issue: Issue) {
  const description = issue.description ?? "";
  const hasDecisionWhy = Boolean(extractPacketValue(description, [
    "Why Decision Is Needed Now",
    "Why This Is Blocked",
    "Why This Is Open",
    "Why now",
  ]));
  const hasDecisionAsk = Boolean(extractPacketValue(description, [
    "Exact Approval Or Info Needed",
    "Exact Response Needed",
    "Approval Needed",
    "Decision Needed",
  ]));
  const hasRecommendation = Boolean(extractPacketValue(description, [
    "Recommended Answer",
    "Recommended answer",
  ]));

  return hasDecisionWhy && hasDecisionAsk && hasRecommendation;
}

function isFounderDecisionIssue(issue: Issue) {
  const text = issueSearchText(issue);
  const title = issue.title.toLowerCase();
  const lower = text.toLowerCase();

  if (/repo_local_no_send/.test(lower) && !/universal_founder_inbox|awaiting_human_decision/.test(lower)) {
    return false;
  }

  if (/universal_founder_inbox|awaiting_human_decision|founder[- ]inbox|founder[- ]packet/.test(lower)) {
    return true;
  }

  if (
    /founder[- ]?(approval|approved|decision|gated|review|answer)|approval from founder|founder must approve/.test(lower)
  ) {
    return true;
  }

  if (/launch posture/.test(lower) && /decide|decision|approve|defer|founder/.test(lower)) {
    return true;
  }

  if (hasStructuredFounderPacket(issue) && /irreversible_action_class|decision_type|founder/.test(lower)) {
    return true;
  }

  const titleNamesIrreversibleTopic =
    /non-standard|pricing|discount|quote exception|payment term|payout exception|refund exception|rights|privacy|consent|commercialization|lawful[- ]access|legal|contract|policy change|posture-changing|public claim|readiness claim|budget|spend envelope|paid spend|live send|live buyer send|public post|production-only irreversible|external artifact/.test(title);
  const titleRequestsDecision = /approval|approve|decision|decide|exception|defer/.test(title);

  return titleNamesIrreversibleTopic && titleRequestsDecision;
}

function founderWatchlist(issues: Issue[]) {
  return issues.filter(isFounderDecisionIssue);
}

function withinHours(issue: Issue, hours: number, referenceTime: Date) {
  const updatedAt = asDate(issue.completedAt ?? issue.updatedAt ?? issue.createdAt);
  if (!updatedAt) return false;
  const elapsedMs = referenceTime.getTime() - updatedAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= hours * 60 * 60 * 1000;
}

function inferKindFromIssueTitle(title: string): FounderReportKind | null {
  const normalized = title.trim().toLowerCase();
  if (normalized.includes("founder morning brief")) return "morning";
  if (normalized.includes("daily accountability")) return "accountability";
  if (normalized.includes("founder eod brief")) return "eod";
  if (normalized.includes("friday operating recap")) return "friday_recap";
  if (normalized.includes("weekly gaps report")) return "weekly_gaps";
  return null;
}

function uniqueById(issues: Issue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });
}

function uniqueBySignal(issues: Issue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const fingerprint = issueFingerprint(issue);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function topOpenIssues(issues: Issue[]) {
  return issues
    .filter((issue) => !["done", "cancelled"].includes(issue.status))
    .sort((left, right) => {
      const diff = (PRIORITY_SCORE[right.priority as keyof typeof PRIORITY_SCORE] ?? 0)
        - (PRIORITY_SCORE[left.priority as keyof typeof PRIORITY_SCORE] ?? 0);
      if (diff !== 0) return diff;
      return compareDesc(left.updatedAt, right.updatedAt);
    });
}

function takeDistinctIssues(candidates: Issue[], limit: number, usedFingerprints: Set<string>) {
  const selected: Issue[] = [];

  for (const issue of uniqueBySignal(candidates)) {
    const fingerprint = issueFingerprint(issue);
    if (usedFingerprints.has(fingerprint)) continue;
    selected.push(issue);
    usedFingerprints.add(fingerprint);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function sectionIssues(candidates: Issue[], limit: number, usedFingerprints: Set<string>) {
  return takeDistinctIssues(candidates, limit, usedFingerprints);
}

function founderSectionIssues(candidates: Issue[], limit: number) {
  return uniqueBySignal(candidates).slice(0, limit);
}

export function buildReport(kind: FounderReportKind, date: string, issues: Issue[], assigneeNameById: Map<string, string>): FounderReport {
  const referenceTime = reportCutoff(date) ?? new Date();
  const open = issues.filter((issue) => !["done", "cancelled"].includes(issue.status));
  const done = issues
    .filter((issue) => issue.status === "done")
    .sort((left, right) => compareDesc(left.completedAt ?? left.updatedAt, right.completedAt ?? right.updatedAt));
  const blocked = open.filter((issue) => issue.status === "blocked").sort((left, right) => compareDesc(left.updatedAt, right.updatedAt));
  const active = open
    .filter((issue) => ["todo", "in_progress", "in_review", "backlog"].includes(issue.status))
    .sort((left, right) => compareDesc(left.updatedAt, right.updatedAt));
  const founder = founderWatchlist(open).sort((left, right) => compareDesc(left.updatedAt, right.updatedAt));
  const slipped = uniqueById([
    ...blocked,
    ...open.filter((issue) => issue.priority === "high" && withinHours(issue, 72, referenceTime)),
  ]).slice(0, 8);
  const recentDone = uniqueBySignal(done.filter((issue) => withinHours(issue, 24, referenceTime)));
  const weeklyDone = uniqueBySignal(done.filter((issue) => withinHours(issue, 24 * 7, referenceTime)));
  const weakProof = uniqueBySignal(topOpenIssues(open).filter((issue) => !founderWatchlist([issue]).length)).slice(0, 8);

  const usedFingerprints = new Set<string>();

  switch (kind) {
    case "accountability":
      return {
        title: `Daily Accountability | ${date} | Blueprint`,
        artifactType: "Daily Accountability Report",
        content: [
          section("Material Progress", sectionIssues(done, 10, usedFingerprints).map((issue) => issueLine(issue, assigneeNameById))),
          section("Still Open", sectionIssues(active, 10, usedFingerprints).map((issue) => issueLine(issue, assigneeNameById))),
          section("Blocked", sectionIssues(blocked, 8, usedFingerprints).map((issue) => issueLine(issue, assigneeNameById))),
          section("Needs Founder", founderSectionIssues(founder, 8).map((issue) => founderDecisionPacket(issue, assigneeNameById))),
        ].join("\n\n"),
        shouldPostSlackDigest: false,
      };
    case "eod":
      return {
        title: `Founder EoD Brief | ${date} | Blueprint`,
        artifactType: "EoD Founder Brief",
        content: [
          section("Done Today", sectionIssues(recentDone, 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Slipped", sectionIssues(slipped, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Blocked Tonight", sectionIssues(blocked, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Needs Founder", founderSectionIssues(founder, 3).map((issue) => founderDecisionPacket(issue, assigneeNameById))),
          section("Watch Tomorrow Morning", sectionIssues(topOpenIssues(open), 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
        ].join("\n\n"),
        shouldPostSlackDigest: true,
      };
    case "friday_recap":
      return {
        title: `Friday Operating Recap | ${date} | Blueprint`,
        artifactType: "Friday Operating Recap",
        content: [
          section("Shipped", sectionIssues(weeklyDone, 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Improved", sectionIssues(recentDone, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Slipped", sectionIssues(slipped, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Risks Going Into Next Week", sectionIssues(founder, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Next Week's 3 Bets", sectionIssues(topOpenIssues(open), 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
        ].join("\n\n"),
        shouldPostSlackDigest: true,
      };
    case "weekly_gaps":
      return {
        title: `Weekly Gaps Report | ${date} | Blueprint`,
        artifactType: "Weekly Gaps Report",
        content: [
          section("What Repeatedly Broke This Week", sectionIssues(blocked, 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("What Work Required Human Rescue", sectionIssues(founder, 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Which Agents Are Producing Low-Value Output", sectionIssues(weakProof, 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Which Workflows Still Lack Software Support", sectionIssues(topOpenIssues(open), 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("What 3 Gaps Should Be Fixed Next", sectionIssues([...blocked, ...topOpenIssues(open)], 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
        ].join("\n\n"),
        shouldPostSlackDigest: false,
      };
    default:
      return {
        title: `Founder Morning Brief | ${date} | Blueprint`,
        artifactType: "Morning Founder Brief",
        content: [
          section("Done Yesterday", sectionIssues(recentDone, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("In Motion Today", sectionIssues(topOpenIssues(active), 5, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Blocked", sectionIssues(blocked, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Needs Founder", founderSectionIssues(founder, 3).map((issue) => founderDecisionPacket(issue, assigneeNameById))),
          section("Top Risks", sectionIssues(founder, 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
          section("Top Opportunities", sectionIssues(topOpenIssues(open), 3, usedFingerprints).map((issue) => founderBullet(issue, assigneeNameById))),
        ].join("\n\n"),
        shouldPostSlackDigest: true,
      };
  }
}

async function postSlackDigest(report: FounderReport, notionPageUrl: string | null, webhookUrl: string) {
  if (!report.shouldPostSlackDigest || !webhookUrl) return false;
  const lines = [
    `*${report.title}*`,
    notionPageUrl ? notionPageUrl : "Notion artifact created.",
  ];
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: lines.join("\n"),
    }),
  });
  if (!response.ok) {
    throw new Error(`Slack digest failed: ${response.status} ${response.statusText}`);
  }
  return true;
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
  const requestedKind = normalizeKind(args.get("kind"));
  const issueId = args.get("issue-id") ?? process.env.PAPERCLIP_TASK_ID;
  const dryRun = args.get("dry-run") === "true";
  const skipNotion = dryRun || args.get("skip-notion") === "true";
  const noSlack = dryRun || args.get("no-slack") === "true";
  const skipClose = dryRun || args.get("skip-close") === "true";
  const printReport = dryRun || args.get("print-report") === "true";
  const slackWebhookUrl = args.get("slack-webhook-url") ?? DEFAULT_SLACK_EXEC_WEBHOOK_URL ?? null;

  if (!issueId) {
    throw new Error("--issue-id is required");
  }
  if (!skipNotion && !NOTION_API_TOKEN) {
    throw new Error("NOTION_API_TOKEN is required");
  }

  const companies = await fetchJson<Company[]>("/api/companies");
  const company = companies.find((entry) => entry.name === COMPANY_NAME);
  if (!company) {
    throw new Error(`Company not found: ${COMPANY_NAME}`);
  }

  const [issues, agents, issue] = await Promise.all([
    fetchJson<Issue[]>(`/api/companies/${company.id}/issues`),
    fetchJson<Agent[]>(`/api/companies/${company.id}/agents`),
    fetchJson<Issue>(`/api/issues/${issueId}`),
  ]);

  const kind = requestedKind ?? inferKindFromIssueTitle(issue.title) ?? "morning";
  const date = resolveReportDate(args.get("date"), issue);

  const assigneeNameById = new Map(
    agents.map((agent) => [agent.id, agent.name?.trim() || agent.urlKey || agent.id] as const),
  );

  const report = buildReport(kind, date, issues, assigneeNameById);
  let knowledge: NotionUpsertResult | null = null;
  let slackPosted = false;

  if (!dryRun) {
    if (!skipNotion) {
      const notion = createNotionClient({ token: NOTION_API_TOKEN! });
      knowledge = await upsertKnowledgeEntry(
        notion,
        {
          title: report.title,
          type: "Reference",
          system: "Cross-System",
          content: report.content,
          artifactType: report.artifactType,
          agentSurfaces: ["Founder OS"],
          sourceOfTruth: "Notion",
          reviewCadence: "Ad Hoc",
          lastReviewed: date,
        },
        { archiveDuplicates: true },
      );
    }
    if (!noSlack && report.shouldPostSlackDigest && slackWebhookUrl) {
      slackPosted = await postSlackDigest(report, knowledge?.pageUrl ?? null, slackWebhookUrl);
    }

    if (!skipClose) {
      const comment = [
        skipNotion
          ? "Published founder report: skipped Notion write by operator flag."
          : `Published founder report: ${knowledge?.pageUrl ?? knowledge?.pageId}`,
        `Artifact: ${report.title}`,
        `Run basis: deterministic issue-state report from Paperclip API.`,
        slackPosted ? "Slack digest: posted via direct exec webhook fallback." : noSlack
          ? "Slack digest: intentionally skipped by operator flag."
          : "Slack digest: not posted by fallback path.",
      ].join("\n");

      await fetchJson(`/api/issues/${issue.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "done",
          comment,
        }),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        kind,
        issueId,
        issueTitle: issue.title,
        title: report.title,
        artifactType: report.artifactType,
        wouldPostSlackDigest: report.shouldPostSlackDigest && Boolean(slackWebhookUrl) && !noSlack,
        skipNotion,
        notionPageId: knowledge?.pageId ?? null,
        notionPageUrl: knowledge?.pageUrl ?? null,
        notionStatus: knowledge?.status ?? null,
        slackPosted,
        issueClosed: !skipClose && !dryRun,
        reportContent: printReport ? report.content : undefined,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
