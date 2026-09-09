import { randomBytes } from "node:crypto";
import { z } from "zod";
import { taskEvaluationLaunchInputSchema, taskEvaluationTerminalResourceReleaseInputSchema } from "./taskEvaluationLaunchContract";
import { taskEvaluationLaunchPreparationInputSchema } from "./taskEvaluationLaunchPreparationContract";
import { taskEvaluationLaunchActivationInputSchema } from "./taskEvaluationLaunchActivationContract";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { workHash, type WorkIdentity, type WorkStore } from "./blueprintWorkOAuth";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
export const WORK_TOOL_SCHEMAS = {
  list_launch_profiles: z.object({}).strict(),
  list_runs: z.object({ cursor: id.optional(), limit: z.number().int().min(1).max(50).default(20) }).strict(),
  get_run_status: z.object({ launch_id: id }).strict(),
  get_run_logs: z.object({ launch_id: id, cursor: id.optional(), limit: z.number().int().min(1).max(100).default(40) }).strict(),
  get_run_artifacts: z.object({ record_id: id }).strict(),
  get_supervision_status: z.object({}).strict(),
  preflight_run: z.object({ request: taskEvaluationLaunchInputSchema }).strict(),
  submit_run: z.object({ preflight_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/), confirm_execution: z.literal(true) }).strict(),
  prepare_run: z.object({ request: taskEvaluationLaunchPreparationInputSchema }).strict(),
  get_preparation_status: z.object({ preparation_id: id }).strict(),
  activate_prepared_run: z.object({ request: taskEvaluationLaunchActivationInputSchema }).strict(),
  get_activation_status: z.object({ activation_id: id }).strict(),
  request_resource_release: z.object({ launch_id: id, request: taskEvaluationTerminalResourceReleaseInputSchema }).strict(),
};
export type WorkTool = keyof typeof WORK_TOOL_SCHEMAS;
export function workToolScope(name: WorkTool) {
  if (name === "submit_run" || name === "activate_prepared_run") return "blueprint:runs:launch";
  if (name === "prepare_run") return "blueprint:runs:prepare";
  if (name === "request_resource_release") return "blueprint:runs:release";
  return "blueprint:runs:read";
}
export type WorkOperation = { method: "GET" | "POST"; path: string; body?: unknown };
export type WorkCall = (operation: WorkOperation) => Promise<{ status: number; body: Record<string, any> }>;
const safe = encodeURIComponent;
export function workOperation(name: WorkTool, input: any): WorkOperation {
  switch (name) {
    case "list_launch_profiles": return { method: "GET", path: "/profiles" };
    case "list_runs": return { method: "GET", path: `/work-runs?limit=${input.limit}${input.cursor ? `&cursor=${safe(input.cursor)}` : ""}` };
    case "get_run_status": return { method: "GET", path: `/${safe(input.launch_id)}` };
    case "get_run_logs": return { method: "GET", path: `/work-runs/${safe(input.launch_id)}/logs?limit=${input.limit}${input.cursor ? `&cursor=${safe(input.cursor)}` : ""}` };
    case "get_run_artifacts": return { method: "GET", path: `/work-results/${safe(input.record_id)}` };
    case "get_supervision_status": return { method: "GET", path: "/supervision" };
    case "prepare_run": return { method: "POST", path: "/preparations", body: input.request };
    case "get_preparation_status": return { method: "GET", path: `/preparations/${safe(input.preparation_id)}` };
    case "activate_prepared_run": return { method: "POST", path: "/activations", body: input.request };
    case "get_activation_status": return { method: "GET", path: `/activations/${safe(input.activation_id)}` };
    case "request_resource_release": return { method: "POST", path: `/${safe(input.launch_id)}/terminal-resource-releases`, body: input.request };
    default: throw new Error("work_operation_requires_preflight_binding");
  }
}

// A presentation projection, never an evidence receipt: keep original receipts
// on the controller/Website. Do not return signed URLs, credentials or host paths.
export function workProjection(value: unknown, depth = 0): any {
  if (depth > 12) return "[depth limited]";
  if (typeof value === "string") return value
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-|hf_)[A-Za-z0-9_-]{12,}/g, "[redacted]")
    .replace(/\b((?:[A-Z_]*)(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY))\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']+/g, "$1?[redacted]")
    .replace(/\/(?:etc|opt|var|home|Users|private)\/[^\s"']+/g, "[host-path]").slice(0, 3000);
  if (Array.isArray(value)) return value.slice(0, 100).map(v => workProjection(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([k]) => !/(?:secret|password|authorization|credential|token|api_key|private_key|signed_url|download_url|raw_body|environment|env_vars)/i.test(k))
    .slice(0, 100).map(([k, v]) => [k, workProjection(v, depth + 1)]));
  return value;
}

export async function executeWorkTool(name: WorkTool, args: unknown, identity: WorkIdentity,
  scopes: string[], store: WorkStore, call: WorkCall, now = Math.floor(Date.now() / 1000)) {
  if (!scopes.includes(workToolScope(name))) throw new Error("work_scope_required");
  const input = WORK_TOOL_SCHEMAS[name].parse(args) as any;
  if (name === "preflight_run") {
    const request = { ...input.request, authorization_issued_at: input.request.authorization_issued_at || new Date(now * 1000).toISOString() };
    const result = await call({ method: "POST", path: "/work-preflight", body: request });
    if (result.status !== 200 || result.body.status !== "ready") return result;
    const preflightId = randomBytes(32).toString("base64url");
    const binding = { identity, request, request_digest: result.body.candidate_request_digest,
      input_digest: canonicalArtifactDigest(request, "input_digest"), created_at: now, expires_at: now + 300 };
    await store.set(`preflight-${workHash(preflightId)}`, binding);
    return { status: 200, body: { ...result.body, preflight_id: preflightId, expires_at_epoch: binding.expires_at,
      reviewed_request: request, provider_execution_authorized_by_preflight: false } };
  }
  if (name === "submit_run") {
    const binding = await store.get(`preflight-${workHash(input.preflight_id)}`);
    if (!binding || binding.identity.uid !== identity.uid || binding.identity.tenantId !== identity.tenantId
      || canonicalArtifactDigest(binding.request, "input_digest") !== binding.input_digest) throw new Error("work_preflight_binding_invalid");
    // A retry always reuses the same launch identity and bytes. The existing
    // Website transaction and Pipeline queue enforce idempotency across replicas.
    if (binding.expires_at <= now) throw new Error("work_preflight_expired_reconcile_run_before_preparing_again");
    const fresh = await call({ method: "POST", path: "/work-preflight", body: binding.request });
    if (fresh.status !== 200 || fresh.body.candidate_request_digest !== binding.request_digest) {
      return { status: 409, body: { status: "blocked", blockers: ["work_preflight_changed"], preflight: fresh.body } };
    }
    return call({ method: "POST", path: "/", body: binding.request });
  }
  return call(workOperation(name, input));
}
