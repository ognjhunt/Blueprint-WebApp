import fs from "node:fs/promises";
import path from "node:path";

type Command = "raw-source" | "compiled-page" | "report";

type ParsedArgs = {
  command: Command | null;
  flags: Map<string, string[]>;
};

const workspaceRoot = process.cwd();
const knowledgeRoot = path.join(workspaceRoot, "knowledge");
const indexesRoot = path.join(knowledgeRoot, "indexes");

const allowedSourceSystems = new Set(["paperclip", "notion", "repo", "web", "drive"]);
const allowedAuthority = new Set(["canonical", "derived", "draft"]);
const allowedSensitivity = new Set(["public", "internal", "restricted"]);
const allowedPageKinds = new Set([
  "buyer_dossier",
  "market_entity",
  "city_brief",
  "proof_pattern",
  "doctrine_claim",
  "support_playbook",
]);
const allowedReviewStatus = new Set(["active", "watch", "stale", "blocked"]);

function parseArgs(argv: string[]): ParsedArgs {
  let command: Command | null = null;
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!command && (token === "raw-source" || token === "compiled-page" || token === "report")) {
      command = token;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, [...(flags.get(key) ?? []), "true"]);
      continue;
    }

    flags.set(key, [...(flags.get(key) ?? []), next]);
    index += 1;
  }

  return { command, flags };
}

function getFirst(flags: Map<string, string[]>, key: string) {
  return flags.get(key)?.[0] ?? "";
}

function getMany(flags: Map<string, string[]>, key: string) {
  return (flags.get(key) ?? []).map((value) => value.trim()).filter(Boolean);
}

function hasFlag(flags: Map<string, string[]>, key: string) {
  return flags.has(key);
}

