/** One shared Pipeline runtime owns provider sessions and tool operations. */
import { createHash, createHmac, randomUUID } from "node:crypto";

import {
  adpTaskStatusSchema, assertAdpTaskIdentity,
  type AdpTaskAction, type AdpTaskAdmission, type AdpTaskStatus,
} from "../adp-contract";
import type { AgentResult } from "../types";
import { crossRuntimeDigest } from "../../utils/crossRuntimeCanonical";

function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (letter) => `\\u${letter.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${asciiJson(key)}:${canonical(item)}`).join(",")}}`;
  }
  return asciiJson(value);
}

function verifyResultDigests(status: AdpTaskStatus) {
  if (!status.result) return;
  if ("episode_outcome" in status.result.output) {
    if (!status.output_cross_runtime_digest || crossRuntimeDigest(status.result.output) !== status.output_cross_runtime_digest) {
      throw new Error("adp_agent_result_digest_mismatch");
    }
    if (!status.interpretation || (status.interpretation.task_digest && status.interpretation.task_digest !== status.task_digest)) {
      throw new Error("adp_agent_interpretation_binding_missing");
    }
    return;
  }
  const hash = (value: unknown) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
  // The diagnosis contract contains strings and arrays only, so its canonical
  // digest survives a JSON round trip. Retain the producer's full receipt
  // digest opaquely: JS cannot reproduce Python's 1 versus 1.0 encoding after
  // parsing the receipt's numeric usage fields.
  if (hash(status.result.output) !== status.result.output_digest) {
    throw new Error("adp_agent_result_digest_mismatch");
  }
}

export class AdpPipelineRequestError extends Error {
  constructor(readonly httpStatus: number | null, readonly code: string) { super(code); }
}

export async function requestAdpTask(
  admission: AdpTaskAdmission,
  action: AdpTaskAction,
  fetcher: typeof fetch = fetch,
): Promise<AdpTaskStatus> {
  const base = process.env.BLUEPRINT_AGENT_PIPELINE_BASE_URL?.trim();
  const token = process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN?.trim();
  if (!base || !token) throw new AdpPipelineRequestError(null, "adp_agent_pipeline_not_configured");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || url.pathname.replace(/\/$/, "") !== "/api/live-pipeline") {
    throw new AdpPipelineRequestError(null, "adp_agent_pipeline_origin_invalid");
  }
  if (action === "enqueue" && (!admission.enabled || admission.expires_at <= Date.now() / 1000)) {
    throw new AdpPipelineRequestError(null, "adp_agent_admission_expired_or_disabled");
  }
  const suffix = action === "inspect" ? "" : `/${action}`;
  const body = action === "inspect" ? "" : "{}";
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${admission.owner_client_id}.${nonce}.${body}`).digest("hex");
  let response: Response;
  try {
    response = await fetcher(`${base.replace(/\/$/, "")}/agents/tasks/${encodeURIComponent(admission.task_id)}${suffix}`, {
      method: action === "inspect" ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-client-id": admission.owner_client_id,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    throw new AdpPipelineRequestError(null, "adp_agent_pipeline_request_unresolved");
  }
  const text = await response.text();
  if (text.length > 1_000_000) throw new AdpPipelineRequestError(response.status, "adp_agent_response_too_large");
  if (!response.ok) {
    let detail = "";
    try { detail = JSON.parse(text).detail; } catch { /* Do not reflect remote prose. */ }
    const code = detail === "agent_task_missing" ? detail : "adp_agent_pipeline_request_refused";
    throw new AdpPipelineRequestError(response.status, code);
  }
  const status = adpTaskStatusSchema.parse(JSON.parse(text));
  assertAdpTaskIdentity(admission, status);
  verifyResultDigests(status);
  return status;
}

export function adpStatusToAgentResult(admission: AdpTaskAdmission, state: AdpTaskStatus): AgentResult {
  assertAdpTaskIdentity(admission, state);
  verifyResultDigests(state);
  const terminal = ["completed", "failed", "cancelled"].includes(state.state);
  const rawOutput = state.result?.output;
  const episode = rawOutput && "episode_outcome" in rawOutput ? rawOutput : null;
  const interpretation = state.interpretation;
  const interpretationPending = episode && interpretation?.status === "pending_validation";
  const interpretationRefused = episode && interpretation?.status === "refused";
  const output = episode ? {
    kind: "episode_interpretation", disposition: interpretation?.status ?? "pending_validation",
    summary: episode.summary, next_actions: [],
    uncertainty: episode.possible_missed_events.map((event) => `${event.description} ${event.reason}`),
    evidence_references: [...new Set(episode.events.flatMap((event) => event.evidence_refs.map((ref) => ref.artifact_digest)))],
    events: episode.events.map((event) => ({ time_seconds: event.start_time_seconds, description: event.description })),
    interpretation_receipt_digest: interpretation?.receipt_digest ?? null,
  } : rawOutput;
  return {
    provider: admission.runtime, runtime: admission.runtime, model: admission.model, tool_mode: "api",
    status: interpretationRefused ? "failed" : interpretationPending ? "running"
      : terminal ? state.state as "completed" | "failed" | "cancelled" : "running",
    output,
    error: interpretationRefused ? interpretation?.error_code ?? "episode_interpretation_refused" : state.error_code,
    requires_human_review: rawOutput && "disposition" in rawOutput ? rawOutput.disposition === "awaiting_input" : false,
    requires_approval: false,
    artifacts: { agent_execution: state, scientific_acceptance_granted: false },
    continuation_state: { pipeline_task_id: admission.task_id, task_digest: admission.task_digest },
  };
}
