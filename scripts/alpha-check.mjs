import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const reportDir = path.join(repoRoot, ".tmp");
const reportPath = path.join(reportDir, "vitest-alpha-report.json");

fs.mkdirSync(reportDir, { recursive: true });

function run(command, args, envOverrides = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectAssertionCounts(node) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  if (!node || typeof node !== "object") {
    return { passed, failed, skipped };
  }

  const status = typeof node.status === "string" ? node.status : null;
  if (status === "passed") passed += 1;
  if (status === "failed") failed += 1;
  if (status === "skipped" || status === "pending" || status === "todo") skipped += 1;

  const children = [
    ...(Array.isArray(node.testResults) ? node.testResults : []),
    ...(Array.isArray(node.assertionResults) ? node.assertionResults : []),
  ];

  for (const child of children) {
    const counts = collectAssertionCounts(child);
    passed += counts.passed;
    failed += counts.failed;
    skipped += counts.skipped;
  }

  return { passed, failed, skipped };
}

run("npm", ["run", "check"]);
run("npm", ["run", "build"]);
run("npx", [
  "vitest",
  "run",
  "--coverage",
  "--reporter=json",
  `--outputFile=${reportPath}`,
], { RUN_BUILD_OUTPUT_TESTS: "1" });

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const counts = collectAssertionCounts(report);

if (counts.failed > 0) {
  console.error(`Alpha check failed: ${counts.failed} test assertions failed.`);
  process.exit(1);
}

if (counts.skipped > 0) {
  console.error(`Alpha check failed: ${counts.skipped} test assertions were skipped.`);
  process.exit(1);
}

console.log(`Alpha check passed: ${counts.passed} assertions passed with 0 skipped.`);
