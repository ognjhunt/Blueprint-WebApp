import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { z } from "zod";
import { captureSavedEvidence, compareAssessmentRuns, experimentVersions, openExperimentAllocation,
  sanitizeExperiment, validateSavedEvidence, writeExperimentJson } from "../server/agents/assessment-experiment";

const help = `Usage:
  npm run assessment:iterate -- --mode saved-evidence --input INPUT.json --evidence EVIDENCE.json --approved-budget ALLOCATION.json --output NEW_RUN_DIR
  npm run assessment:iterate -- --mode fresh-video --input INPUT.json --approved-budget ALLOCATION.json --output NEW_RUN_DIR
  npm run assessment:iterate -- --preflight --input INPUT.json --output NEW_RUN_DIR
  npm run assessment:iterate -- --compare BEFORE_DIR AFTER_DIR --output NEW_COMPARISON.json
Saved evidence still calls paid Sol. Fresh video calls paid Sol + Gemini. No automatic retry or customer writes.
--preflight reads only the exact request metadata, configuration presence and optional local-video hash.
See docs/site-assessment-iteration.md for the existing inference_program.v1 allocation and proof limits.`;
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const inputSchema = z.object({ message: z.string().min(1).max(8000),
  context: z.object({ request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/) }).strict(),
  execution_scope: z.literal("read-only-preflight").optional(),
  local_video: z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive() }).strict().optional(),
}).strict();
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
function codeIdentity() {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });
  const status = git("status", "--porcelain");
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)
    .map(file => [file, sha(fs.readFileSync(file))]);
  return { commit: git("rev-parse", "HEAD").trim(), dirty: Boolean(status), patch_sha256: sha(git("diff", "HEAD") + JSON.stringify(untracked)),
    node: process.version, sdk_version: readJson(path.resolve("node_modules/@openai/agents/package.json")).version };
}
function failure(error: unknown) {
  const own = (key: string) => { try { return error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, key)?.value : undefined; } catch { return undefined; } };
  const status = own("status"), code = own("code"), cause = own("cause");
  const row = error instanceof Error ? error : Error("experiment_unknown_error");
  // Never retain arbitrary exception prose/stack/body. Owned codes and schema paths are enough to repair input.
  const ownMessage = own("message");
  const message = typeof ownMessage === "string" && /^(experiment_|inference_programme_|site_assessment_|assessment_|gemini_video_)[a-z0-9_]+$/.test(ownMessage) ? ownMessage : "experiment_failed";
  const providerCode = typeof code === "string" && /^(gemini_video_[a-z0-9_]+|invalid_request_error|rate_limit_exceeded|context_length_exceeded|invalid_api_key|insufficient_quota|server_error|model_not_found|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN)$/.test(code) ? code : null;
  return { code: message, provider_error_code: providerCode,
    http_status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    cause: cause && cause !== error ? failureWithoutCause(cause) : undefined,
    exception_class: row instanceof z.ZodError ? "ZodError" : row instanceof SyntaxError ? "SyntaxError" : row instanceof TypeError ? "TypeError" : "Error",
    issues: row instanceof z.ZodError ? row.issues.map(issue => ({ path: issue.path, code: issue.code })) : undefined,
    system_code: ["ENOENT", "EEXIST", "EACCES"].includes(code) ? code : undefined };
}

function failureWithoutCause(error: unknown) {
  // Cause may cycle or have hostile getters. Only its own status/code/builtin class is retained.
  const copy = error instanceof TypeError ? new TypeError("experiment_cause_unavailable")
    : error instanceof SyntaxError ? new SyntaxError("experiment_cause_unavailable") : new Error("experiment_cause_unavailable");
  for (const key of ["status", "code"]) { try { const value = Object.getOwnPropertyDescriptor(error, key)?.value;
    if (value !== undefined) Object.defineProperty(copy, key, { value }); } catch {} }
  return failure(copy);
}

