import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { parseGsUri } from "./pipeline-dashboard";
import type { HostedRuntimeResolution } from "./hosted-session-runtime";

const execFileAsync = promisify(execFile);

export class HostedSessionOrchestratorError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function validationRepoPath() {
  return (
    process.env.BLUEPRINT_VALIDATION_REPO_PATH ||
    "/Users/nijelhunt_1/workspace/BlueprintValidation"
  );
}

function validationConfigPath() {
  return (
    process.env.BLUEPRINT_VALIDATION_CONFIG_PATH ||
    path.join(validationRepoPath(), "configs", "qualified_opportunity_validation.yaml")
  );
}

function sessionWorkRoot() {
  return (
    process.env.BLUEPRINT_HOSTED_SESSION_WORK_ROOT ||
    path.join(os.tmpdir(), "blueprint-hosted-sessions")
  );
}

async function readTextFromUri(uri: string): Promise<string> {
  if (uri.startsWith("gs://")) {
    if (!storageAdmin) {
      throw new HostedSessionOrchestratorError(
        "artifact_download_unavailable",
        "Storage is not configured, so hosted-session artifacts cannot be staged.",
      );
    }
    const { bucket, objectPath } = parseGsUri(uri);
    const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
    return buffer.toString("utf-8");
  }

  return fs.readFile(uri, "utf-8");
}

async function readBufferFromUri(uri: string): Promise<Buffer> {
  if (uri.startsWith("gs://")) {
    if (!storageAdmin) {
      throw new HostedSessionOrchestratorError(
        "artifact_download_unavailable",
        "Storage is not configured, so hosted-session artifacts cannot be staged.",
      );
    }
    const { bucket, objectPath } = parseGsUri(uri);
    const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
    return buffer;
  }

  return fs.readFile(uri);
}

async function stageJson(uri: string, outputPath: string) {
  const content = await readTextFromUri(uri);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

async function stageBinary(uri: string, outputPath: string) {
  const content = await readBufferFromUri(uri);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content);
  return outputPath;
}

async function stageHostedRuntimeArtifacts(
  workDir: string,
  runtime: HostedRuntimeResolution,
) {
  const runtimeDir = path.join(workDir, "runtime");
  await fs.mkdir(runtimeDir, { recursive: true });

  const runtimeManifest = await stageJson(
    runtime.runtimeManifestUri,
    path.join(runtimeDir, "hosted_session_runtime_manifest.source.json"),
  );
  const taskAnchor = await stageJson(
    runtime.taskAnchorManifestUri,
    path.join(runtimeDir, "task_anchor_manifest.json"),
  );
  const taskRun = await stageJson(
    runtime.taskRunManifestUri,
    path.join(runtimeDir, "task_run_manifest.json"),
  );
  await stageJson(
    runtime.sceneMemoryManifestUri,
    path.join(runtimeDir, "scene_memory_manifest.json"),
  );
  const conditioningBundle = await stageJson(
    runtime.conditioningBundleUri,
    path.join(runtimeDir, "conditioning_bundle.json"),
  );
  if (runtime.previewSimulationManifestUri) {
    try {
      await stageJson(
        runtime.previewSimulationManifestUri,
        path.join(runtimeDir, "preview_simulation_manifest.json"),
      );
    } catch {
      // Optional artifact for v1.
    }
  }

  let conditioningInputPath: string | null = null;
  const keyframeUri = String(conditioningBundle["keyframe_uri"] || "").trim();
  const rawVideoUri = String(conditioningBundle["raw_video_uri"] || "").trim();
  if (keyframeUri) {
    const extension = path.extname(keyframeUri) || ".png";
    conditioningInputPath = await stageBinary(
      keyframeUri,
      path.join(runtimeDir, `conditioning_keyframe${extension}`),
    );
  } else if (rawVideoUri) {
    const extension = path.extname(rawVideoUri) || ".mp4";
    conditioningInputPath = await stageBinary(
      rawVideoUri,
      path.join(runtimeDir, `conditioning_video${extension}`),
    );
  }

  const adapterManifestUris =
    runtimeManifest["adapter_manifest_uris"] &&
    typeof runtimeManifest["adapter_manifest_uris"] === "object"
      ? (runtimeManifest["adapter_manifest_uris"] as Record<string, unknown>)
      : {};
  const stagedAdapterManifestPaths: Record<string, string> = {};
  for (const [backend, uri] of Object.entries(adapterManifestUris)) {
    const text = String(uri || "").trim();
    if (!text) {
      continue;
    }
    const stagedPath = path.join(runtimeDir, "adapter_manifests", `${backend}.json`);
    try {
      await stageJson(text, stagedPath);
      stagedAdapterManifestPaths[backend] = stagedPath;
    } catch {
      // Optional backend staging; if this fails, validation can still use manifest defaults.
    }
  }

  const stagedRuntimeManifest = {
    ...runtimeManifest,
    hosted_session_runtime_manifest_uri: runtime.runtimeManifestUri,
    scene_memory_manifest_uri: path.join(runtimeDir, "scene_memory_manifest.json"),
    conditioning_bundle_uri: path.join(runtimeDir, "conditioning_bundle.json"),
    conditioning_input_path: conditioningInputPath,
    preview_simulation_manifest_uri: runtime.previewSimulationManifestUri
      ? path.join(runtimeDir, "preview_simulation_manifest.json")
      : null,
    adapter_manifest_uris: stagedAdapterManifestPaths,
    task_anchor_manifest_uri: path.join(runtimeDir, "task_anchor_manifest.json"),
    task_run_manifest_uri: path.join(runtimeDir, "task_run_manifest.json"),
    site_submission_id: runtime.site_submission_id,
    scene_id: runtime.scene_id,
    capture_id: runtime.capture_id,
    pipeline_prefix: runtime.pipeline_prefix,
    task_ids: Array.isArray(taskAnchor["tasks"])
      ? taskAnchor["tasks"].map((task) => String((task as Record<string, unknown>).task_id || ""))
      : [],
    task_texts: Array.isArray(taskAnchor["tasks"])
      ? taskAnchor["tasks"].map((task) => String((task as Record<string, unknown>).task_text || ""))
      : [],
    start_states:
      (Array.isArray(runtimeManifest["start_states"]) && runtimeManifest["start_states"]) ||
      (Array.isArray(taskRun["start_states"]) && taskRun["start_states"]) ||
      ["default_start_state"],
  };

  const stagedPath = path.join(runtimeDir, "hosted_session_runtime_manifest.json");
  await fs.writeFile(stagedPath, JSON.stringify(stagedRuntimeManifest, null, 2), "utf-8");

  return {
    runtimeManifestPath: stagedPath,
    taskAnchorManifestPath: path.join(runtimeDir, "task_anchor_manifest.json"),
    taskRunManifestPath: path.join(runtimeDir, "task_run_manifest.json"),
  };
}

