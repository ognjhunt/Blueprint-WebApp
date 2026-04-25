import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getConfiguredEnvValue } from "../config/env";
import { buildOutboundReplyDurabilityStatus } from "./outbound-reply-durability";

const DEFAULT_PUBLIC_PAPERCLIP_API_URL = "https://paperclip.tryblueprint.io";
const DEFAULT_LOCAL_PAPERCLIP_API_URL = "http://127.0.0.1:3100";
const COMPANY_NAME = "Blueprint Autonomous Operations";
export const AUTONOMOUS_GROWTH_BLOCKER_ORIGIN_KIND = "autonomous_growth_blocker_status";

export function autonomousGrowthBlockerOriginId(citySlug: string) {
  return `autonomous-growth-blockers:${citySlug}`;
}

type Status = "clear" | "warning" | "blocked" | "human_gated" | "external_gated" | "unknown";

type BlockerStatus = {
  key: string;
  name: string;
  status: Status;
  lane: string;
  stageReached: string;
  evidence: string[];
  why: string;
  owner: string;
  nextAction: string;
  missingEnv?: string[];
};

type CompanySnapshot = {
  id?: string;
  name?: string;
  issueCounter?: number;
  updatedAt?: string;
  createdAt?: string;
};

type CityLaunchManifest = {
  city?: string;
  citySlug?: string;
  status?: string;
  activationStatus?: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: Record<string, unknown>;
  paperclip?: {
    rootIssueIdentifier?: string | null;
    rootIssueId?: string | null;
    dispatched?: unknown[];
  };
  outboundReadiness?: {
    status?: string;
    directOutreachActions?: {
      total?: number;
      recipientBacked?: number;
      readyToSend?: number;
      sent?: number;
    };
    emailTransport?: {
      configured?: boolean;
      provider?: string | null;
    };
    sender?: {
      fromEmail?: string | null;
      verificationStatus?: string | null;
    };
    warnings?: string[];
    blockers?: string[];
  };
};

type ContactEnrichment = {
  recovered_buyer_target_contacts?: number;
  recovered_capture_candidate_contacts?: number;
  unresolved_buyer_targets?: string[];
  warnings?: string[];
  buyer_target_candidates?: Array<{
    company_name?: string;
    contact_email?: string | null;
    notes?: string | null;
  }>;
};

type NoSignalSnapshot = {
  sentDirectOutreach: number;
  recipientBackedSent: number;
  recordedResponses: number;
  routedResponses: number;
  liveSupplyResponses: number;
  liveBuyerOperatorEngagements: number;
  approvedCapturers: number;
};

type RoutineStatus = {
  active: string[];
  paused: string[];
};

type BuildOptions = {
  repoRoot?: string;
  city?: string;
  publicPaperclipApiUrl?: string;
  localPaperclipApiUrl?: string;
  fetchImpl?: typeof fetch;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rel(repoRoot: string, filePath: string | null | undefined) {
  if (!filePath) return "";
  const resolved = path.resolve(filePath);
  return path.relative(repoRoot, resolved).replaceAll(path.sep, "/");
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFiles(dir: string, fileName: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findFiles(fullPath, fileName));
    } else if (entry.isFile() && entry.name === fileName) {
      results.push(fullPath);
    }
  }
  return results;
}

async function findLatestManifest(input: { repoRoot: string; city?: string }) {
  const baseDir = path.join(input.repoRoot, "ops/paperclip/reports/city-launch-execution");
  const citySlug = input.city ? slugify(input.city) : "";
  const manifests = (await findFiles(baseDir, "manifest.json"))
    .filter((filePath) => !citySlug || filePath.includes(`/${citySlug}/`));
  const withStats = await Promise.all(
    manifests.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );
  return withStats.sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath || null;
}

