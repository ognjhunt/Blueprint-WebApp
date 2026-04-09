import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";

const execFileAsync = promisify(execFile);

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Codex returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Codex returned non-JSON output");
  }
}

function inferRequiresHumanReview<TOutput>(output: TOutput) {
  return Boolean(
    output
    && typeof output === "object"
    && "requires_human_review" in (output as Record<string, unknown>)
    && (output as Record<string, unknown>).requires_human_review === true,
  );
}

function trimOutput(value: string | undefined | null, maxLength = 4000) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? normalized.slice(-maxLength) : normalized;
}

export async function runCodexLocalTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  const codexCommand = process.env.CODEX_LOCAL_COMMAND?.trim() || "codex";
  const codexTimeoutMs = Number(process.env.CODEX_TIMEOUT_MS ?? 120_000);
  const codexWorkdir = process.env.CODEX_LOCAL_WORKDIR?.trim() || process.cwd();
  const outputFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-codex-local-")),
    "last-message.txt",
  );
  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared Codex local invocation",
      command: codexCommand,
      workdir: codexWorkdir,
      model: task.model,
    },
  ];

  try {
    traceLogs.push({
      event_type: "provider.process.started",
      status: "info",
      summary: "Started Codex local process",
      command: codexCommand,
      output_file: outputFile,
    });
    await execFileAsync(
      codexCommand,
      [
        "exec",
        "--skip-git-repo-check",
        "-C",
        codexWorkdir,
        "--sandbox",
        "read-only",
        "--output-last-message",
        outputFile,
        "--model",
        task.model,
        task.definition.build_prompt(task.input),
      ],
      {
        cwd: codexWorkdir,
        env: process.env,
        timeout: codexTimeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    const rawText = await fs.readFile(outputFile, "utf8");
    traceLogs.push({
      event_type: "provider.response.received",
      status: "info",
      summary: "Read Codex local output",
      bytes: rawText.length,
    });
    const payload = extractJsonPayload(rawText);
    traceLogs.push({
      event_type: "provider.response.parsed",
      status: "success",
      summary: "Parsed Codex local JSON payload",
    });
    const parsed = (task.definition.output_schema as ZodType<TOutput>).parse(
      payload,
    );
    traceLogs.push({
      event_type: "provider.schema.validated",
      status: "success",
      summary: "Validated Codex output against schema",
    });

    return {
      status: "completed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      output: parsed,
      raw_output_text: rawText,
      artifacts: {
        codex_command: codexCommand,
        codex_workdir: codexWorkdir,
      },
      logs: traceLogs,
      requires_human_review: inferRequiresHumanReview(parsed),
      requires_approval: false,
    };
  } catch (error) {
    const details =
      error && typeof error === "object"
        ? {
            message: "message" in error ? trimOutput(String((error as { message?: unknown }).message)) : "",
            stdout: "stdout" in error ? trimOutput(String((error as { stdout?: unknown }).stdout)) : "",
            stderr: "stderr" in error ? trimOutput(String((error as { stderr?: unknown }).stderr)) : "",
          }
        : { message: String(error), stdout: "", stderr: "" };

    const errorLines = [
      details.message,
      details.stderr ? `stderr: ${details.stderr}` : "",
      details.stdout ? `stdout: ${details.stdout}` : "",
    ].filter(Boolean);
    traceLogs.push({
      event_type: "provider.process.failed",
      status: "error",
      summary: "Codex local task failed",
      error: errorLines.join("\n") || "Codex local task failed",
    });

    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: errorLines.join("\n") || "Codex local task failed",
      logs: traceLogs,
      requires_human_review: true,
      requires_approval: false,
    };
  } finally {
    await fs.rm(path.dirname(outputFile), { recursive: true, force: true }).catch(() => undefined);
  }
}