async function runValidationSessionCommand(args: string[], cwd: string) {
  const repo = validationRepoPath();
  const env = {
    ...process.env,
    PYTHONPATH: [path.join(repo, "src"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  };
  const fullArgs = ["-m", "blueprint_validation.cli", "--config", validationConfigPath(), ...args];
  const { stdout } = await execFileAsync("python3", fullArgs, { cwd, env });
  return JSON.parse(stdout || "{}") as Record<string, unknown>;
}

export async function createHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  runtime: HostedRuntimeResolution;
  robotProfileId: string;
  robotProfileOverride?: Record<string, unknown>;
  policy: Record<string, unknown>;
  taskId: string;
  scenarioId: string;
  startStateId: string;
  exportModes: string[];
  notes?: string;
}) {
  await fs.mkdir(params.workDir, { recursive: true });
  const staged = await stageHostedRuntimeArtifacts(params.workDir, params.runtime);
  const policyJson = JSON.stringify(params.policy || {});

  const payload = await runValidationSessionCommand(
    [
      "session",
      "create",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
      "--runtime-manifest",
      staged.runtimeManifestPath,
      "--robot-profile-id",
      params.robotProfileId,
      "--task-id",
      params.taskId,
      "--scenario-id",
      params.scenarioId,
      "--start-state-id",
      params.startStateId,
      "--policy-json",
      policyJson,
      ...params.exportModes.flatMap((item) => ["--export-mode", item]),
      ...(params.robotProfileOverride
        ? ["--robot-profile-override-json", JSON.stringify(params.robotProfileOverride)]
        : []),
      ...(params.notes ? ["--notes", params.notes] : []),
    ],
    validationRepoPath(),
  );

  return { payload, staged };
}

export async function resetHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
}) {
  return runValidationSessionCommand(
    [
      "session",
      "reset",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
      ...(params.taskId ? ["--task-id", params.taskId] : []),
      ...(params.scenarioId ? ["--scenario-id", params.scenarioId] : []),
      ...(params.startStateId ? ["--start-state-id", params.startStateId] : []),
      ...(params.seed !== undefined ? ["--seed", String(params.seed)] : []),
    ],
    validationRepoPath(),
  );
}

export async function stepHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  episodeId: string;
  action?: number[];
  autoPolicy?: boolean;
}) {
  return runValidationSessionCommand(
    [
      "session",
      "step",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
      "--episode-id",
      params.episodeId,
      ...(params.autoPolicy === false ? ["--no-auto-policy"] : []),
      ...(params.action?.length ? ["--action-json", JSON.stringify(params.action)] : []),
    ],
    validationRepoPath(),
  );
}

export async function runBatchHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  numEpisodes: number;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
  maxSteps?: number;
}) {
  return runValidationSessionCommand(
    [
      "session",
      "run-batch",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
      "--num-episodes",
      String(params.numEpisodes),
      ...(params.taskId ? ["--task-id", params.taskId] : []),
      ...(params.scenarioId ? ["--scenario-id", params.scenarioId] : []),
      ...(params.startStateId ? ["--start-state-id", params.startStateId] : []),
      ...(params.seed !== undefined ? ["--seed", String(params.seed)] : []),
      ...(params.maxSteps !== undefined ? ["--max-steps", String(params.maxSteps)] : []),
    ],
    validationRepoPath(),
  );
}

export async function stopHostedSessionRun(params: { sessionId: string; workDir: string }) {
  return runValidationSessionCommand(
    [
      "session",
      "stop",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
    ],
    validationRepoPath(),
  );
}

export async function exportHostedSessionRun(params: { sessionId: string; workDir: string }) {
  return runValidationSessionCommand(
    [
      "session",
      "export",
      "--session-id",
      params.sessionId,
      "--session-work-dir",
      params.workDir,
    ],
    validationRepoPath(),
  );
}

export function sessionWorkDir(sessionId: string) {
  return path.join(sessionWorkRoot(), sessionId);
}
