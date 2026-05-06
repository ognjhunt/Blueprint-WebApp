import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { validateRecipientEmailAddress } from "../agents/action-policies";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function listRepoRecipientEvidenceFiles() {
  const issueUpdatesDir = path.join(REPO_ROOT, "issue-updates");
  const playbooksDir = path.join(REPO_ROOT, "ops/paperclip/playbooks");

  const issueUpdateFiles = await fs.readdir(issueUpdatesDir)
    .then((entries) =>
      entries
        .filter((entry) => entry.endsWith(".md"))
        .sort()
        .reverse()
        .map((entry) => path.join(issueUpdatesDir, entry)),
    )
    .catch(() => [] as string[]);

  const playbookFiles = await fs.readdir(playbooksDir)
    .then((entries) =>
      entries
        .filter((entry) =>
          /^city-opening-.*-(robot-team-contact-list|site-operator-contact-list|first-wave-pack|robot-team-email-drafts)\.md$/i.test(entry)
          || /^city-launch-.*-outbound-package\.md$/i.test(entry),
        )
        .sort()
        .reverse()
        .map((entry) => path.join(playbooksDir, entry)),
    )
    .catch(() => [] as string[]);

  return [...issueUpdateFiles, ...playbookFiles];
}

function extractRepoRecipientEvidence(input: {
  target: { raw: string; key: string };
  filePath: string;
  content: string;
}) {
  const lines = input.content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const lineKey = normalizeComparableText(currentLine);
    if (!lineKey.includes(input.target.key)) {
      continue;
    }

    const sameLineEmails = currentLine.match(EMAIL_PATTERN);
    if (sameLineEmails && sameLineEmails.length > 0) {
      const recipientEmail = sameLineEmails[0].toLowerCase();
      if (!validateRecipientEmailAddress(recipientEmail).valid) {
        continue;
      }
      return {
        recipientEmail,
        source: `Recipient sourced from repo artifact evidence in ${path.relative(REPO_ROOT, input.filePath).replaceAll(path.sep, "/")} for ${input.target.raw}.`,
      };
    }

    const nearby = lines
      .slice(index + 1, Math.min(lines.length, index + 3))
      .join(" ");
    const nearbyEmails = nearby.match(EMAIL_PATTERN);
    if (!nearbyEmails || nearbyEmails.length === 0) {
      continue;
    }
    const recipientEmail = nearbyEmails[0].toLowerCase();
    if (!validateRecipientEmailAddress(recipientEmail).valid) {
      continue;
    }
    return {
      recipientEmail,
      source: `Recipient sourced from repo artifact evidence in ${path.relative(REPO_ROOT, input.filePath).replaceAll(path.sep, "/")} for ${input.target.raw}.`,
    };
  }
  return null;
}

export async function resolveRepoArtifactRecipientEvidence(params: {
  targets: Array<string | null | undefined>;
}) {
  const targets = params.targets
    .map((target) => ({
      raw: String(target || "").trim(),
      key: normalizeComparableText(target),
    }))
    .filter(
      (entry): entry is { raw: string; key: string } =>
        Boolean(entry.raw && entry.key),
    );

  if (targets.length === 0) {
    return new Map<string, { recipientEmail: string; source: string }>();
  }

  const matches = new Map<string, { recipientEmail: string; source: string }>();
  const files = await listRepoRecipientEvidenceFiles();

  for (const filePath of files) {
    if (targets.every((target) => matches.has(target.key))) {
      break;
    }

    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!content) {
      continue;
    }

    for (const target of targets) {
      if (matches.has(target.key)) {
        continue;
      }
      const evidence = extractRepoRecipientEvidence({
        target,
        filePath,
        content,
      });
      if (evidence) {
        matches.set(target.key, evidence);
      }
    }
  }

  return matches;
}

export async function resolveHistoricalRecipientEvidence(params: {
  targets: Array<string | null | undefined>;
}) {
  const targets = params.targets
    .map((target) => ({
      raw: String(target || "").trim(),
      key: normalizeComparableText(target),
    }))
    .filter(
      (entry): entry is { raw: string; key: string } =>
        Boolean(entry.raw && entry.key),
    );

  if (targets.length === 0) {
    return new Map<string, { recipientEmail: string; source: string }>();
  }

  const allowRepoArtifactEvidence = process.env.BLUEPRINT_CITY_LAUNCH_REPO_RECIPIENT_EVIDENCE === "1"
    || (
      !process.env.NODE_ENV?.startsWith("test")
      && !process.env.VITEST
      && process.env.BLUEPRINT_CITY_LAUNCH_REPO_RECIPIENT_EVIDENCE !== "0"
    );

  const repoMatches = allowRepoArtifactEvidence
    ? await resolveRepoArtifactRecipientEvidence({
      targets: targets.map((target) => target.raw),
    })
    : new Map<string, { recipientEmail: string; source: string }>();

  if (!db || process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    return repoMatches;
  }

  const [campaignSnapshot, eventSnapshot] = await Promise.all([
    db.collection("growthCampaigns").orderBy("created_at", "desc").limit(200).get(),
    db.collection("growth_campaign_events").orderBy("received_at", "desc").limit(500).get(),
  ]);

  const campaignIdsWithEvidence = new Set(
    eventSnapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .map((data) => {
        if (typeof data.local_campaign_id === "string" && data.local_campaign_id.trim()) {
          return data.local_campaign_id.trim();
        }
        if (
          typeof data.campaign_id === "string"
          && data.campaign_id.trim()
          && data.campaign_id !== "unknown"
        ) {
          return data.campaign_id.trim();
        }
        return "";
      })
      .filter(Boolean),
  );

  const matches = new Map<string, { recipientEmail: string; source: string }>(repoMatches);

  for (const doc of campaignSnapshot.docs) {
    if (!campaignIdsWithEvidence.has(doc.id)) {
      continue;
    }

    const data = doc.data() as Record<string, unknown>;
    const recipientEmails = Array.isArray(data.recipient_emails)
      ? data.recipient_emails.filter(
          (entry): entry is string =>
            typeof entry === "string"
            && Boolean(entry.trim())
            && validateRecipientEmailAddress(entry).valid,
        )
      : [];
    if (recipientEmails.length === 0) {
      continue;
    }

    const searchableText = normalizeComparableText(
      [
        typeof data.name === "string" ? data.name : "",
        typeof data.subject === "string" ? data.subject : "",
        typeof data.body === "string" ? data.body : "",
      ].join(" "),
    );

    for (const target of targets) {
      if (matches.has(target.key) || !searchableText.includes(target.key)) {
        continue;
      }
      matches.set(target.key, {
        recipientEmail: recipientEmails[0],
        source: `Recipient sourced from real growth campaign delivery evidence for ${target.raw}.`,
      });
    }
  }

  return matches;
}
