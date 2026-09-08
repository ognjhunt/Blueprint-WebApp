export const RESULT_ARTIFACT_REQUEST_TIMEOUT_MS = 15_000;

export function resultRetryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

/** Cancel the caller's result operation without cancelling unrelated shared auth/CSRF work. */
export async function boundedResultArtifactRequest<T>(
  action: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
  timeoutMs = RESULT_ARTIFACT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener("abort", abort, { once: true });
  if (externalSignal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException("Result request timed out", "TimeoutError")), timeoutMs);
  let rejectAbort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(controller.signal.reason || new DOMException("Result request cancelled", "AbortError"));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
    });
    return await Promise.race([cancelled, Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return action(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
  }
}


async function isCsrfRejection(response: Response) {
  if (response.status !== 403) return false;
  const reader = response.clone().body?.getReader();
  if (!reader) return false;
  const bytes = new Uint8Array(4096);
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > bytes.length) return false;
      bytes.set(next.value, length - next.value.length);
    }
    const value = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
    return value?.error === "Invalid CSRF token";
  } catch { return false; }
  finally { void reader.cancel().catch(() => undefined); }
}

/** Retry only the middleware's pre-handler CSRF refusal, once, with the same operation. */
export async function resultPostWithCsrfRecovery(
  request: (refreshCsrf: boolean) => Promise<Response>,
  signal: AbortSignal,
) {
  const response = await request(false);
  if (!await isCsrfRejection(response)) return response;
  try { await response.body?.cancel(); } catch { /* Refused response already closed. */ }
  signal.throwIfAborted();
  return request(true);
}
