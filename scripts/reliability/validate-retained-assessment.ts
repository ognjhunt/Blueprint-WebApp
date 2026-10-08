/** Offline admission replay of an authorized private packet; never invokes a model. */
import { readFileSync, mkdirSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { siteAssessmentSchema, validateAssessmentEvidence } from "../../server/agents/site-assessment";

const args = process.argv.slice(2);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
if (realpathSync(process.cwd()) !== realpathSync(repoRoot)) throw new Error("replay_requires_script_repository_cwd");
const option = (name: string) => { const at = args.indexOf(name); return at < 0 ? "" : args[at + 1] ?? ""; };
const packetPath = option("--packet");
const duration = Number(option("--duration"));
const output = resolve(option("--output") || `output/reliability-program/retained-assessment-${Date.now()}.json`);
const baselineSha = option("--baseline-sha");
const candidateRuntimeSha = option("--candidate-runtime-sha");
if (!packetPath || !Number.isFinite(duration) || duration <= 0 || [baselineSha, candidateRuntimeSha].some(sha => sha && !/^[a-f0-9]{40}$/.test(sha))) {
  throw new Error("Require --packet <authorized private JSON> --duration <seconds> [--baseline-sha <40-char SHA>] [--output <private ignored JSON>]");
}
if (output === resolve(packetPath) || (existsSync(output) && realpathSync(output) === realpathSync(packetPath))) {
  throw new Error("retained_packet_output_alias_forbidden");
}
if (!output.startsWith(resolve("output/reliability-program") + sep)) throw new Error("private_ignored_output_required");
if (existsSync(output)) throw new Error("retained_report_output_already_exists");
const raw = readFileSync(packetPath);
let packet: any;
try { packet = JSON.parse(raw.toString("utf8")); } catch { throw new Error("retained_packet_json_invalid"); }
const original = JSON.stringify(packet);
let assessment: ReturnType<typeof siteAssessmentSchema.parse>;
try { assessment = siteAssessmentSchema.parse(packet?.assessment); } catch { throw new Error("retained_packet_schema_invalid"); }
if (!Array.isArray(packet.sources)) throw new Error("retained_packet_sources_required");
const sources = new Map(packet.sources.map((source: any) => [source.source_id, source]));
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const replay = (validator: typeof validateAssessmentEvidence) => {
  try { validator(assessment, sources as any, duration); return { admitted: true, error_code: null }; }
  catch (error) {
    const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "non_error";
    return { admitted: false, error_code: /^assessment_[a-z_]+$/.test(message) ? message : "schema_or_admission_failure" };
  }
};
let baseline: Record<string, unknown> | null = null;
if (baselineSha) {
  const source = execFileSync("git", ["show", `${baselineSha}:server/agents/site-assessment.ts`], { encoding: "utf8", shell: false });
  const start = source.indexOf("export function validateAssessmentEvidence(");
  const end = source.indexOf("/** Existing workflow host", start);
  if (start < 0 || end < 0) throw new Error("baseline_validator_boundary_missing");
  const retainedFunction = source.slice(start, end).replace(/^export /, "");
  const javascript = ts.transpileModule(retainedFunction, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  // The audited baseline function is self-contained. Missing dependencies fail
  // replay; none are replaced or inferred to obtain a passing comparison.
  const validator = vm.runInNewContext(`${javascript}\nvalidateAssessmentEvidence`, {}, { timeout: 1000 });
  baseline = { code_sha: baselineSha, validator_sha256: digest(retainedFunction), ...replay(validator) };
}
const runtimeBytes = readFileSync(new URL("../../server/agents/site-assessment.ts", import.meta.url));
const runtimeSourceHash = digest(runtimeBytes);
const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", shell: false }).trim();
const committedSourceHash = digest(execFileSync("git", ["show", `${checkoutSha}:server/agents/site-assessment.ts`], { shell: false }));
if (candidateRuntimeSha && digest(execFileSync("git", ["show", `${candidateRuntimeSha}:server/agents/site-assessment.ts`], { shell: false })) !== runtimeSourceHash) {
  throw new Error("candidate_runtime_source_identity_mismatch");
}
const report = {
  schema: "blueprint.reliability.retained-assessment-admission.v1",
  executed_at_utc: new Date().toISOString(),
  mode: "offline_real_validator_exact_retained_packet", provider_calls: 0, known_dispatch_cost_usd: 0,
  packet_sha256: digest(raw), packet_bytes: raw.length, baseline,
  candidate: { checkout_code_sha: checkoutSha, runtime_source_origin_sha: candidateRuntimeSha || null,
    runtime_source_sha256: runtimeSourceHash, committed_source_matches_runtime: committedSourceHash === runtimeSourceHash,
    ...replay(validateAssessmentEvidence) },
  packet_unchanged: JSON.stringify(packet) === original,
  claim_ceiling: "Reference admission only; not video perception, semantic truth, customer publication or an additional model run. Raw packet/source identifiers and content remain private.",
};
if (!report.packet_unchanged) throw new Error("retained_packet_mutated");
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ mode: report.mode, baseline: baseline?.admitted ?? null, candidate: report.candidate.admitted,
  error_code: report.candidate.error_code, packet_unchanged: report.packet_unchanged, provider_calls: 0 }));