function requireValue(flags: Map<string, string[]>, key: string) {
  const value = getFirst(flags, key).trim();
  if (!value) {
    throw new Error(`Missing required flag --${key}`);
  }
  return value;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoIsoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderBulletList(items: string[], fallback: string) {
  if (items.length === 0) {
    return `- ${fallback}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function quoteYamlString(value: string) {
  return JSON.stringify(value);
}

function buildSourceUrlsYaml(items: string[]) {
  return items.map((item) => `  - ${quoteYamlString(item)}`).join("\n");
}

function buildSimpleYamlList(items: string[], indent = "  ") {
  return items.map((item) => `${indent}- ${quoteYamlString(item)}`).join("\n");
}

function parseCanonicalRefs(flags: Map<string, string[]>) {
  const systems = getMany(flags, "canonical-ref-system");
  const refs = getMany(flags, "canonical-ref");
  if (systems.length !== refs.length) {
    throw new Error(
      "Canonical refs must provide matching counts for --canonical-ref-system and --canonical-ref.",
    );
  }
  return systems.map((system, index) => ({ system, ref: refs[index] }));
}

function buildOptionalFrontmatterBlock(params: {
  pageKind?: string;
  subjectKey?: string;
  canonicalRefs?: Array<{ system: string; ref: string }>;
  freshnessSlaDays?: string;
  lastSignalAt?: string;
  reviewStatus?: string;
  entityTags?: string[];
}) {
  const lines: string[] = [];

  if (params.pageKind) {
    lines.push(`page_kind: ${params.pageKind}`);
  }
  if (params.subjectKey) {
    lines.push(`subject_key: ${quoteYamlString(params.subjectKey)}`);
  }
  if (params.canonicalRefs && params.canonicalRefs.length > 0) {
    lines.push("canonical_refs:");
    for (const canonicalRef of params.canonicalRefs) {
      lines.push(`  - system: ${quoteYamlString(canonicalRef.system)}`);
      lines.push(`    ref: ${quoteYamlString(canonicalRef.ref)}`);
    }
  }
  if (params.freshnessSlaDays) {
    lines.push(`freshness_sla_days: ${params.freshnessSlaDays}`);
  }
  if (params.lastSignalAt) {
    lines.push(`last_signal_at: ${params.lastSignalAt}`);
  }
  if (params.reviewStatus) {
    lines.push(`review_status: ${params.reviewStatus}`);
  }
  if (params.entityTags && params.entityTags.length > 0) {
    lines.push("entity_tags:");
    lines.push(buildSimpleYamlList(params.entityTags));
  }

  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function buildCanonicalLinksBlock(canonicalRefs: Array<{ system: string; ref: string }>) {
  if (canonicalRefs.length === 0) {
    return "- Link the canonical system(s) that own the truth for this subject";
  }

  return canonicalRefs
    .map((canonicalRef) => `- ${canonicalRef.system}: ${canonicalRef.ref}`)
    .join("\n");
}

function buildCompiledBodyStructure(
  pageKind: string | undefined,
  openQuestionsBlock: string,
  canonicalLinksBlock: string,
) {
  if (
    pageKind === "buyer_dossier" ||
    pageKind === "market_entity" ||
    pageKind === "city_brief"
  ) {
    return `## Current State

- Current reusable state of play

## Evidence

- Source-backed claim with locator
- Source-backed claim with locator

## Signals

- \`YYYY-MM-DD\`: what changed and why it matters

## Implications For Blueprint

- What this changes for packaging, GTM, buyer enablement, or ops
- What should not be inferred beyond the evidence

## Open Questions

${openQuestionsBlock}

## Canonical Links

${canonicalLinksBlock}

## Authority Boundary

This page is a derived Hermes KB artifact. It is not authoritative for work state, approvals, rights/privacy decisions, pricing/legal commitments, capture provenance, or package/runtime truth. Check the linked canonical systems before acting.`;
  }

  if (
    pageKind === "proof_pattern" ||
    pageKind === "doctrine_claim" ||
    pageKind === "support_playbook"
  ) {
    return `## Pattern

- Describe the reusable pattern or claim boundary

## Evidence

- Source-backed claim with locator
- Source-backed claim with locator

## Failure Modes

- Where this pattern breaks or becomes misleading

## Implications For Blueprint

- What this changes for packaging, GTM, buyer enablement, or ops
- What should not be inferred beyond the evidence

## Open Questions

${openQuestionsBlock}

## Authority Boundary

This page is a derived Hermes KB artifact. It is not authoritative for work state, approvals, rights/privacy decisions, pricing/legal commitments, capture provenance, or package/runtime truth. Check the linked canonical systems before acting.`;
  }

  return `## Evidence

- Source-backed claim with locator
- Source-backed claim with locator

## Implications For Blueprint

- What this changes for packaging, GTM, buyer enablement, or ops
- What should not be inferred beyond the evidence

## Open Questions

${openQuestionsBlock}

## Authority Boundary

This page is a derived Hermes KB artifact. It is not authoritative for work state, approvals, rights/privacy decisions, pricing/legal commitments, capture provenance, or package/runtime truth. Check the linked canonical systems before acting.`;
}

function applyTemplate(template: string, replacements: Record<string, string>) {
  let rendered = template;
  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered;
}

async function readTemplate(relativePath: string) {
  const absolutePath = path.join(knowledgeRoot, "templates", relativePath);
  return fs.readFile(absolutePath, "utf8");
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function requireIsoDate(value: string, flag: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid value for --${flag}: expected YYYY-MM-DD`);
  }
  return value;
}

async function ensureParentDir(targetPath: string, dryRun: boolean) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

function assertEnum(value: string, allowed: Set<string>, flag: string) {
  if (!allowed.has(value)) {
    throw new Error(`Invalid value for --${flag}: ${value}`);
  }
}

function toRepoRelative(absolutePath: string) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function toAbsoluteFromRepoPath(repoPath: string) {
  const normalized = repoPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, normalized);
  if (!absolute.startsWith(workspaceRoot)) {
    throw new Error(`Path escapes workspace root: ${repoPath}`);
  }
  return absolute;
}

function relativeMarkdownLink(fromFile: string, toFile: string) {
  return path.relative(path.dirname(fromFile), toFile).replace(/\\/g, "/");
}

function makeMarkdownLink(indexFile: string, absoluteTarget: string) {
  const label = toRepoRelative(absoluteTarget);
  const href = relativeMarkdownLink(indexFile, absoluteTarget);
  return `[${label}](${href})`;
}

async function appendUniqueLine(indexFile: string, line: string, dryRun: boolean) {
  const existing = (await fs.readFile(indexFile, "utf8")).split("\n");
  if (existing.includes(line)) {
    return false;
  }

  if (!dryRun) {
    const next = `${existing.join("\n").replace(/\s*$/, "")}\n${line}\n`;
    await fs.writeFile(indexFile, next, "utf8");
  }

  return true;
}

async function removeLinesContaining(indexFile: string, needle: string, dryRun: boolean) {
  const existing = (await fs.readFile(indexFile, "utf8")).split("\n");
  const filtered = existing.filter((line) => !line.includes(needle));
  const changed = filtered.length !== existing.length;

  if (changed && !dryRun) {
    await fs.writeFile(indexFile, `${filtered.join("\n").replace(/\s*$/, "")}\n`, "utf8");
  }

  return changed;
}

async function scaffoldRawSource(flags: Map<string, string[]>, dryRun: boolean) {
  const sourceSystem = requireValue(flags, "source-system");
  assertEnum(sourceSystem, allowedSourceSystems, "source-system");

  const title = requireValue(flags, "title");
  const slug = getFirst(flags, "slug").trim() || slugify(title);
  const sensitivity = getFirst(flags, "sensitivity").trim() || "internal";
  assertEnum(sensitivity, allowedSensitivity, "sensitivity");

  const sourceLocators = [
    ...getMany(flags, "source-locator"),
    ...getMany(flags, "source-url"),
  ];
  if (sourceLocators.length === 0) {
    throw new Error("Provide at least one --source-locator or --source-url.");
  }

  const captureNotes = getMany(flags, "capture-note");
  const extractionIssues = getMany(flags, "extraction-issue");
  const nextDestinations = getMany(flags, "next-kb-destination");
  const openQuestions = getMany(flags, "open-question");
  const capturedAt = requireIsoDate(
    getFirst(flags, "captured-at").trim() || todayIsoDate(),
    "captured-at",
  );

  const folder = path.join(knowledgeRoot, "raw", sourceSystem, capturedAt, slug);
  const filePath = path.join(folder, "source-note.md");
  if (await fileExists(filePath)) {
    throw new Error(`Raw source note already exists: ${toRepoRelative(filePath)}`);
  }

  const template = await readTemplate("raw-source-note.template.md");
  const content = applyTemplate(template, {
    TITLE: title,
    SOURCE_LOCATORS_BLOCK: renderBulletList(sourceLocators, "Add source locator"),
    SOURCE_SYSTEM: sourceSystem,
    CAPTURE_NOTES_BLOCK: renderBulletList(
      captureNotes,
      "Describe how this source was collected and whether it is partial or transformed",
    ),
    SENSITIVITY: sensitivity,
    EXTRACTION_ISSUES_BLOCK: renderBulletList(
      extractionIssues,
      "Note OCR issues, formatting loss, or missing assets if applicable",
    ),
    NEXT_KB_DESTINATION_BLOCK: renderBulletList(
      nextDestinations,
      "Which compiled page or report should consume this source",
    ),
  });

  await ensureParentDir(filePath, dryRun);
  if (!dryRun) {
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(filePath, `${content.trimEnd()}\n`, "utf8");
  }

  const created: string[] = [toRepoRelative(filePath)];
  const indexUpdates: string[] = [];

  for (const question of openQuestions) {
    const indexFile = path.join(indexesRoot, "open-questions.md");
    const pageLink = makeMarkdownLink(indexFile, filePath);
    const line = `- \`${question}\`: raised from ${pageLink}; source system ${sourceSystem}`;
    if (await appendUniqueLine(indexFile, line, dryRun)) {
      indexUpdates.push(`open-questions.md`);
    }
  }

  return { created, indexUpdates };
}

async function scaffoldCompiledPage(flags: Map<string, string[]>, dryRun: boolean) {
  const category = requireValue(flags, "category").replace(/^\/+|\/+$/g, "");
  const title = requireValue(flags, "title");
  const slug = getFirst(flags, "slug").trim() || slugify(title);
  const authority = getFirst(flags, "authority").trim() || "derived";
  const sourceSystem = requireValue(flags, "source-system");
  const owner = requireValue(flags, "owner");
  const sensitivity = getFirst(flags, "sensitivity").trim() || "internal";
  const confidence = getFirst(flags, "confidence").trim() || "0.7";

  assertEnum(authority, allowedAuthority, "authority");
  assertEnum(sourceSystem, allowedSourceSystems, "source-system");
  assertEnum(sensitivity, allowedSensitivity, "sensitivity");

  const numericConfidence = Number(confidence);
  if (Number.isNaN(numericConfidence) || numericConfidence < 0 || numericConfidence > 1) {
    throw new Error("Confidence must be a number between 0 and 1.");
  }

  const sourceUrls = [
    ...getMany(flags, "source-url"),
    ...getMany(flags, "source-locator"),
  ];
  if (sourceUrls.length === 0) {
    throw new Error("Provide at least one --source-url or --source-locator.");
  }

  const openQuestions = getMany(flags, "open-question");
  const relatedPages = getMany(flags, "related-page");
  const contradictions = getMany(flags, "contradiction");
  const staleReason = getFirst(flags, "stale-reason").trim();
  const lastVerifiedAt = getFirst(flags, "last-verified-at").trim() || todayIsoDate();
  requireIsoDate(lastVerifiedAt, "last-verified-at");
  const pageKind = getFirst(flags, "page-kind").trim() || undefined;
  if (pageKind) {
    assertEnum(pageKind, allowedPageKinds, "page-kind");
  }
  const subjectKey = getFirst(flags, "subject-key").trim();
  const freshnessSlaDays = getFirst(flags, "freshness-sla-days").trim();
  const lastSignalAt = getFirst(flags, "last-signal-at").trim();
  if (lastSignalAt) {
    requireIsoDate(lastSignalAt, "last-signal-at");
  }
  const reviewStatus = getFirst(flags, "review-status").trim();
  if (reviewStatus) {
    assertEnum(reviewStatus, allowedReviewStatus, "review-status");
  }
  const entityTags = getMany(flags, "entity-tag");
  const canonicalRefs = parseCanonicalRefs(flags);

  if (
    (pageKind === "buyer_dossier" || pageKind === "market_entity" || pageKind === "city_brief")
    && !subjectKey
  ) {
    throw new Error("Dossier-style compiled pages require --subject-key.");
  }

  const pagePath = path.join(knowledgeRoot, "compiled", category, `${slug}.md`);
  if (await fileExists(pagePath)) {
    throw new Error(`Compiled page already exists: ${toRepoRelative(pagePath)}`);
  }

  const template = pageKind
    ? await readTemplate(
        pageKind === "buyer_dossier"
          ? "buyer-dossier.template.md"
          : pageKind === "market_entity"
            ? "market-entity.template.md"
            : pageKind === "city_brief"
              ? "city-brief.template.md"
              : pageKind === "proof_pattern"
                ? "proof-pattern.template.md"
                : pageKind === "doctrine_claim"
                  ? "doctrine-claim.template.md"
                  : "compiled-page.template.md",
      )
    : await readTemplate("compiled-page.template.md");
  const openQuestionsBlock = renderBulletList(
    openQuestions,
    "What remains unresolved and what evidence would change confidence",
  );
  const canonicalLinksBlock = buildCanonicalLinksBlock(canonicalRefs);
  const content = applyTemplate(template, {
    AUTHORITY: authority,
    SOURCE_SYSTEM: sourceSystem,
    SOURCE_URLS_YAML: buildSourceUrlsYaml(sourceUrls),
    LAST_VERIFIED_AT: lastVerifiedAt,
    OWNER: owner,
    SENSITIVITY: sensitivity,
    CONFIDENCE: numericConfidence.toString(),
    SUBJECT_KEY: quoteYamlString(subjectKey || slug),
    OPTIONAL_FRONTMATTER_BLOCK: buildOptionalFrontmatterBlock({
      pageKind,
      subjectKey: subjectKey || undefined,
      canonicalRefs,
      freshnessSlaDays: freshnessSlaDays || undefined,
      lastSignalAt: lastSignalAt || undefined,
      reviewStatus: reviewStatus || undefined,
      entityTags,
    }),
    TITLE: title,
    OPEN_QUESTIONS_BLOCK: openQuestionsBlock,
    CANONICAL_LINKS_BLOCK: canonicalLinksBlock,
    BODY_STRUCTURE: buildCompiledBodyStructure(pageKind, openQuestionsBlock, canonicalLinksBlock),
  });

  await ensureParentDir(pagePath, dryRun);
  if (!dryRun) {
    await fs.writeFile(pagePath, `${content.trimEnd()}\n`, "utf8");
  }

  const created: string[] = [toRepoRelative(pagePath)];
  const indexUpdates: string[] = [];

  const staleIndex = path.join(indexesRoot, "stale-pages.md");
  const staleNeedle = `[${toRepoRelative(pagePath)}]`;
  if (await removeLinesContaining(staleIndex, staleNeedle, dryRun)) {
    indexUpdates.push("stale-pages.md");
  }

  if (staleReason) {
    const pageLink = makeMarkdownLink(staleIndex, pagePath);
    const line = `- ${pageLink}: last verified \`${lastVerifiedAt}\`, owner ${owner}, ${staleReason}`;
    if (await appendUniqueLine(staleIndex, line, dryRun)) {
      indexUpdates.push("stale-pages.md");
    }
  }

  const openQuestionsIndex = path.join(indexesRoot, "open-questions.md");
  for (const question of openQuestions) {
    const pageLink = makeMarkdownLink(openQuestionsIndex, pagePath);
    const line = `- \`${question}\`: raised from ${pageLink}; owner ${owner}`;
    if (await appendUniqueLine(openQuestionsIndex, line, dryRun)) {
      indexUpdates.push("open-questions.md");
    }
  }

  const backlinksIndex = path.join(indexesRoot, "backlinks.md");
  for (const relatedPage of relatedPages) {
    const absoluteRelated = toAbsoluteFromRepoPath(relatedPage);
    if (!(await fileExists(absoluteRelated))) {
      throw new Error(`Related page does not exist: ${relatedPage}`);
    }
    const left = makeMarkdownLink(backlinksIndex, pagePath);
    const right = makeMarkdownLink(backlinksIndex, absoluteRelated);
    const line = `- ${left} <-> ${right}: related during KB ingest scaffolding`;
    if (await appendUniqueLine(backlinksIndex, line, dryRun)) {
      indexUpdates.push("backlinks.md");
    }
  }

  const contradictionsIndex = path.join(indexesRoot, "contradictions.md");
  for (const contradiction of contradictions) {
    const pageLink = makeMarkdownLink(contradictionsIndex, pagePath);
    const line = `- ${pageLink}: ${contradiction}`;
    if (await appendUniqueLine(contradictionsIndex, line, dryRun)) {
      indexUpdates.push("contradictions.md");
    }
  }

  return { created, indexUpdates };
}

function buildLinkedKbPagesBlock(fromFile: string, relatedPages: string[]) {
  if (relatedPages.length === 0) {
    return "- Related KB pages";
  }

  return relatedPages.map((relatedPage) => {
    const absoluteRelated = toAbsoluteFromRepoPath(relatedPage);
    const label = toRepoRelative(absoluteRelated);
    const href = relativeMarkdownLink(fromFile, absoluteRelated);
    return `- [${label}](${href})`;
  }).join("\n");
}

async function scaffoldReport(flags: Map<string, string[]>, dryRun: boolean) {
  const category = requireValue(flags, "category").replace(/^\/+|\/+$/g, "");
  const title = requireValue(flags, "title");
  const slug = getFirst(flags, "slug").trim() || slugify(title);
  const authority = getFirst(flags, "authority").trim() || "draft";
  const sourceSystem = requireValue(flags, "source-system");
  const owner = requireValue(flags, "owner");
  const sensitivity = getFirst(flags, "sensitivity").trim() || "internal";
  const confidence = getFirst(flags, "confidence").trim() || "0.65";
  const lastVerifiedAt = requireIsoDate(
    getFirst(flags, "last-verified-at").trim() || todayIsoDate(),
    "last-verified-at",
  );
  const reportDate = requireIsoDate(
    getFirst(flags, "report-date").trim() || todayIsoDate(),
    "report-date",
  );

  assertEnum(authority, allowedAuthority, "authority");
  assertEnum(sourceSystem, allowedSourceSystems, "source-system");
  assertEnum(sensitivity, allowedSensitivity, "sensitivity");

  const numericConfidence = Number(confidence);
  if (Number.isNaN(numericConfidence) || numericConfidence < 0 || numericConfidence > 1) {
    throw new Error("Confidence must be a number between 0 and 1.");
  }

  const sourceUrls = [
    ...getMany(flags, "source-url"),
    ...getMany(flags, "source-locator"),
  ];
  if (sourceUrls.length === 0) {
    throw new Error("Provide at least one --source-url or --source-locator.");
  }
  const pageKind = getFirst(flags, "page-kind").trim() || undefined;
  if (pageKind) {
    assertEnum(pageKind, allowedPageKinds, "page-kind");
  }
  const subjectKey = getFirst(flags, "subject-key").trim();
  const freshnessSlaDays = getFirst(flags, "freshness-sla-days").trim();
  const lastSignalAt = getFirst(flags, "last-signal-at").trim();
  if (lastSignalAt) {
    requireIsoDate(lastSignalAt, "last-signal-at");
  }
  const reviewStatus = getFirst(flags, "review-status").trim();
  if (reviewStatus) {
    assertEnum(reviewStatus, allowedReviewStatus, "review-status");
  }
  const entityTags = getMany(flags, "entity-tag");
  const canonicalRefs = parseCanonicalRefs(flags);

  const recommendedFollowUp = getMany(flags, "recommended-follow-up");
  const linkedPages = getMany(flags, "linked-page");
  for (const linkedPage of linkedPages) {
    const absoluteRelated = toAbsoluteFromRepoPath(linkedPage);
    if (!(await fileExists(absoluteRelated))) {
      throw new Error(`Linked page does not exist: ${linkedPage}`);
    }
  }

  const reportPath = path.join(knowledgeRoot, "reports", category, `${reportDate}-${slug}.md`);
  if (await fileExists(reportPath)) {
    throw new Error(`Report already exists: ${toRepoRelative(reportPath)}`);
  }

  const template = await readTemplate("report.template.md");
  const content = applyTemplate(template, {
    AUTHORITY: authority,
    SOURCE_SYSTEM: sourceSystem,
    SOURCE_URLS_YAML: buildSourceUrlsYaml(sourceUrls),
    LAST_VERIFIED_AT: lastVerifiedAt,
    OWNER: owner,
    SENSITIVITY: sensitivity,
    CONFIDENCE: numericConfidence.toString(),
    OPTIONAL_FRONTMATTER_BLOCK: buildOptionalFrontmatterBlock({
      pageKind,
      subjectKey: subjectKey || undefined,
      canonicalRefs,
      freshnessSlaDays: freshnessSlaDays || undefined,
      lastSignalAt: lastSignalAt || undefined,
      reviewStatus: reviewStatus || undefined,
      entityTags,
    }),
    TITLE: title,
    RECOMMENDED_FOLLOW_UP_BLOCK: renderBulletList(
      recommendedFollowUp,
      "Owner, next step, and why it matters",
    ),
    LINKED_KB_PAGES_BLOCK: buildLinkedKbPagesBlock(reportPath, linkedPages),
  });

  await ensureParentDir(reportPath, dryRun);
  if (!dryRun) {
    await fs.writeFile(reportPath, `${content.trimEnd()}\n`, "utf8");
  }

  return {
    created: [toRepoRelative(reportPath)],
    indexUpdates: [],
  };
}

function usage() {
  return `
Hermes KB ingest helper

Commands:
  raw-source
    --source-system <paperclip|notion|repo|web|drive>
    --title <title>
    [--slug <slug>]
    [--captured-at <YYYY-MM-DD>]
    [--sensitivity <public|internal|restricted>]
    --source-url <url-or-locator> (repeatable)
    [--capture-note <text>] (repeatable)
    [--extraction-issue <text>] (repeatable)
    [--next-kb-destination <path>] (repeatable)
    [--open-question <text>] (repeatable)

  compiled-page
    --category <compiled subfolder>
    --title <title>
    --owner <agent-or-team>
    --source-system <paperclip|notion|repo|web|drive>
    --source-url <url-or-locator> (repeatable)
    [--slug <slug>]
    [--authority <canonical|derived|draft>]
    [--sensitivity <public|internal|restricted>]
    [--confidence <0..1>]
    [--last-verified-at <YYYY-MM-DD>]
    [--open-question <text>] (repeatable)
    [--related-page <repo-relative-path>] (repeatable)
    [--contradiction <text>] (repeatable)
    [--stale-reason <text>]
    [--page-kind <buyer_dossier|market_entity|city_brief|proof_pattern|doctrine_claim|support_playbook>]
    [--subject-key <stable-key>]
    [--canonical-ref-system <system>] (repeatable, pair with --canonical-ref)
    [--canonical-ref <locator>] (repeatable, pair with --canonical-ref-system)
    [--freshness-sla-days <number>]
    [--last-signal-at <YYYY-MM-DD>]
    [--review-status <active|watch|stale|blocked>]
    [--entity-tag <tag>] (repeatable)

  report
    --category <reports subfolder>
    --title <title>
    --owner <agent-or-team>
    --source-system <paperclip|notion|repo|web|drive>
    --source-url <url-or-locator> (repeatable)
    [--slug <slug>]
    [--authority <canonical|derived|draft>]
    [--sensitivity <public|internal|restricted>]
    [--confidence <0..1>]
    [--last-verified-at <YYYY-MM-DD>]
    [--report-date <YYYY-MM-DD>]
    [--recommended-follow-up <text>] (repeatable)
    [--linked-page <repo-relative-path>] (repeatable)
    [--page-kind <buyer_dossier|market_entity|city_brief|proof_pattern|doctrine_claim|support_playbook>]
    [--subject-key <stable-key>]
    [--canonical-ref-system <system>] (repeatable, pair with --canonical-ref)
    [--canonical-ref <locator>] (repeatable, pair with --canonical-ref-system)
    [--freshness-sla-days <number>]
    [--last-signal-at <YYYY-MM-DD>]
    [--review-status <active|watch|stale|blocked>]
    [--entity-tag <tag>] (repeatable)

Global:
  --dry-run
  --help
`.trim();
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (hasFlag(parsed.flags, "help") || !parsed.command) {
    console.log(usage());
    return;
  }

  const dryRun = hasFlag(parsed.flags, "dry-run");

  const result =
    parsed.command === "raw-source"
      ? await scaffoldRawSource(parsed.flags, dryRun)
      : parsed.command === "compiled-page"
        ? await scaffoldCompiledPage(parsed.flags, dryRun)
        : await scaffoldReport(parsed.flags, dryRun);

  console.log(`${dryRun ? "Dry run complete" : "Scaffold complete"} for ${parsed.command}.`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
