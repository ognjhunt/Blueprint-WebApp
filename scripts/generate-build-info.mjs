import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Writes dist/public/version.json so every deploy exposes exactly which commit
 * is serving traffic (GET /version.json). Runs at the end of `npm run build`.
 *
 * Must never fail the build: missing git metadata degrades to "unknown".
 */
function gitSha() {
  const fromEnv =
    process.env.RENDER_GIT_COMMIT?.trim() || process.env.GITHUB_SHA?.trim();
  if (fromEnv) return fromEnv;
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) {
    return String(result.stdout || "").trim() || "unknown";
  }
  return "unknown";
}

try {
  const outDir = path.join(process.cwd(), "dist", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const sha = gitSha();
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  );
  const payload = {
    service: "blueprint-webapp",
    version: packageJson.version || "0.0.0",
    git_sha: sha,
    built_at_iso: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, "version.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  console.log(`Build info written: git_sha=${sha}`);
} catch (error) {
  console.warn(
    `generate-build-info: skipped (${error instanceof Error ? error.message : String(error)})`,
  );
}
