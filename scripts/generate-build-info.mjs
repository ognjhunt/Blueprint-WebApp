#!/usr/bin/env node
//
// generate-build-info.mjs — R046 versioned release artifact stamp.
//
// Writes a build-info / version manifest into the build output so every deployed
// artifact is traceable back to an exact git SHA + package version. Wired into
// `npm run build` (package.json), so `dist/public/version.json` is produced on
// every build (local, CI, and Render). It is served statically from dist/public,
// so the live deployed SHA is readable at GET /version.json — that is how you
// identify the "last-good" SHA for a rollback (see
// docs/runbooks/CI_GATED_DEPLOY_AND_RELEASE.md).
//
// SHA resolution order (first non-empty wins):
//   RENDER_GIT_COMMIT  (Render build env)
//   GITHUB_SHA         (GitHub Actions)
//   SOURCE_COMMIT / GIT_COMMIT / VERCEL_GIT_COMMIT_SHA (other CI fallbacks)
//   `git rev-parse HEAD` (local checkout)
//   "unknown"          (never throws — build must not break on a missing SHA)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readPackageVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" && pkg.version ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function gitSha() {
  const fromEnv = firstEnv(
    "RENDER_GIT_COMMIT",
    "GITHUB_SHA",
    "SOURCE_COMMIT",
    "GIT_COMMIT",
    "VERCEL_GIT_COMMIT_SHA",
  );
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function gitBranch() {
  const fromEnv = firstEnv(
    "RENDER_GIT_BRANCH",
    "GITHUB_REF_NAME",
    "GIT_BRANCH",
    "VERCEL_GIT_COMMIT_REF",
  );
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function main() {
  const sha = gitSha();
  const version = readPackageVersion();
  const buildInfo = {
    name: "blueprint-webapp",
    version,
    gitSha: sha,
    gitShaShort: sha === "unknown" ? "unknown" : sha.slice(0, 12),
    gitBranch: gitBranch(),
    // Human-facing release tag, e.g. v1.0.0+ab12cd34ef56.
    release:
      sha === "unknown"
        ? `v${version}`
        : `v${version}+${sha.slice(0, 12)}`,
    buildTime: new Date().toISOString(),
    ciRunId: firstEnv("GITHUB_RUN_ID") || null,
    ciRunNumber: firstEnv("GITHUB_RUN_NUMBER") || null,
    nodeEnv: process.env.NODE_ENV || null,
  };

  // dist/public is the static web root (server/vite.ts serveStatic); exposing
  // version.json there makes the deployed SHA readable at /version.json.
  const outDir = path.join(repoRoot, "dist", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "version.json");
  fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2) + "\n", "utf8");

  process.stdout.write(
    `build-info: ${buildInfo.release} (${buildInfo.gitSha}) -> ${path.relative(repoRoot, outPath)}\n`,
  );
}

main();
