import fs from "node:fs/promises";
import path from "node:path";

type ExportLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
type DatasetSplit = "dev" | "holdout" | "shadow";

type BuildCliOptions = {
  inputRoot: string;
  outputRoot: string;
  lanes: ExportLane[];
  overwrite: boolean;
};

const DEFAULT_INPUT_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/tasks",
);
const DEFAULT_OUTPUT_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/harbor",
);

type GeneratedTaskSummary = {
  lane: ExportLane;
  generated: number;
  skipped: number;
};

function parseArgs(argv: string[]): BuildCliOptions {
  const options: BuildCliOptions = {
    inputRoot: DEFAULT_INPUT_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
    overwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--input-root":
        if (!next) throw new Error("--input-root requires a path");
        options.inputRoot = path.resolve(next);
        index += 1;
        break;
      case "--output-root":
        if (!next) throw new Error("--output-root requires a path");
        options.outputRoot = path.resolve(next);
        index += 1;
        break;
      case "--lanes":
        if (!next) throw new Error("--lanes requires a comma-separated value");
        options.lanes = next
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            if (
              entry === "waitlist_triage"
              || entry === "support_triage"
              || entry === "preview_diagnosis"
            ) {
              return entry;
            }
            throw new Error(`Unsupported lane: ${entry}`);
          });
        index += 1;
        break;
      case "--overwrite":
        options.overwrite = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function laneToDir(lane: ExportLane) {
  switch (lane) {
    case "waitlist_triage":
      return "waitlist-triage";
    case "support_triage":
      return "support-triage";
    case "preview_diagnosis":
      return "preview-diagnosis";
  }
}

function buildTaskName(lane: ExportLane, split: DatasetSplit, caseId: string) {
  return `blueprint/${lane}/${split}/${caseId}`;
}

function buildInstruction(lane: ExportLane) {
  const laneSummary =
    lane === "waitlist_triage"
      ? "classify a capturer beta request"
      : lane === "support_triage"
        ? "triage a support/contact request"
        : "diagnose a failed preview/deployment-readiness case";

  return `You are evaluating a narrow Blueprint automation lane.

Your task is to ${laneSummary}.

Read the structured fixture files provided with this task:

- \`files/input.json\`
- \`files/expected.json\`
- \`files/labels.json\`

Produce a single JSON file named \`result.json\` in the working directory.

Rules:

- Do not write markdown.
- Do not explain the answer in prose.
- Only write the structured decision object that best matches the Blueprint task contract.
- Prefer safe conservative decisions over unsafe auto-clear decisions.

The verifier stub for this task checks only the lane's required core fields right now.`;
}

function buildTaskToml(lane: ExportLane, split: DatasetSplit, caseId: string) {
  return `schema_version = "1.1"

[task]
name = "${buildTaskName(lane, split, caseId)}"
description = "Blueprint ${lane} fixture task for ${caseId}"
keywords = ["blueprint", "agent", "${lane}", "${split}"]

[metadata]
lane = "${lane}"
split = "${split}"
case_id = "${caseId}"

[agent]
timeout_sec = 180.0

[verifier]
timeout_sec = 30.0

[environment]
build_timeout_sec = 300.0
allow_internet = false
cpus = 1
memory_mb = 2048
storage_mb = 2048
`;
}

function buildEnvironmentDockerfile() {
  return `FROM autoagent-base

WORKDIR /app
`;
}

