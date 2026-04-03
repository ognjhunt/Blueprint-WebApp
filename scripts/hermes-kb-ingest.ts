import fs from "node:fs/promises";
import path from "node:path";

type Command = "raw-source" | "compiled-page";

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

function parseArgs(argv: string[]): ParsedArgs {
  let command: Command | null = null;
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!command && (token === "raw-source" || token === "compiled-page")) {
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
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
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

  const folder = path.join(knowledgeRoot, "raw", sourceSystem, slug);
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

  const pagePath = path.join(knowledgeRoot, "compiled", category, `${slug}.md`);
  if (await fileExists(pagePath)) {
    throw new Error(`Compiled page already exists: ${toRepoRelative(pagePath)}`);
  }

  const template = await readTemplate("compiled-page.template.md");
  const content = applyTemplate(template, {
    AUTHORITY: authority,
    SOURCE_SYSTEM: sourceSystem,
    SOURCE_URLS_YAML: buildSourceUrlsYaml(sourceUrls),
    LAST_VERIFIED_AT: lastVerifiedAt,
    OWNER: owner,
    SENSITIVITY: sensitivity,
    CONFIDENCE: numericConfidence.toString(),
    TITLE: title,
    OPEN_QUESTIONS_BLOCK: renderBulletList(
      openQuestions,
      "What remains unresolved and what evidence would change confidence",
    ),
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

function usage() {
  return `
Hermes KB ingest helper

Commands:
  raw-source
    --source-system <paperclip|notion|repo|web|drive>
    --title <title>
    [--slug <slug>]
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
      : await scaffoldCompiledPage(parsed.flags, dryRun);

  console.log(`${dryRun ? "Dry run complete" : "Scaffold complete"} for ${parsed.command}.`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