function parseCount(markdown: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`, "i"));
  if (!match) return 0;
  const value = Number(String(match[1]).trim().match(/-?\\d+(?:\\.\\d+)?/)?.[0] || "0");
  return Number.isFinite(value) ? value : 0;
}

async function readNoSignalSnapshot(repoRoot: string, citySlug: string): Promise<{
  path: string | null;
  snapshot: NoSignalSnapshot | null;
}> {
  const candidates = [
    path.join(repoRoot, "ops/paperclip/playbooks", `city-opening-${citySlug}-no-signal-scorecard.md`),
    path.join(repoRoot, "ops/paperclip/playbooks", `city-opening-${citySlug}-no-signal-recovery.md`),
  ];
  let filePath: string | null = null;
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      filePath = candidate;
      break;
    }
  }
  if (!filePath) return { path: null, snapshot: null };
  const markdown = await fs.readFile(filePath, "utf8");
  return {
    path: filePath,
    snapshot: {
      sentDirectOutreach: parseCount(markdown, "sent direct outreach"),
      recipientBackedSent: parseCount(markdown, "sent direct outreach with recipient evidence"),
      recordedResponses: parseCount(markdown, "recorded responses"),
      routedResponses: parseCount(markdown, "routed responses"),
      liveSupplyResponses: parseCount(markdown, "live supply responses"),
      liveBuyerOperatorEngagements: parseCount(markdown, "live buyer/operator engagements"),
      approvedCapturers: parseCount(markdown, "approved capturers"),
    },
  };
}

async function readContactEnrichment(repoRoot: string, citySlug: string, runDir: string | null) {
  const candidates = ([
    runDir ? path.join(runDir, `city-launch-contact-enrichment-${citySlug}.json`) : "",
    path.join(repoRoot, "ops/paperclip/playbooks", `city-launch-${citySlug}-contact-enrichment.json`),
  ].filter(Boolean) as string[]);
  const parsedCandidates = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      parsed: await readJson<ContactEnrichment>(candidate),
      mtimeMs: await fs.stat(candidate).then((stat) => stat.mtimeMs).catch(() => 0),
    })),
  );
  for (const { candidate, parsed } of parsedCandidates
    .filter((entry): entry is { candidate: string; parsed: ContactEnrichment; mtimeMs: number } => Boolean(entry.parsed))
    .sort((left, right) => {
      const recoveredDelta =
        Number(right.parsed.recovered_buyer_target_contacts || 0)
        - Number(left.parsed.recovered_buyer_target_contacts || 0);
      if (recoveredDelta !== 0) return recoveredDelta;
      return right.mtimeMs - left.mtimeMs;
    })) {
    if (parsed) {
      return { path: candidate, enrichment: parsed };
    }
  }
  return { path: null, enrichment: null };
}

async function fetchCompany(input: {
  apiUrl: string;
  fetchImpl: typeof fetch;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await input.fetchImpl(`${input.apiUrl.replace(/\/+$/, "")}/api/companies`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const rows = await response.json() as CompanySnapshot[];
    return rows.find((row) => row.name === COMPANY_NAME) || rows[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPublicBridgeIssue(input: {
  apiUrl: string;
  fetchImpl: typeof fetch;
  companyId: string;
  city: string;
  citySlug: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const search = new URLSearchParams({
      originKind: AUTONOMOUS_GROWTH_BLOCKER_ORIGIN_KIND,
      originId: autonomousGrowthBlockerOriginId(input.citySlug),
    });
    const response = await input.fetchImpl(
      `${input.apiUrl.replace(/\/+$/, "")}/api/companies/${input.companyId}/issues?${search.toString()}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const rows = await response.json() as Array<{ id?: string; identifier?: string; status?: string; title?: string }>;
    if (rows[0]) return rows[0];

    const fallbackResponse = await input.fetchImpl(
      `${input.apiUrl.replace(/\/+$/, "")}/api/companies/${input.companyId}/issues`,
      { signal: controller.signal },
    );
    if (!fallbackResponse.ok) return null;
    const fallbackRows = await fallbackResponse.json() as Array<{ id?: string; identifier?: string; status?: string; title?: string }>;
    return fallbackRows.find((row) => row.title === `Autonomous growth blocker bridge: ${input.city}`) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function envPresent(key: string) {
  return Boolean(getConfiguredEnvValue(key));
}

function missingEnv(keys: string[]) {
  return keys.filter((key) => !envPresent(key));
}

function isTruthy(value: string | undefined | null) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function summarizeEnv() {
  const citySenderVerification = getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION");
  const humanReplyMissing = missingEnv([
    "BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN",
    "BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL",
    "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID",
    "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET",
    "BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN",
    "BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS",
  ]);
  if (!isTruthy(getConfiguredEnvValue("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED"))) {
    humanReplyMissing.push("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1");
  }

  return {
    sendgridMissing: missingEnv(["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"]),
    citySenderVerification,
    humanReplyMissing,
    notionGrowthStudioMissing: missingEnv([
      "NOTION_API_KEY",
      "NOTION_API_TOKEN",
    ]).length === 2
      ? [
          "NOTION_API_KEY or NOTION_API_TOKEN",
          ...missingEnv([
            "NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID",
            "NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID",
            "NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID",
            "NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID",
            "NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID",
          ]),
        ]
      : missingEnv([
          "NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID",
          "NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID",
          "NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID",
          "NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID",
          "NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID",
        ]),
    metaMissing: missingEnv([
      "META_MARKETING_API_ACCESS_TOKEN",
      "META_PAGE_ID",
      "META_AD_ACCOUNT_ID",
    ]),
    firehoseMissing: missingEnv(["FIREHOSE_API_TOKEN", "FIREHOSE_BASE_URL"]),
    introwMissing: missingEnv(["INTROW_API_TOKEN", "INTROW_BASE_URL"]),
  };
}

async function routineStatus(repoRoot: string): Promise<RoutineStatus> {
  const configPath = path.join(repoRoot, "ops/paperclip/blueprint-company/.paperclip.yaml");
  const parsed = yaml.load(await fs.readFile(configPath, "utf8")) as {
    routines?: Record<string, { status?: string }>;
  };
  const targetRoutines = [
    "community-updates-weekly",
    "ship-broadcast-refresh",
    "ship-broadcast-approval-refresh",
    "content-feedback-refresh",
    "capturer-growth-weekly",
    "city-launch-weekly",
    "city-launch-refresh",
    "demand-intel-daily",
    "demand-intel-weekly",
    "robot-team-growth-weekly",
    "site-operator-partnership-weekly",
    "city-demand-weekly",
  ];
  const active: string[] = [];
  const paused: string[] = [];
  for (const key of targetRoutines) {
    const status = parsed.routines?.[key]?.status === "paused" ? "paused" : "active";
    if (status === "paused") paused.push(key);
    else active.push(key);
  }
  return { active, paused };
}

export async function buildAutonomousGrowthBlockerStatus(options: BuildOptions = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const publicPaperclipApiUrl = options.publicPaperclipApiUrl || DEFAULT_PUBLIC_PAPERCLIP_API_URL;
  const localPaperclipApiUrl = options.localPaperclipApiUrl || DEFAULT_LOCAL_PAPERCLIP_API_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const generatedAt = new Date().toISOString();

  const latestManifestPath = await findLatestManifest({ repoRoot, city: options.city });
  const latestManifest = latestManifestPath
    ? await readJson<CityLaunchManifest>(latestManifestPath)
    : null;
  const city = options.city || latestManifest?.city || "unknown";
  const citySlug = slugify(city);
  const runDir = latestManifestPath ? path.dirname(latestManifestPath) : null;
  const contact = await readContactEnrichment(repoRoot, citySlug, runDir);
  const noSignal = await readNoSignalSnapshot(repoRoot, citySlug);
  const env = summarizeEnv();
  const outboundReplyDurability = await buildOutboundReplyDurabilityStatus();
  const routines = await routineStatus(repoRoot);
  const [publicCompany, localCompany] = await Promise.all([
    fetchCompany({ apiUrl: publicPaperclipApiUrl, fetchImpl }),
    fetchCompany({ apiUrl: localPaperclipApiUrl, fetchImpl }),
  ]);
  const publicBridgeIssue = publicCompany?.id
    ? await fetchPublicBridgeIssue({
        apiUrl: publicPaperclipApiUrl,
        fetchImpl,
        companyId: publicCompany.id,
        city,
        citySlug,
      })
    : null;

  const publicSyncMismatch = publicCompany && localCompany
    ? (
        publicCompany.id !== localCompany.id
        || Number(publicCompany.issueCounter || 0) < Number(localCompany.issueCounter || 0)
      )
    : false;
  const noSignalSnapshot = noSignal.snapshot;
  const buyerContactsRecovered = Number(contact.enrichment?.recovered_buyer_target_contacts || 0);
  const unresolvedBuyerTargets = contact.enrichment?.unresolved_buyer_targets || [];
  const sentCount = latestManifest?.outboundReadiness?.directOutreachActions?.sent || noSignalSnapshot?.sentDirectOutreach || 0;
  const responseCount =
    (noSignalSnapshot?.recordedResponses || 0)
    + (noSignalSnapshot?.routedResponses || 0)
    + (noSignalSnapshot?.liveSupplyResponses || 0)
    + (noSignalSnapshot?.liveBuyerOperatorEngagements || 0);
  const blockers: BlockerStatus[] = [
    {
      key: "paperclip_state_sync",
      name: "Public Paperclip state must match trusted local org state",
      status: publicSyncMismatch && !publicBridgeIssue
        ? "blocked"
        : publicSyncMismatch && publicBridgeIssue
          ? "warning"
          : publicCompany && localCompany
            ? "clear"
            : "unknown",
      lane: "all Paperclip-backed autonomous execution",
      stageReached: publicCompany && localCompany
        ? `public issueCounter=${publicCompany.issueCounter ?? "unknown"}, local issueCounter=${localCompany.issueCounter ?? "unknown"}, bridgeIssue=${publicBridgeIssue?.identifier || publicBridgeIssue?.id || "none"}`
        : "could not read both public and local Paperclip companies",
      evidence: [
        `${publicPaperclipApiUrl}/api/companies`,
        `${localPaperclipApiUrl}/api/companies`,
        latestManifestPath ? rel(repoRoot, latestManifestPath) : "no city-launch manifest found",
        ...(publicBridgeIssue ? [`public bridge issue ${publicBridgeIssue.identifier || publicBridgeIssue.id}`] : []),
      ],
      why: publicSyncMismatch && !publicBridgeIssue
        ? "Founder-visible public Paperclip cannot be treated as the same operating record as the local execution tree."
        : publicSyncMismatch && publicBridgeIssue
          ? "Public Paperclip still does not contain the full local history, but it now has a bridge issue to the trusted blocker artifact."
        : "The company records are aligned or could not be compared.",
      owner: "runtime/Paperclip deploy",
      nextAction: publicSyncMismatch && !publicBridgeIssue
        ? "Create a public bridge issue or run the full Paperclip company reconciliation/deploy path, then re-run this blocker audit."
        : publicSyncMismatch && publicBridgeIssue
          ? "Use the bridge issue for immediate execution continuity; schedule full company-state migration only if historic issue continuity is required."
        : "Keep this check in the city/campaign preflight.",
    },
    {
      key: "city_live_signal",
      name: "City launch needs live response, applicant, operator, or buyer signal",
      status: sentCount > 0 && responseCount === 0 ? "external_gated" : responseCount > 0 ? "clear" : "blocked",
      lane: "city-launch, outreach, capture target motion",
      stageReached: latestManifest
        ? `${city} manifest status=${latestManifest.status || "unknown"}, sent=${sentCount}, liveSignalCount=${responseCount}`
        : "no latest city-launch manifest found",
      evidence: [
        latestManifestPath ? rel(repoRoot, latestManifestPath) : "no manifest",
        noSignal.path ? rel(repoRoot, noSignal.path) : "no no-signal scorecard",
      ],
      why: responseCount === 0
        ? "Recorded sends and generated artifacts are not replies, applicants, capturers, site authorization, hosted-review starts, or buyer outcomes."
        : "At least one live signal is present.",
      owner: "capturer-growth-agent, city-launch-agent, site-operator-partnership-agent, outbound-sales-agent",
      nextAction: responseCount === 0
        ? "Execute the no-signal recovery lanes and record an explicit reply, applicant, qualified intro, or no-response outcome."
        : "Route the live signal into qualification, operator partnership, or buyer follow-through.",
    },
    {
      key: "buyer_recipient_evidence",
      name: "Buyer direct outreach needs explicit recipient-backed contact evidence",
      status: unresolvedBuyerTargets.length > 0 ? "blocked" : buyerContactsRecovered > 0 ? "human_gated" : "unknown",
      lane: "buyer outreach, city demand",
      stageReached: `recoveredBuyerTargetContacts=${buyerContactsRecovered}, unresolvedBuyerTargets=${unresolvedBuyerTargets.length}`,
      evidence: [
        contact.path ? rel(repoRoot, contact.path) : "no contact-enrichment artifact",
        `ops/paperclip/playbooks/city-opening-${citySlug}-robot-team-contact-list.md`,
      ],
      why: unresolvedBuyerTargets.length > 0
        ? "Named buyer targets still lack explicit contact_email evidence."
        : "Explicit buyer recipient evidence exists, but live buyer send still requires proof-led copy and approval.",
      owner: "city-demand-agent, outbound-sales-agent",
      nextAction: unresolvedBuyerTargets.length > 0
        ? "Run governed contact discovery or keep buyer lane draft-only."
        : "Create buyer-specific draft actions and send only after approval/transport checks.",
    },
    {
      key: "sender_and_reply_durability",
      name: "Sender verification and durable reply resume must be production-proven",
      status: outboundReplyDurability.ok ? "clear" : "blocked",
      lane: "city-launch outreach, founder/human reply resume",
      stageReached:
        `emailTransport=${outboundReplyDurability.sender.transport.configured ? "configured" : "missing"}, `
        + `senderVerification=${outboundReplyDurability.sender.sender.verificationStatus}, `
        + `gmailProductionReady=${outboundReplyDurability.humanReply.gmail.production_ready}, `
        + `watcherEnabled=${outboundReplyDurability.humanReply.watcherEnabled}, `
        + `missingEnv=${outboundReplyDurability.missingEnv.length}`,
      evidence: [
        "DEPLOYMENT.md",
        "server/utils/outbound-reply-durability.ts",
        latestManifestPath ? rel(repoRoot, latestManifestPath) : "no manifest",
      ],
      why: "Outbound launchability requires truthful sender state, and blocker/resume loops require a durable reply watcher rather than Slack-only visibility.",
      owner: "ops/runtime config",
      nextAction:
        outboundReplyDurability.ok
          ? "Keep npm run human-replies:audit-durability and prove-production in the city-launch preflight."
          : "Run npm run human-replies:audit-durability, set the missing live env/provider state, then prove a tagged reply resumes execution.",
      missingEnv: outboundReplyDurability.missingEnv,
    },
    {
      key: "content_campaign_live_side_effects",
      name: "Ad/content/campaign lanes are intentionally draft-first for live side effects",
      status: "human_gated",
      lane: "ads, content, campaign sends, brand assets",
      stageReached: "Ad Studio can create briefs/handoffs; growth campaigns write drafts; live sends/public posts/paid spend require approval.",
      evidence: [
        "server/utils/ad-studio.ts",
        "server/utils/growth-ops.ts",
        "server/agents/action-policies.ts",
      ],
      why: "This is the correct guardrail until product policy defines narrow auto-publish or paid-spend criteria.",
      owner: "growth-lead, community-updates-agent, webapp-codex",
      nextAction: "Keep draft creation autonomous; add narrow auto-approval only after a product/doctrine decision.",
    },
    {
      key: "marketing_provider_config",
      name: "Marketing integrations require provider and Notion Growth Studio config",
      status:
        env.metaMissing.length === 0
        && env.notionGrowthStudioMissing.length === 0
        && env.firehoseMissing.length === 0
        && env.introwMissing.length === 0
          ? "clear"
          : "blocked",
      lane: "Meta ads, Growth Studio Notion mirror, Firehose/Introw enrichment",
      stageReached: `missingMeta=${env.metaMissing.length}, missingNotionGrowthStudio=${env.notionGrowthStudioMissing.length}, missingFirehose=${env.firehoseMissing.length}, missingIntrow=${env.introwMissing.length}`,
      evidence: [
        "server/utils/meta-marketing.ts",
        "server/utils/notion-sync.ts",
        "ops/paperclip/plugins/blueprint-automation/src/marketing-integrations.ts",
      ],
      why: "Adapters exist, but the runtime cannot create paused Meta drafts or mirror Growth Studio proof without configured providers.",
      owner: "ops/runtime config",
      nextAction: "Provide only the provider credentials you want enabled; leave unsupported providers disabled and draft-only.",
      missingEnv: [
        ...env.metaMissing,
        ...env.notionGrowthStudioMissing,
        ...env.firehoseMissing,
        ...env.introwMissing,
      ],
    },
    {
      key: "scheduled_routine_posture",
      name: "Scheduled content/city routines must be explicit about active vs paused posture",
      status: routines.paused.some((key) => key.includes("city-launch") || key.includes("community") || key.includes("ship-broadcast"))
        ? "warning"
        : "clear",
      lane: "proactive content, broadcast, city launch refresh",
      stageReached: `active=${routines.active.join(", ") || "none"}; paused=${routines.paused.join(", ") || "none"}`,
      evidence: ["ops/paperclip/blueprint-company/.paperclip.yaml"],
      why: "Manual/event-driven execution can work while paused schedules remain intentionally quiet. This should be explicit, not rediscovered in audits.",
      owner: "blueprint-cto, growth-lead",
      nextAction: "Only unpause routines that are drill-proven and produce proof-bearing artifacts without live side effects.",
    },
  ];

  const report = {
    generatedAt,
    city,
    citySlug,
    latestManifestPath: latestManifestPath ? rel(repoRoot, latestManifestPath) : null,
    overallStatus: blockers.some((entry) => entry.status === "blocked")
      ? "blocked"
      : blockers.some((entry) => entry.status === "warning" || entry.status === "human_gated" || entry.status === "external_gated")
        ? "gated"
        : "clear",
    blockers,
    paperclip: {
      publicCompany,
      localCompany,
      publicBridgeIssue,
      publicPaperclipApiUrl,
      localPaperclipApiUrl,
    },
    outboundReplyDurability,
  };

  return report;
}

export function renderAutonomousGrowthBlockerMarkdown(report: Awaited<ReturnType<typeof buildAutonomousGrowthBlockerStatus>>) {
  return [
    `# Autonomous Growth Blocker Status - ${report.city}`,
    "",
    `- generated_at: ${report.generatedAt}`,
    `- overall_status: ${report.overallStatus}`,
    `- latest_manifest: ${report.latestManifestPath || "none"}`,
    "",
    "## Ranked Blockers",
    "",
    "| Blocker | Status | Owner | Next action |",
    "| --- | --- | --- | --- |",
    ...report.blockers.map((entry) =>
      `| ${entry.name} | ${entry.status} | ${entry.owner} | ${entry.nextAction.replace(/\|/g, "/")} |`,
    ),
    "",
    "## Details",
    "",
    ...report.blockers.flatMap((entry, index) => [
      `### ${index + 1}. ${entry.name}`,
      "",
      `- key: ${entry.key}`,
      `- status: ${entry.status}`,
      `- lane: ${entry.lane}`,
      `- stage_reached: ${entry.stageReached}`,
      `- why: ${entry.why}`,
      `- owner: ${entry.owner}`,
      `- next_action: ${entry.nextAction}`,
      ...(entry.missingEnv?.length
        ? [
            "- missing_env:",
            ...entry.missingEnv.map((key) => `  - ${key}`),
          ]
        : ["- missing_env: none"]),
      "- evidence:",
      ...entry.evidence.map((item) => `  - ${item}`),
      "",
    ]),
  ].join("\n");
}
