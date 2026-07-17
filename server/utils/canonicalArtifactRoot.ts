import fsSync from "node:fs";
import path from "node:path";

/**
 * The city-launch planning/execution harnesses publish "canonical" playbooks,
 * ledgers, and system docs into the tracked repo worktree
 * (ops/paperclip/playbooks/**, docs/city-launch-system-*.md). That is correct
 * for real operational runs, but a test or sandboxed lane must never rewrite
 * tracked operational evidence as a side effect of exercising these flows.
 *
 * Setting BLUEPRINT_CANONICAL_ARTIFACT_ROOT redirects every canonical WRITE
 * into that directory instead of the repo worktree. Reads resolve through the
 * override first and fall back to the pristine repo copy, so flows that
 * read-modify-write canonical artifacts keep working against real fixture
 * content while their output lands outside the tracked tree.
 */
export function resolveCanonicalArtifactWriteRoot(repoRoot: string): string {
  const override = process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT?.trim();
  return override || repoRoot;
}

export function resolveCanonicalArtifactReadPath(
  repoRoot: string,
  relativePath: string,
): string {
  const writeRoot = resolveCanonicalArtifactWriteRoot(repoRoot);
  if (writeRoot !== repoRoot) {
    const overridePath = path.join(writeRoot, relativePath);
    if (fsSync.existsSync(overridePath)) {
      return overridePath;
    }
    return path.join(repoRoot, relativePath);
  }
  return path.join(repoRoot, relativePath);
}

export function canonicalArtifactWriteRedirectActive(): boolean {
  return Boolean(process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT?.trim());
}
