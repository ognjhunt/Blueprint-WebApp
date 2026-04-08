import fs from "node:fs/promises";
import path from "node:path";

type AllowedSourceSystem = "paperclip" | "notion" | "repo" | "web" | "drive";
type AllowedAuthority = "canonical" | "derived" | "draft";
type AllowedSensitivity = "public" | "internal" | "restricted";

export type EnsureKbReportArtifactInput = {
  repoRoot: string;
  requestedPath?: string;
  defaultCategory: string;
  title: string;
  generatedAt: string;
  owner: string;
  summary: string;
  evidence: string[];
  recommendedFollowUp: string[];
  linkedKbPages?: string[];
  issueId?: string;
  sourceSystem?: AllowedSourceSystem;
  sourceUrls?: string[];
  authority?: AllowedAuthority;
  sensitivity?: AllowedSensitivity;
  confidence?: number;
  authorityBoundary?: string;
};

export type EnsureKbReportArtifactResult = {
  absolutePath: string;
  repoRelativePath: string;
  generated: boolean;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toRepoRelative(repoRoot: string, absolutePath: string) {
  return path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
}

function resolveInsideRepo(repoRoot: string, targetPath: string) {
  const normalized = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = path.resolve(repoRoot, normalized);
  if (!absolutePath.startsWith(repoRoot)) {
    throw new Error(`KB artifact path escapes repo root: ${targetPath}`);
  }
  return absolutePath;
}

function buildLocalDate(generatedAt: string) {
  const date = new Date(generatedAt);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function buildSourceUrls(input: EnsureKbReportArtifactInput) {
  if (input.sourceUrls && input.sourceUrls.length > 0) {
    return input.sourceUrls;
  }
  if (input.issueId) {
    return [`paperclip://issue/${input.issueId}`];
  }
  return ["repo:///ops/paperclip/plugins/blueprint-automation/src/worker.ts"];
}

function buildLinkedKbPagesSection(
  repoRoot: string,
  fromAbsolutePath: string,
  linkedKbPages: string[],
) {
  if (linkedKbPages.length === 0) {
    return "- Related KB pages";
  }

  return linkedKbPages.map((linkedPath) => {
    const absoluteLinkedPath = resolveInsideRepo(repoRoot, linkedPath);
    const href = path.relative(path.dirname(fromAbsolutePath), absoluteLinkedPath).replace(/\\/g, "/");
    const label = toRepoRelative(repoRoot, absoluteLinkedPath);
    return `- [${label}](${href})`;
  }).join("\n");
}

function buildMarkdown(
  input: EnsureKbReportArtifactInput,
  absolutePath: string,
) {
  const localDate = buildLocalDate(input.generatedAt);
  const sourceSystem = input.sourceSystem ?? (input.issueId ? "paperclip" : "repo");
  const sourceUrls = buildSourceUrls(input);
  const authority = input.authority ?? "draft";
  const sensitivity = input.sensitivity ?? "internal";
  const confidence = input.confidence ?? 0.7;
  const evidence = input.evidence.length > 0 ? input.evidence : ["Evidence pending"];
  const followUp =
    input.recommendedFollowUp.length > 0
      ? input.recommendedFollowUp
      : ["Review the mirrored artifact and decide whether follow-up work is needed."];
  const linkedKbPages = buildLinkedKbPagesSection(
    input.repoRoot,
    absolutePath,
    input.linkedKbPages ?? [],
  );
  const authorityBoundary =
    input.authorityBoundary ??
    "This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.";

  return [
    "---",
    `authority: ${authority}`,
    `source_system: ${sourceSystem}`,
    "source_urls:",
    ...sourceUrls.map((entry) => `  - ${JSON.stringify(entry)}`),
    `last_verified_at: ${localDate}`,
    `owner: ${input.owner}`,
    `sensitivity: ${sensitivity}`,
    `confidence: ${confidence}`,
    "---",
    "",
    `# ${input.title}`,
    "",
    "## Summary",
    "",
    input.summary,
    "",
    "## Evidence",
    "",
    ...evidence.map((entry) => `- ${entry}`),
    "",
    "## Recommended Follow-up",
    "",
    ...followUp.map((entry) => `- ${entry}`),
    "",
    "## Linked KB Pages",
    "",
    linkedKbPages,
    "",
    "## Authority Boundary",
    "",
    authorityBoundary,
    "",
  ].join("\n");
}

export async function ensureKbReportArtifact(
  input: EnsureKbReportArtifactInput,
): Promise<EnsureKbReportArtifactResult> {
  const requestedPath = input.requestedPath?.trim();
  const defaultPath = path.join(
    "knowledge",
    "reports",
    input.defaultCategory,
    `${buildLocalDate(input.generatedAt)}-${slugify(input.title)}.md`,
  );
  const absolutePath = resolveInsideRepo(input.repoRoot, requestedPath || defaultPath);
  const repoRelativePath = toRepoRelative(input.repoRoot, absolutePath);

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`KB artifact path is not a file: ${repoRelativePath}`);
    }
    return {
      absolutePath,
      repoRelativePath,
      generated: false,
    };
  } catch (error) {
    const isMissing = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!isMissing) {
      throw error;
    }
  }

  if (requestedPath && !repoRelativePath.startsWith("knowledge/reports/")) {
    throw new Error(
      `KB artifact is missing: ${repoRelativePath}. Auto-generation only supports knowledge/reports/.`,
    );
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buildMarkdown(input, absolutePath), "utf8");

  return {
    absolutePath,
    repoRelativePath,
    generated: true,
  };
}
