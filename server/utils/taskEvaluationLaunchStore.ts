import { dbAdmin } from "../../client/src/lib/firebaseAdmin";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_READINESS_CACHE_MS = 60_000;

export class TaskEvaluationLaunchStoreTimeoutError extends Error {
  readonly code = "task_evaluation_launch_store_timeout";

  constructor() {
    super("Task Evaluation launch store operation timed out");
    this.name = "TaskEvaluationLaunchStoreTimeoutError";
  }
}

function boundedPositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.max(250, Math.floor(parsed)));
}

export function taskEvaluationLaunchStoreTimeoutMs() {
  return boundedPositiveInteger(
    process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    60_000,
  );
}

export async function withTaskEvaluationLaunchStoreTimeout<T>(
  operation: Promise<T>,
  timeoutMs = taskEvaluationLaunchStoreTimeoutMs(),
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new TaskEvaluationLaunchStoreTimeoutError()), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function taskEvaluationLaunchStoreErrorCode(error: unknown) {
  if (error instanceof TaskEvaluationLaunchStoreTimeoutError) return error.code;
  const raw = String(
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : "",
  ).trim().toLowerCase();
  if (raw.includes("permission-denied") || raw === "7") {
    return "task_evaluation_launch_store_permission_denied";
  }
  if (raw.includes("failed-precondition") || raw === "9") {
    return "task_evaluation_launch_store_failed_precondition";
  }
  if (raw.includes("resource-exhausted") || raw === "8") {
    return "task_evaluation_launch_store_resource_exhausted";
  }
  if (raw.includes("unavailable") || raw === "14") {
    return "task_evaluation_launch_store_dependency_unavailable";
  }
  return "task_evaluation_launch_store_unavailable";
}

export type TaskEvaluationLaunchStoreReadiness = {
  ready: boolean;
  code: "ok" | string;
  checked_at_iso: string;
};

let cachedReadiness: { expiresAt: number; value: TaskEvaluationLaunchStoreReadiness } | null = null;
let readinessInFlight: Promise<TaskEvaluationLaunchStoreReadiness> | null = null;

export async function probeTaskEvaluationLaunchStore(options: {
  firestore?: typeof dbAdmin;
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => number;
} = {}): Promise<TaskEvaluationLaunchStoreReadiness> {
  const firestore = options.firestore === undefined ? dbAdmin : options.firestore;
  const now = options.now || Date.now;
  const currentTime = now();
  if (cachedReadiness && cachedReadiness.expiresAt > currentTime) return cachedReadiness.value;
  if (readinessInFlight) return readinessInFlight;
  if (!firestore) return {
    ready: false,
    code: "task_evaluation_launch_store_not_configured",
    checked_at_iso: new Date(currentTime).toISOString(),
  };

  const cacheMs = boundedPositiveInteger(
    options.cacheMs ?? process.env.TASK_EVALUATION_LAUNCH_STORE_READINESS_CACHE_MS,
    DEFAULT_READINESS_CACHE_MS,
    5 * 60_000,
  );
  readinessInFlight = (async () => {
    let value: TaskEvaluationLaunchStoreReadiness;
    try {
      await withTaskEvaluationLaunchStoreTimeout(
        firestore.collection("__blueprintHealth").doc("task-evaluation-launch-store").get(),
        options.timeoutMs,
      );
      value = { ready: true, code: "ok", checked_at_iso: new Date(now()).toISOString() };
    } catch (error) {
      value = {
        ready: false,
        code: taskEvaluationLaunchStoreErrorCode(error),
        checked_at_iso: new Date(now()).toISOString(),
      };
    }
    cachedReadiness = { expiresAt: now() + cacheMs, value };
    return value;
  })();
  try {
    return await readinessInFlight;
  } finally {
    readinessInFlight = null;
  }
}

export function resetTaskEvaluationLaunchStoreReadinessCacheForTests() {
  cachedReadiness = null;
  readinessInFlight = null;
}
