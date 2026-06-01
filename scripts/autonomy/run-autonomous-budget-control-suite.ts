#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUT_DIR = "output/autonomous-org/budget/control-suite/latest";

type SuiteCommand = {
  id: string;
  command: string;
  args: string[];
  required: boolean;
  side_effect_boundary: string;
};

type SuiteCommandResult = SuiteCommand & {
  status: "passed" | "failed";
  exit_code: number | null;
  duration_ms: number;
  stdout_tail: string;
  stderr_tail: string;
};

type SuiteReport = {
  schema: "blueprint/autonomous-budget-control-suite/v1";
  generated_at: string;
  pass: boolean;
  mode: {
    no_live_provider_calls_requested: boolean;
    no_live_mutation_attempted: boolean;
    secrets_persisted: boolean;
    include_typecheck: boolean;
    include_graphify: boolean;
  };
  command_count: number;
  passed_count: number;
  failed_count: number;
  commands: SuiteCommandResult[];
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function trimTail(value: string, maxLength = 5000) {
  const sanitized = value
    .replace(/SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted:sendgrid]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted:github_pat]")
    .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted:github_pat]")
    .replace(/dop_v1_[A-Za-z0-9]+/g, "[redacted:digitalocean]")
    .replace(/rnd_[A-Za-z0-9]+/g, "[redacted:render]")
    .replace(/sk-admin-[A-Za-z0-9_-]+/g, "[redacted:openai_admin_key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted:openai_project_key]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted:openrouter_key]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted:api_key]")
    .replace(/key_[A-Za-z0-9]+/g, "[redacted:runway]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted:firebase_web_key]");
  return sanitized.length <= maxLength ? sanitized : sanitized.slice(-maxLength);
}

function buildCommands(includeTypecheck: boolean, includeGraphify: boolean): SuiteCommand[] {
  const commands: SuiteCommand[] = [
    {
      id: "live_proof_reconcile",
      command: "npm",
      args: ["run", "autonomy:budget:live-proof:reconcile"],
      required: true,
      side_effect_boundary: "local artifact regeneration only; no provider calls",
    },
    {
      id: "live_proof_template",
      command: "npm",
      args: ["run", "autonomy:budget:live-proof:template"],
      required: true,
      side_effect_boundary: "local template artifact only; no provider calls",
    },
    {
      id: "live_proof_validate",
      command: "npm",
      args: ["run", "autonomy:budget:live-proof:validate"],
      required: true,
      side_effect_boundary: "local validation artifact only; does not count live billing proof",
    },
    {
      id: "next_goal_queue",
      command: "npm",
      args: ["run", "autonomy:budget:next-goals"],
      required: true,
      side_effect_boundary: "local next-goal queue artifact only; no provider calls or live mutation",
    },
    {
      id: "budget_delegation_packet",
      command: "npm",
      args: ["run", "autonomy:budget:delegate"],
      required: true,
      side_effect_boundary: "local owner delegation packet only; no provider calls, spend, or live mutation",
    },
    {
      id: "live_action_gate",
      command: "npm",
      args: ["run", "autonomy:budget:live-action-gate"],
      required: true,
      side_effect_boundary: "local live-action gate artifact only; no provider calls, spend, or live mutation",
    },
    {
      id: "budget_control_status",
      command: "npm",
      args: ["run", "autonomy:budget:status"],
      required: true,
      side_effect_boundary: "local status artifact only; no provider calls, spend, or live mutation",
    },
    {
      id: "launch_now_approval_packet",
      command: "npm",
      args: ["run", "autonomy:budget:launch-approval"],
      required: true,
      side_effect_boundary: "local pending approval artifact only; no provider calls, spend, or live mutation",
    },
    {
      id: "dynamic_budget_verify",
      command: "npm",
      args: ["run", "autonomy:budget:dynamic:verify"],
      required: true,
      side_effect_boundary: "local verifier artifact only; no live spend movement",
    },
    {
      id: "proof_intake_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/validate-live-proof-intake.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "dynamic_allocator_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/dynamic-budget-allocator-core.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "next_goal_queue_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/generate-budget-next-goal-queue.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "budget_delegation_packet_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/generate-budget-delegation-packet.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "live_action_gate_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/verify-budget-live-action-gate.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "budget_control_status_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/summarize-budget-control-status.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "launch_now_approval_tests",
      command: "npx",
      args: ["vitest", "run", "scripts/autonomy/generate-launch-now-approval-packet.test.ts"],
      required: true,
      side_effect_boundary: "local test process only",
    },
    {
      id: "budget_packet_verify",
      command: "npm",
      args: ["run", "autonomy:budget:verify"],
      required: true,
      side_effect_boundary: "local verifier artifact only; no provider calls",
    },
  ];

  if (includeTypecheck) {
    commands.push({
      id: "typecheck",
      command: "npm",
      args: ["run", "check"],
      required: true,
      side_effect_boundary: "local TypeScript no-emit check",
    });
  }

  if (includeGraphify) {
    commands.push({
      id: "graphify_refresh",
      command: "bash",
      args: ["scripts/graphify/run-webapp-architecture-pilot.sh", "--no-viz"],
      required: true,
      side_effect_boundary: "local architecture graph artifact refresh",
    });
  }

  return commands;
}

function runCommand(command: SuiteCommand): SuiteCommandResult {
  const started = Date.now();
  const result = spawnSync(command.command, command.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exitCode = typeof result.status === "number" ? result.status : null;
  return {
    ...command,
    status: exitCode === 0 ? "passed" : "failed",
    exit_code: exitCode,
    duration_ms: Date.now() - started,
    stdout_tail: trimTail(result.stdout ?? ""),
    stderr_tail: trimTail(result.stderr ?? ""),
  };
}

function renderMarkdown(report: SuiteReport) {
  const lines = [
    "# Autonomous Budget Control Suite",
    "",
    `Generated: ${report.generated_at}`,
    `Status: ${report.pass ? "pass" : "fail"}`,
    `Commands: ${report.passed_count}/${report.command_count} passed`,
    "",
    "No live provider calls were requested by this suite. It runs local artifact generators, verifiers, and tests only.",
    "",
    "## Commands",
    "",
    "| Command | Status | Duration | Boundary |",
    "|---|---:|---:|---|",
  ];

  for (const command of report.commands) {
    lines.push(
      `| \`${command.id}\` | \`${command.status}\` | ${command.duration_ms}ms | ${command.side_effect_boundary} |`,
    );
  }

  return lines.join("\n");
}

function main() {
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const includeTypecheck = hasFlag("--include-check");
  const includeGraphify = hasFlag("--include-graphify");
  const commands = buildCommands(includeTypecheck, includeGraphify);
  const results: SuiteCommandResult[] = [];

  for (const command of commands) {
    const result = runCommand(command);
    results.push(result);
    if (result.status === "failed" && result.required) {
      break;
    }
  }

  const failedCount = results.filter((result) => result.status === "failed").length;
  const report: SuiteReport = {
    schema: "blueprint/autonomous-budget-control-suite/v1",
    generated_at: new Date().toISOString(),
    pass: failedCount === 0 && results.length === commands.length,
    mode: {
      no_live_provider_calls_requested: true,
      no_live_mutation_attempted: true,
      secrets_persisted: false,
      include_typecheck: includeTypecheck,
      include_graphify: includeGraphify,
    },
    command_count: commands.length,
    passed_count: results.filter((result) => result.status === "passed").length,
    failed_count: failedCount,
    commands: results,
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "summary.md"), `${renderMarkdown(report)}\n`);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }

  if (!report.pass) {
    process.exit(1);
  }
}

main();
