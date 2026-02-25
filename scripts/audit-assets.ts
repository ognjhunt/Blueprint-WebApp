import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const maxFileSizeBytes = Number(process.env.ASSET_MAX_SIZE_MB ?? 8) * 1024 * 1024;
const publicRoot = path.join(repoRoot, "client", "public");

const sourceFileExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
]);

const excludedDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "attached_assets",
]);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function walkFiles(dirPath: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = toPosixPath(path.relative(repoRoot, fullPath));
    const topLevelDir = relPath.split("/")[0];

    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name) || excludedDirs.has(topLevelDir)) {
        continue;
      }
      walkFiles(fullPath, files);
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function readSourceCorpus(): string {
  const files = walkFiles(repoRoot);
  const sourceFiles = files.filter((filePath) => {
    const relPath = toPosixPath(path.relative(repoRoot, filePath));
    if (relPath.startsWith("client/public/")) {
      return false;
    }
    return sourceFileExtensions.has(path.extname(filePath).toLowerCase());
  });

  return sourceFiles
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
}

function collectPublicAssets(): string[] {
  if (!fs.existsSync(publicRoot)) {
    return [];
  }

  const files = walkFiles(publicRoot);
  return files.filter((filePath) => fs.statSync(filePath).isFile());
}

function collectOversizedFiles(): Array<{ path: string; size: number }> {
  const files = walkFiles(repoRoot);
  const oversized: Array<{ path: string; size: number }> = [];

  for (const filePath of files) {
    const relPath = toPosixPath(path.relative(repoRoot, filePath));
    if (relPath.startsWith("client/public/")) {
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.size > maxFileSizeBytes) {
      oversized.push({ path: relPath, size: stat.size });
    }
  }

  return oversized;
}

function isPublicAssetReferenced(assetPath: string, corpus: string): boolean {
  const relFromPublic = toPosixPath(path.relative(publicRoot, assetPath));
  const publicUrl = `/${relFromPublic}`;
  return corpus.includes(publicUrl);
}

function collectRootScreenshotDumps(): string[] {
  const rootEntries = fs.readdirSync(repoRoot);
  return rootEntries
    .filter((name) => /^Screenshot .*\.png$/i.test(name))
    .map((name) => toPosixPath(path.join(repoRoot, name)));
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function main() {
  const issues: string[] = [];

  const rootScreenshotDumps = collectRootScreenshotDumps();
  if (rootScreenshotDumps.length > 0) {
    issues.push(
      `Root screenshot dump files found:\n${rootScreenshotDumps
        .map((entry) => `  - ${toPosixPath(path.relative(repoRoot, entry))}`)
        .join("\n")}`,
    );
  }

  const oversizedFiles = collectOversizedFiles();
  if (oversizedFiles.length > 0) {
    issues.push(
      `Oversized files (>${formatBytes(maxFileSizeBytes)}):\n${oversizedFiles
        .map((file) => `  - ${file.path} (${formatBytes(file.size)})`)
        .join("\n")}`,
    );
  }

  const sourceCorpus = readSourceCorpus();
  const publicAssets = collectPublicAssets();
  const unreferencedPublicAssets = publicAssets
    .filter((assetPath) => {
      const relFromPublic = toPosixPath(path.relative(publicRoot, assetPath));
      return (
        relFromPublic.startsWith("images/") ||
        relFromPublic.startsWith("thumbnails/")
      );
    })
    .filter((assetPath) => !isPublicAssetReferenced(assetPath, sourceCorpus))
    .map((assetPath) => toPosixPath(path.relative(repoRoot, assetPath)));

  if (unreferencedPublicAssets.length > 0) {
    issues.push(
      `Unreferenced public assets detected:\n${unreferencedPublicAssets
        .map((entry) => `  - ${entry}`)
        .join("\n")}`,
    );
  }

  if (issues.length > 0) {
    console.error("Asset audit failed.\n");
    for (const issue of issues) {
      console.error(issue);
      console.error("");
    }
    process.exit(1);
  }

  console.log("Asset audit passed.");
}

main();
