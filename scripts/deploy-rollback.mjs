import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node scripts/deploy-rollback.mjs --target <git-sha-or-tag> [--health-url <url>] [--verify-command <cmd>]

Creates non-destructive revert commits for every commit after --target, then runs
a local verification command and, when provided, a deployed health check URL.

Environment:
  ROLLBACK_TARGET        fallback for --target
  ROLLBACK_HEALTH_URL    fallback for --health-url
  ROLLBACK_VERIFY_CMD    fallback for --verify-command
`);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return String(process.argv[index + 1] || "").trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function read(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return String(result.stdout || "").trim();
}

async function healthCheck(url) {
  if (!url) return;
  const normalized = url.endsWith("/health/ready") ? url : `${url.replace(/\/+$/, "")}/health/ready`;
  const response = await fetch(normalized);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Rollback health check failed: ${response.status} ${normalized} ${text}`);
  }
  console.log(`Rollback health check passed: ${normalized}`);
}

const target = argValue("--target") || String(process.env.ROLLBACK_TARGET || "").trim();
const healthUrl = argValue("--health-url") || String(process.env.ROLLBACK_HEALTH_URL || "").trim();
const verifyCommand =
  argValue("--verify-command") ||
  String(process.env.ROLLBACK_VERIFY_CMD || "npm run check").trim();

if (!target) {
  usage();
  process.exit(2);
}

try {
  run("git", ["rev-parse", "--verify", `${target}^{commit}`], { stdio: "ignore" });
  const status = read("git", ["status", "--porcelain"]);
  if (status) {
    throw new Error("Refusing rollback on a dirty worktree. Commit, stash, or move local changes first.");
  }

  const commits = read("git", ["rev-list", "--reverse", `${target}..HEAD`])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (commits.length === 0) {
    console.log(`HEAD already matches rollback target range ${target}; no revert commits needed.`);
  } else {
    console.log(`Reverting ${commits.length} commit(s) after ${target}.`);
    run("git", ["revert", "--no-edit", ...commits]);
  }

  if (verifyCommand) {
    console.log(`Running rollback verification: ${verifyCommand}`);
    run("bash", ["-lc", verifyCommand]);
  }

  await healthCheck(healthUrl);
  console.log("Rollback preparation completed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