async function main() {
  const { values, positionals } = parseArgs({ options: { mode: { type: "string" }, input: { type: "string" }, output: { type: "string" },
    evidence: { type: "string" }, "approved-budget": { type: "string" }, compare: { type: "boolean" }, preflight: { type: "boolean" }, help: { type: "boolean" } }, allowPositionals: true });
  if (values.help) { console.log(help); return; }
  if (!values.output) throw Error("experiment_output_required");
  if (values.compare) {
    if (positionals.length !== 2 || values.mode || values.preflight || values.input) throw Error("experiment_compare_arguments_invalid");
    if (fs.existsSync(values.output)) throw Error("experiment_output_exists");
    const result = compareAssessmentRuns(readJson(path.join(positionals[0], "run.json")), readJson(path.join(positionals[1], "run.json")));
    writeExperimentJson(values.output, result);
    console.log(`Comparison saved. Changed sections: ${result.changed_sections.join(", ") || "none"}. Quality requires operator review.`); return;
  }
  const output = path.resolve(values.output);
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 }); fs.mkdirSync(output, { mode: 0o700 });
  const started = Date.now(), startedAt = new Date(started).toISOString(), runId = `assessment-experiment-${randomUUID()}`;
  let allocation: ReturnType<typeof openExperimentAllocation> | undefined;
  const run: Record<string, any> = { schema_version: "site_assessment_experiment.v1", run_id: runId, mode: values.mode ?? "preflight", started_at: startedAt,
    status: "failed", stage: "input", provider_call_may_have_happened: false, output_retention: "private_local_sanitized" };
  try {
    if (!values.input || positionals.length) throw Error("experiment_input_required");
    if (values.preflight ? Boolean(values.mode || values.evidence || values["approved-budget"])
      : !["saved-evidence", "fresh-video"].includes(values.mode ?? "")) throw Error("experiment_mode_invalid");
    if (!values.preflight && (values.mode === "saved-evidence") !== Boolean(values.evidence)) throw Error("experiment_evidence_mode_invalid");
    const input = inputSchema.parse(readJson(values.input));
    if (input.execution_scope === "read-only-preflight" && !values.preflight) throw Error("experiment_input_read_only");
    run.input = sanitizeExperiment(input); run.code = codeIdentity(); run.versions = experimentVersions(process.cwd());
    if (input.local_video) {
      const body = fs.readFileSync(input.local_video.path);
      if (body.length !== input.local_video.bytes || sha(body) !== input.local_video.sha256) throw Error("experiment_local_video_binding_changed");
      run.local_video = { sha256: sha(body), bytes: body.length, matches_supplied_binding: true };
    }
    // Plain logging avoids a development transport worker; no app/server/scheduler is started.
    process.env.NODE_ENV ??= "production"; process.env.LOG_LEVEL = "silent";
    await import("../server/config/bootstrap-env");
    const { SITE_ASSESSMENT_MODEL, getGeminiVideoModel, isGeminiVideoConfigured } = await import("../server/agents/provider-config");
    run.models = { openai: SITE_ASSESSMENT_MODEL, gemini: getGeminiVideoModel(), override: false };
    run.configuration = { openai_present: Boolean(process.env.OPENAI_API_KEY?.trim()), gemini_present: isGeminiVideoConfigured(),
      firebase_present: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      lane_enabled: ["1", "true", "yes", "on"].includes(process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED ?? "") };
    if (values.preflight) {
      run.stage = "read_only_request_preflight";
      const { dbAdmin } = createRequire(import.meta.url)("../client/src/lib/firebaseAdmin.ts") as typeof import("../client/src/lib/firebaseAdmin");
      if (!dbAdmin) throw Error("experiment_firebase_unavailable");
      const raw = (await dbAdmin.collection("inboundRequests").doc(input.context.request_id).get()).data();
      const { projectWebsiteCaptureRights } = await import("../server/utils/websiteTaskContext");
      run.request_preflight = { exists: Boolean(raw), site_operator: raw?.request?.buyerType === "site_operator",
        rights_allowed: projectWebsiteCaptureRights(raw ?? {}).derived_scene_generation_allowed,
        privacy_proceeded: raw?.capture_privacy_source_bound_decision?.proceeded === true,
        source_key_present: Boolean(raw?.capture_privacy_source_bound_decision?.producer_source?.key),
        local_video_is_not_upload_acceptance: true };
      run.status = "preflight_only"; return;
    }
    run.stage = "experiment_allocation";
    if (!values["approved-budget"]) throw Error("experiment_explicit_provider_approval_required");
    allocation = openExperimentAllocation(values["approved-budget"], input.context.request_id, runId, values.mode as "saved-evidence" | "fresh-video");
    run.allocation_id = allocation.approval.allocation_id;
    run.stage = "credentials";
    if (!run.configuration.openai_present) throw Error("experiment_openai_credential_missing");
    if (values.mode === "fresh-video" && !run.configuration.gemini_present) throw Error("experiment_gemini_credential_missing");
    const retainFailure = async <T>(action: () => Promise<T>): Promise<T> => {
      try { return await action(); } catch (error) { run.error = failure(error); throw error; }
    };
    const { runSiteAssessmentTask } = await import("../server/agents/adapters/site-assessment");
    const { siteAssessmentTask } = await import("../server/agents/tasks/site-assessment");
    const evidence = values.evidence ? readJson(values.evidence) : undefined;
    run.stage = "production_adapter_admission";
    run.scope = { reused_stage: values.mode === "saved-evidence" ? "Gemini observations" : null,
      upload_retested: false, customer_workflow_retested: false, business_writes: false, embeddings: "disabled; authorized lexical history remains",
      reservation_persistence: "dedicated local existing inference_program.v1", model_substitution: false };
    const { local_video, execution_scope, ...taskInput } = input;
    const task = { kind: "site_assessment", input: taskInput, provider: "openai_responses", runtime: "openai_agents_sdk", model: SITE_ASSESSMENT_MODEL,
      definition: siteAssessmentTask, tool_policy: { ...siteAssessmentTask.tool_policy, allowed_domains: ["api.openai.com", "generativelanguage.googleapis.com", "storage.googleapis.com"],
        isolated_runtime_required: false }, metadata: {} } as any;
    run.result = await runSiteAssessmentTask(task, { runId, assertActive: async () => retainFailure(async () => allocation!.assertActive()), assertCostAllowed: async () => retainFailure(async () => allocation!.assertActive()),
      experiment: { record_error: error => { run.error ??= failure(error); run.failure_stage ??= run.stage; }, mode: values.mode as "saved-evidence" | "fresh-video", prepare: async source => retainFailure(async () => {
        run.source = source; allocation!.bind(source);
        if (input.local_video && (source.video_sha256 !== input.local_video.sha256 || source.video_bytes !== input.local_video.bytes)) throw Error("experiment_uploaded_video_binding_changed");
        run.stage = "evidence_binding";
        const sources = evidence ? await validateSavedEvidence(evidence, source, run.versions) : [];
        run.stage = "assessment_sdk"; return sources;
      }), reserve: async (...args) => {
        run.stage = `${args[2] ?? "gemini"}_admission`;
        const reservation = await retainFailure(() => allocation!.reserve(...args));
        run.provider_call_may_have_happened = true; // Conservative: reservation is durable, response may be lost.
        run.stage = `${args[2] ?? "gemini"}_provider`;
        writeExperimentJson(path.join(output, "run.json"), sanitizeExperiment({ ...run, allocation: allocation!.status() }));
        return reservation;
      }, ...(values.mode === "saved-evidence" ? { analyze_video: async () => {
        allocation!.pause("experiment_saved_evidence_miss");
        throw Error("experiment_saved_evidence_miss");
      } } : {}) } });
    run.status = run.result.status;
    if (values.mode === "fresh-video" && run.source) {
      run.stage = "evidence_retention";
      const saved = await captureSavedEvidence(run.result, run.source, run.versions, allocation.approval.retention, startedAt);
      if (saved) { writeExperimentJson(path.join(output, "evidence.json"), saved); run.reusable_evidence = "evidence.json"; }
      else run.reusable_evidence = "not_available_or_redaction_changed_evidence";
    }
    if (run.status !== "completed") { run.stage = run.failure_stage ?? run.stage; process.exitCode = 1; }
    else run.stage = "complete";
  } catch (error) { run.status = "failed"; run.error = failure(error); process.exitCode = 1; }
  finally {
    run.completed_at = new Date().toISOString(); run.wall_ms = Date.now() - started;
    if (allocation) {
      try { run.allocation = allocation.status(); } catch (error) { run.allocation_read_error = failure(error); process.exitCode = 1; }
      allocation.close();
    }
    writeExperimentJson(path.join(output, "run.json"), sanitizeExperiment(run));
    const packet = run.result?.artifacts?.site_assessment_packet;
    if (packet) writeExperimentJson(path.join(output, "assessment.json"), sanitizeExperiment(packet.assessment));
    const code = run.error?.code ?? run.allocation?.pause_reason ?? run.result?.error ?? "none";
    fs.writeFileSync(path.join(output, "summary.md"), `Mode: ${run.mode}\nStatus: ${run.status}\nStage: ${run.stage}\nError: ${code}\nWall time: ${run.wall_ms} ms\nProvider call may have happened: ${run.provider_call_may_have_happened}\nCost status: ${run.result?.artifacts?.cost_status ?? "no_new_provider_dispatch"}\nKnown usage price estimate: ${run.result?.artifacts?.inference_reservation?.known_reported_cost_usd ?? "unavailable"}\nUnknown reserved exposure: ${run.result?.artifacts?.inference_reservation?.unknown_usage_reserved_cost_usd ?? "see allocation slots"}\n${run.mode === "saved-evidence" ? "Reuses fixed Gemini evidence; does not retest upload, perception or full integration. Still invokes paid production Sol.\n" : "No upload/customer acceptance or independently verified model quality is established by this experiment.\n"}`, { mode: 0o600 });
    console.log(`${run.status}: ${code}. Inspect ${path.join(output, "summary.md")}`);
  }
}
main().catch(error => { console.error(failure(error)); console.error(help); process.exitCode = 1; });
