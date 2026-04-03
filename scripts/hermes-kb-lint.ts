import fs from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

const workspaceRoot = process.cwd();
const knowledgeRoot = path.join(workspaceRoot, "knowledge");

const requiredDirectories = [
  "knowledge",
  "knowledge/raw",
  "knowledge/compiled",
  "knowledge/reports",
  "knowledge/indexes",
  "knowledge/templates",
];

const requiredIndexFiles = [
  "knowledge/indexes/backlinks.md",
  "knowledge/indexes/open-questions.md",
  "knowledge/indexes/stale-pages.md",
  "knowledge/indexes/contradictions.md",
];

const allowedAuthority = new Set(["canonical", "derived", "draft"]);
const allowedSourceSystems = new Set(["paperclip", "notion", "repo", "web", "drive"]);
const allowedSensitivity = new Set(["public", "internal", "restricted"]);

type LintError = {
  file: string;
  message: string;
};

type FrontmatterShape = {
  authority?: unknown;
  source_system?: unknown;
  source_urls?: unknown;
  last_verified_at?: unknown;
  owner?: unknown;
  sensitivity?: unknown;
  confidence?: unknown;
};

async function exists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdownFiles(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function relativePath(absolutePath: string) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function parseFrontmatter(content: string): { data: FrontmatterShape; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const [, frontmatterRaw, body] = match;
  const data = yaml.load(frontmatterRaw);
  if (!data || typeof data !== "object") {
    return { data: {}, body };
  }

  return { data: data as FrontmatterShape, body };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateRequiredSections(
  file: string,
  body: string,
  requiredSections: string[],
  errors: LintError[],
) {
  for (const heading of requiredSections) {
    if (!body.includes(heading)) {
      errors.push({
        file,
        message: `Missing required section heading: ${heading}`,
      });
    }
  }
}

function validateFrontmatter(file: string, frontmatter: FrontmatterShape, errors: LintError[]) {
  if (!isNonEmptyString(frontmatter.authority) || !allowedAuthority.has(frontmatter.authority)) {
    errors.push({
      file,
      message: "Frontmatter `authority` must be one of canonical, derived, or draft.",
    });
  }

  if (
    !isNonEmptyString(frontmatter.source_system)
    || !allowedSourceSystems.has(frontmatter.source_system)
  ) {
    errors.push({
      file,
      message: "Frontmatter `source_system` must be one of paperclip, notion, repo, web, or drive.",
    });
  }

  if (
    !Array.isArray(frontmatter.source_urls)
    || frontmatter.source_urls.length === 0
    || frontmatter.source_urls.some((entry) => !isNonEmptyString(entry))
  ) {
    errors.push({
      file,
      message: "Frontmatter `source_urls` must be a non-empty array of strings.",
    });
  }

  if (!isIsoDate(frontmatter.last_verified_at)) {
    errors.push({
      file,
      message: "Frontmatter `last_verified_at` must be an ISO date in YYYY-MM-DD format.",
    });
  }

  if (!isNonEmptyString(frontmatter.owner)) {
    errors.push({
      file,
      message: "Frontmatter `owner` must be a non-empty string.",
    });
  }

  if (
    !isNonEmptyString(frontmatter.sensitivity)
    || !allowedSensitivity.has(frontmatter.sensitivity)
  ) {
    errors.push({
      file,
      message: "Frontmatter `sensitivity` must be one of public, internal, or restricted.",
    });
  }

  if (
    typeof frontmatter.confidence !== "number"
    || Number.isNaN(frontmatter.confidence)
    || frontmatter.confidence < 0
    || frontmatter.confidence > 1
  ) {
    errors.push({
      file,
      message: "Frontmatter `confidence` must be a number between 0 and 1.",
    });
  }
}

function shouldSkipPage(file: string) {
  const rel = relativePath(file);
  return (
    rel.endsWith("/README.md")
    || rel.includes("/templates/")
    || rel.endsWith("/AGENTS.md")
  );
}

async function main() {
  const errors: LintError[] = [];

  for (const relativeDir of requiredDirectories) {
    const absoluteDir = path.join(workspaceRoot, relativeDir);
    if (!(await exists(absoluteDir))) {
      errors.push({
        file: relativeDir,
        message: "Required KB directory is missing.",
      });
    }
  }

  for (const relativeFile of requiredIndexFiles) {
    const absoluteFile = path.join(workspaceRoot, relativeFile);
    if (!(await exists(absoluteFile))) {
      errors.push({
        file: relativeFile,
        message: "Required KB index file is missing.",
      });
    }
  }

  if (errors.length > 0 || !(await exists(knowledgeRoot))) {
    report(errors);
    return;
  }

  const compiledRoot = path.join(knowledgeRoot, "compiled");
  const reportsRoot = path.join(knowledgeRoot, "reports");

  const compiledFiles = (await walkMarkdownFiles(compiledRoot)).filter((file) => !shouldSkipPage(file));
  const reportFiles = (await walkMarkdownFiles(reportsRoot)).filter((file) => !shouldSkipPage(file));

  for (const file of compiledFiles) {
    const rel = relativePath(file);
    const content = await fs.readFile(file, "utf8");
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      errors.push({
        file: rel,
        message: "Missing YAML frontmatter block.",
      });
      continue;
    }

    validateFrontmatter(rel, parsed.data, errors);
    validateRequiredSections(
      rel,
      parsed.body,
      [
        "## Summary",
        "## Evidence",
        "## Implications For Blueprint",
        "## Open Questions",
        "## Authority Boundary",
      ],
      errors,
    );
  }

  for (const file of reportFiles) {
    const rel = relativePath(file);
    const content = await fs.readFile(file, "utf8");
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      errors.push({
        file: rel,
        message: "Missing YAML frontmatter block.",
      });
      continue;
    }

    validateFrontmatter(rel, parsed.data, errors);
    validateRequiredSections(
      rel,
      parsed.body,
      [
        "## Summary",
        "## Evidence",
        "## Recommended Follow-up",
        "## Linked KB Pages",
        "## Authority Boundary",
      ],
      errors,
    );
  }

  report(errors);
}

function report(errors: LintError[]) {
  if (errors.length === 0) {
    console.log("Hermes KB lint passed.");
    process.exit(0);
  }

  for (const error of errors) {
    console.error(`${error.file}: ${error.message}`);
  }

  console.error(`Hermes KB lint failed with ${errors.length} issue(s).`);
  process.exit(1);
}

void main();
