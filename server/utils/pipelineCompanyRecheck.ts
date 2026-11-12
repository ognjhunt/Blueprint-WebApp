/**
 * Tell the Pipeline at once when a job's permission changes (planner, 2026-11-12, 16:35Z): after a recording statement
 * that shares the job is recorded on a job that already has a capture, and after a withdrawal. Contract:
 * `POST /api/live-pipeline/website-company-clips/{capture_id}/recheck?request_id={request_id}`, signed like the website's
 * other calls (`signedWebsitePipelineRequest`), empty body; 202, or 403, 404, 429. The Pipeline then reads the live
 * statement again within about a minute, for the company's video and the simulation package both.
 *
 * Best effort, once: it never fails or delays the person's request (callers do not await it), a failure is logged, and
 * there is no retry loop (the Pipeline's own read every 6 hours is the fallback).
 */
import { logger } from "../logger";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";

const TIMEOUT_MS = 5_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

/** One call; resolves to the HTTP status, or null when not configured or the call failed. Never throws. */
export async function askPipelineToRecheckCapture(requestId: string, captureId: string): Promise<number | null> {
  try {
    if (!ID.test(requestId) || !ID.test(captureId)) return null;
    const origin = signedWebsitePipelineRequest(`/api/live-pipeline/website-company-clips/${encodeURIComponent(captureId)}/recheck`, "",
      { request_id: requestId });
    if (!origin) return null;
    const response = await fetch(origin.url, { method: "POST", headers: { ...origin.headers, "content-type": "application/json" },
      body: "", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status !== 202) logger.warn({ requestId, captureId, status: response.status }, "The Pipeline did not accept a permission recheck");
    return response.status;
  } catch (error) {
    logger.warn({ error, requestId, captureId }, "Could not ask the Pipeline to recheck a capture's permission");
    return null;
  }
}

/** Fire and forget: for a route that must answer the person without waiting. */
export function recheckCaptureInBackground(requestId: string, captureId: string): void {
  void askPipelineToRecheckCapture(requestId, captureId);
}
