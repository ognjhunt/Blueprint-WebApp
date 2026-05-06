import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AUTONOMOUS_GROWTH_BLOCKER_ORIGIN_KIND,
  autonomousGrowthBridgeIssueFingerprint,
  autonomousGrowthBridgeIssueStatus,
  autonomousGrowthBlockerOriginId,
  buildAutonomousGrowthBlockerStatus,
  renderAutonomousGrowthBlockerMarkdown,
  shouldRefreshAutonomousGrowthBridgeIssue,
} from "../../server/utils/autonomousGrowthBlockerStatus";
import {
  upsertPaperclipIssue,
} from "../../server/utils/paperclip";

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1]?.trim() || "";
  return "";
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const repoRoot = process.cwd();
  const city = argValue("--city") || undefined;
  const report = await buildAutonomousGrowthBlockerStatus({
    repoRoot,
    city,
    publicPaperclipApiUrl: argValue("--public-paperclip-api-url") || undefined,
    localPaperclipApiUrl: argValue("--local-paperclip-api-url") || undefined,
  });
  const outputRoot = path.join(
    repoRoot,
    "ops/paperclip/reports/autonomous-growth-blockers",
    slugify(report.city || "unknown-city"),
    stableTimestamp(),
  );
  const jsonPath = path.join(outputRoot, "blocker-status.json");
  const markdownPath = path.join(outputRoot, "blocker-status.md");
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(markdownPath, renderAutonomousGrowthBlockerMarkdown(report), "utf8");
  let bridgeIssue: { id: string; identifier?: string | null; created: boolean; refreshed?: boolean } | null = null;

  if (hasFlag("--create-paperclip-bridge")) {
    const bridgePaperclipApiUrl =
      argValue("--bridge-paperclip-api-url")
      || argValue("--public-paperclip-api-url")
      || process.env.PAPERCLIP_API_URL;
    if (bridgePaperclipApiUrl) {
      process.env.PAPERCLIP_API_URL = bridgePaperclipApiUrl;
    }
    if (
      bridgePaperclipApiUrl
      && report.paperclip.publicPaperclipApiUrl.replace(/\/+$/, "") === bridgePaperclipApiUrl.replace(/\/+$/, "")
      && report.paperclip.publicCompany?.id
    ) {
      process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = report.paperclip.publicCompany.id;
    }
    const desiredBridgeStatus = autonomousGrowthBridgeIssueStatus(report.overallStatus);
    const desiredBridgeFingerprint = autonomousGrowthBridgeIssueFingerprint({
      blockers: report.blockers,
    });
    const existingBridgeIssue = report.paperclip.publicBridgeIssue;
    const forceBridgeRefresh = hasFlag("--force-paperclip-bridge-refresh");

    const shouldRefreshBridge = shouldRefreshAutonomousGrowthBridgeIssue({
      existingIssue: existingBridgeIssue,
      desiredStatus: desiredBridgeStatus,
      desiredFingerprint: desiredBridgeFingerprint,
      force: forceBridgeRefresh,
    });

    if (!shouldRefreshBridge && existingBridgeIssue?.id) {
      bridgeIssue = {
        id: existingBridgeIssue.id,
        identifier: existingBridgeIssue.identifier || null,
        created: false,
        refreshed: false,
      };
    } else {
      const description = [
        `# Autonomous Growth Blocker Bridge - ${report.city}`,
        "",
        "This issue bridges the founder-visible Paperclip control plane to the current repo-backed blocker artifact.",
        "",
        `- generated_at: ${report.generatedAt}`,
        `- overall_status: ${report.overallStatus}`,
        `- blocker_report_json: ${jsonPath}`,
        `- blocker_report_markdown: ${markdownPath}`,
        `- latest_city_manifest: ${report.latestManifestPath || "none"}`,
        `- blocker_fingerprint: ${desiredBridgeFingerprint}`,
        "",
        "Use this issue as the public execution pointer until full Paperclip company-state migration is intentionally performed.",
        "",
        "Current blockers:",
        ...report.blockers.map((entry) => `- ${entry.status}: ${entry.name} -> ${entry.nextAction}`),
      ].join("\n");

      const upsert = await upsertPaperclipIssue({
        projectName: "blueprint-executive-ops",
        assigneeKey: "growth-lead",
        title: `Autonomous growth blocker bridge: ${report.city}`,
        description,
        priority: "high",
        status: desiredBridgeStatus,
        originKind: AUTONOMOUS_GROWTH_BLOCKER_ORIGIN_KIND,
        originId: autonomousGrowthBlockerOriginId(report.citySlug),
        existingIssueId: existingBridgeIssue?.id || null,
      });
      bridgeIssue = {
        id: upsert.issue.id,
        identifier: upsert.issue.identifier || null,
        created: upsert.created,
        refreshed: true,
      };
    }
  }

  const summary = {
    ok: report.overallStatus !== "blocked",
    overallStatus: report.overallStatus,
    city: report.city,
    blocked: report.blockers
      .filter((entry) => entry.status === "blocked")
      .map((entry) => entry.key),
    gated: report.blockers
      .filter((entry) => ["warning", "human_gated", "external_gated"].includes(entry.status))
      .map((entry) => entry.key),
    jsonPath,
    markdownPath,
    bridgeIssue,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (hasFlag("--fail-on-blocked") && report.overallStatus === "blocked") {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