function buildVerifierScript(lane: ExportLane) {
  const requiredFields =
    lane === "waitlist_triage"
      ? ["automation_status", "recommendation", "recommended_queue", "requires_human_review"]
      : lane === "support_triage"
        ? ["automation_status", "category", "queue", "priority", "requires_human_review"]
        : ["automation_status", "disposition", "retryable", "queue", "requires_human_review"];

  return `import json
from pathlib import Path

LANE = ${JSON.stringify(lane)}
REQUIRED_FIELDS = ${JSON.stringify(requiredFields)}

FIELD_WEIGHTS = {
    "waitlist_triage": {
        "automation_status": 1.0,
        "recommendation": 2.0,
        "recommended_queue": 2.0,
        "requires_human_review": 2.0,
        "market_fit_score": 0.25,
        "device_fit_score": 0.25,
        "invite_readiness_score": 0.5,
    },
    "support_triage": {
        "automation_status": 1.0,
        "category": 2.0,
        "queue": 2.0,
        "priority": 1.0,
        "requires_human_review": 2.0,
        "suggested_response": 0.5,
    },
    "preview_diagnosis": {
        "automation_status": 1.0,
        "disposition": 2.0,
        "retryable": 2.0,
        "queue": 1.5,
        "requires_human_review": 2.0,
        "retry_recommended": 0.5,
    },
}

DEFAULT_LABELS = {
    "unsafe_auto_clear_penalty": 5.0,
    "wrong_queue_penalty": 2.0,
    "wrong_retry_penalty": 4.0,
    "wrong_escalation_penalty": 4.0,
    "response_quality_weight": 0.5,
    "email_quality_weight": 0.25,
}

def first_existing(paths):
    for candidate in paths:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Could not find any expected file from: {paths}")

def load_json(path):
    return json.loads(path.read_text())

def as_bool(value):
    if isinstance(value, bool):
        return value
    return False

def as_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    return None

def shallow_equal(left, right):
    return left == right

def clamp(value, lower, upper):
    return max(lower, min(upper, value))

expected_path = first_existing([
    Path("/app/files/expected.json"),
    Path("files/expected.json"),
])
labels_path = first_existing([
    Path("/app/files/labels.json"),
    Path("files/labels.json"),
])
result_path = first_existing([
    Path("/app/result.json"),
    Path("result.json"),
    Path("/workspace/result.json"),
])

expected = load_json(expected_path)
labels = load_json(labels_path)
result = load_json(result_path)

failures = []
score = 0.0
weighted_checks = []
weights = FIELD_WEIGHTS[LANE]

def record_field(field, matched, expected_value, actual_value, weight):
    global score
    weighted_checks.append({
        "field": field,
        "matched": matched,
        "expected": expected_value,
        "actual": actual_value,
        "weight": weight,
    })
    if matched:
        score += weight
    else:
        failures.append({
            "field": field,
            "expected": expected_value,
            "actual": actual_value,
            "weight": weight,
        })

for field in REQUIRED_FIELDS:
    record_field(
        field,
        shallow_equal(result.get(field), expected.get(field)),
        expected.get(field),
        result.get(field),
        weights.get(field, 1.0),
    )

if LANE == "waitlist_triage":
    for score_field in ["market_fit_score", "device_fit_score", "invite_readiness_score"]:
        if expected.get(score_field) is None:
            continue
        expected_value = as_number(expected.get(score_field))
        actual_value = as_number(result.get(score_field))
        matched = (
            expected_value is not None
            and actual_value is not None
            and abs(expected_value - actual_value) <= 10.0
        )
        record_field(score_field, matched, expected_value, actual_value, weights.get(score_field, 0.25))

if LANE == "support_triage" and expected.get("suggested_response") is not None:
    expected_response = expected.get("suggested_response")
    actual_response = result.get("suggested_response")
    response_present = (
        isinstance(actual_response, dict)
        and isinstance(actual_response.get("subject"), str)
        and isinstance(actual_response.get("body"), str)
        and actual_response.get("subject", "").strip() != ""
        and actual_response.get("body", "").strip() != ""
    )
    response_weight = float(labels.get("response_quality_weight", DEFAULT_LABELS["response_quality_weight"]))
    record_field("suggested_response", response_present, expected_response, actual_response, response_weight)

if LANE == "preview_diagnosis" and expected.get("retry_recommended") is not None:
    record_field(
        "retry_recommended",
        shallow_equal(result.get("retry_recommended"), expected.get("retry_recommended")),
        expected.get("retry_recommended"),
        result.get("retry_recommended"),
        weights.get("retry_recommended", 0.5),
    )

penalties = []

def add_penalty(reason, amount):
    global score
    if amount <= 0:
        return
    penalties.append({"reason": reason, "amount": amount})
    score -= amount

unsafe_auto_clear_penalty = float(labels.get("unsafe_auto_clear_penalty", DEFAULT_LABELS["unsafe_auto_clear_penalty"]))
wrong_queue_penalty = float(labels.get("wrong_queue_penalty", DEFAULT_LABELS["wrong_queue_penalty"]))
wrong_retry_penalty = float(labels.get("wrong_retry_penalty", DEFAULT_LABELS["wrong_retry_penalty"]))
wrong_escalation_penalty = float(labels.get("wrong_escalation_penalty", DEFAULT_LABELS["wrong_escalation_penalty"]))

if as_bool(expected.get("requires_human_review")) and not as_bool(result.get("requires_human_review")):
    add_penalty("unsafe_auto_clear", unsafe_auto_clear_penalty)

expected_queue = expected.get("recommended_queue", expected.get("queue"))
actual_queue = result.get("recommended_queue", result.get("queue"))
if expected_queue is not None and actual_queue != expected_queue:
    add_penalty("wrong_queue", wrong_queue_penalty)

if LANE == "preview_diagnosis":
    if expected.get("retryable") != result.get("retryable"):
        add_penalty("wrong_retry", wrong_retry_penalty)
    if expected.get("disposition") != result.get("disposition"):
        add_penalty("wrong_escalation", wrong_escalation_penalty)

max_score = sum(check["weight"] for check in weighted_checks) or 1.0
reward = clamp(score / max_score, 0.0, 1.0)

Path("/logs/verifier").mkdir(parents=True, exist_ok=True)
Path("/logs/verifier/reward.txt").write_text(str(reward))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "lane": LANE,
    "reward": reward,
    "required_fields": REQUIRED_FIELDS,
    "risk_tier": labels.get("risk_tier"),
    "weighted_checks": weighted_checks,
    "penalties": penalties,
    "raw_score": score,
    "max_score": max_score,
    "failures": failures,
}, indent=2))
`;
}

