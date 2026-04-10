import { readFileSync } from "node:fs";
import path from "node:path";

export type PlatformDoctrineDoc = {
  title: string;
  naturalKey: string;
  type: string;
  fileContent: string;
};

const PLATFORM_DOCTRINE_FILES = [
  {
    title: "Platform Context — System Framing & Product Doctrine",
    naturalKey: "platform-context-doctrine",
    fileName: "PLATFORM_CONTEXT.md",
  },
  {
    title: "World Model Strategy — Core Strategy Document",
    naturalKey: "world-model-strategy-doctrine",
    fileName: "WORLD_MODEL_STRATEGY_CONTEXT.md",
  },
] as const;

export function resolveConfiguredRepoRoot(
  explicitRepoRoot?: string | null,
  fallbackRepoRoot?: string | null,
): string {
  const configuredRepoRoot =
    (typeof explicitRepoRoot === "string" && explicitRepoRoot.trim().length > 0
      ? explicitRepoRoot.trim()
      : null) ??
    process.env.REPO_ROOT ??
    process.env.PAPERCLIP_REPO_ROOT ??
    (typeof fallbackRepoRoot === "string" && fallbackRepoRoot.trim().length > 0
      ? fallbackRepoRoot.trim()
      : null) ??
    process.cwd();

  return path.resolve(configuredRepoRoot);
}

export function loadPlatformDoctrineDocs(repoRoot: string): PlatformDoctrineDoc[] {
  const resolvedRepoRoot = path.resolve(repoRoot);

  return PLATFORM_DOCTRINE_FILES.map((doc) => {
    const filePath = path.join(resolvedRepoRoot, doc.fileName);
    try {
      return {
        title: doc.title,
        naturalKey: doc.naturalKey,
        type: "Platform Doctrine",
        fileContent: readFileSync(filePath, "utf-8"),
      };
    } catch (error) {
      return {
        title: doc.title,
        naturalKey: doc.naturalKey,
        type: "Platform Doctrine",
        fileContent: `[File not found: ${filePath}]\n${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
}