function buildTestShell() {
  return `#!/bin/bash
set -euo pipefail

python3 /tests/test.py
`;
}

async function copyFixtureFile(sourcePath: string, targetPath: string) {
  const content = await fs.readFile(sourcePath, "utf8");
  await fs.writeFile(targetPath, content, "utf8");
}

async function ensureTaskDir(taskDir: string, overwrite: boolean) {
  if (overwrite) {
    await fs.rm(taskDir, { recursive: true, force: true });
  }
  await fs.mkdir(taskDir, { recursive: true });
  await fs.mkdir(path.join(taskDir, "files"), { recursive: true });
  await fs.mkdir(path.join(taskDir, "tests"), { recursive: true });
  await fs.mkdir(path.join(taskDir, "environment"), { recursive: true });
}

async function listCaseDirs(casesRoot: string) {
  try {
    const entries = await fs.readdir(casesRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

async function generateLaneTasks(
  options: BuildCliOptions,
  lane: ExportLane,
): Promise<GeneratedTaskSummary> {
  const laneDir = laneToDir(lane);
  const fixtureRoot = path.join(options.inputRoot, laneDir, "cases");
  const outputLaneRoot = path.join(options.outputRoot, laneDir);
  const summary: GeneratedTaskSummary = {
    lane,
    generated: 0,
    skipped: 0,
  };

  if (options.overwrite) {
    await fs.rm(outputLaneRoot, { recursive: true, force: true });
  }

  for (const split of ["dev", "holdout", "shadow"] as DatasetSplit[]) {
    const splitRoot = path.join(fixtureRoot, split);
    const caseDirs = await listCaseDirs(splitRoot);
    for (const caseId of caseDirs) {
      const sourceCaseDir = path.join(splitRoot, caseId);
      const inputPath = path.join(sourceCaseDir, "input.json");
      const expectedPath = path.join(sourceCaseDir, "expected.json");
      const labelsPath = path.join(sourceCaseDir, "labels.json");
      const sourcePath = path.join(sourceCaseDir, "source.json");

      try {
        await fs.access(inputPath);
        await fs.access(expectedPath);
        await fs.access(labelsPath);
      } catch {
        summary.skipped += 1;
        continue;
      }

      const taskDir = path.join(outputLaneRoot, split, caseId);
      await ensureTaskDir(taskDir, options.overwrite);

      await fs.writeFile(
        path.join(taskDir, "instruction.md"),
        `${buildInstruction(lane)}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(taskDir, "task.toml"),
        `${buildTaskToml(lane, split, caseId)}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(taskDir, "environment", "Dockerfile"),
        `${buildEnvironmentDockerfile()}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(taskDir, "tests", "test.py"),
        `${buildVerifierScript(lane)}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(taskDir, "tests", "test.sh"),
        `${buildTestShell()}\n`,
        { encoding: "utf8", mode: 0o755 },
      );

      await copyFixtureFile(inputPath, path.join(taskDir, "files", "input.json"));
      await copyFixtureFile(expectedPath, path.join(taskDir, "files", "expected.json"));
      await copyFixtureFile(labelsPath, path.join(taskDir, "files", "labels.json"));
      try {
        await copyFixtureFile(sourcePath, path.join(taskDir, "files", "source.json"));
      } catch {
        // source.json is optional at generation time
      }

      summary.generated += 1;
    }
  }

  return summary;
}

async function writeSummary(outputRoot: string, summaries: GeneratedTaskSummary[]) {
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(
    path.join(outputRoot, "build-summary.json"),
    `${JSON.stringify({
      built_at: new Date().toISOString(),
      summaries,
    }, null, 2)}\n`,
    "utf8",
  );
}

export async function runBuild(options: BuildCliOptions) {
  const summaries: GeneratedTaskSummary[] = [];
  for (const lane of options.lanes) {
    summaries.push(await generateLaneTasks(options, lane));
  }
  await writeSummary(options.outputRoot, summaries);
  return summaries;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const summaries = await runBuild(options);
  for (const summary of summaries) {
    console.log(
      `[autoagent-build] ${summary.lane}: generated=${summary.generated} skipped=${summary.skipped}`,
    );
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-build] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
