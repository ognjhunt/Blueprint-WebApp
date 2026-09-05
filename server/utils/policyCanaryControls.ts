import { z } from "zod";

export const controlsStatuses = ["configured_controls_pending", "controls_failed", "controls_verified_development_only"] as const;
export const controlsWarnings = {
  configured_controls_pending: "Controls pending — results are unqualified.",
  controls_failed: "Required controls failed — results are unqualified.",
  controls_verified_development_only: "Controls verified for this simulation matrix — development-only results remain unqualified.",
} as const;
export const controlsStatusSchema = z.enum(controlsStatuses);
export const controlsWarningSchema = z.enum([controlsWarnings.configured_controls_pending, controlsWarnings.controls_failed, controlsWarnings.controls_verified_development_only]);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const artifact = z.object({ artifact_id: identifier, digest, size_bytes: z.number().int().positive() }).strict();
export const policyCanaryControlSchema = z.object({
  episode_id: identifier,
  control_id: z.enum(["zero_action_negative", "deterministic_scripted_positive"]),
  cell_id: identifier, seed: z.number().int(), terminal_state: z.enum(["completed", "blocked"]),
  control_passed: z.boolean(), receipt_digest: digest, receipt: artifact, cell_receipt: artifact,
  videos: z.record(z.string(), artifact),
  artifacts: z.array(artifact.extend({ role: z.string().min(1).max(128) }).strict()).max(32),
  score: z.object({
    status: z.string().optional(), task_succeeded: z.boolean().nullable().optional(),
    outcome: z.string().nullable().optional(), failed_criteria: z.array(z.unknown()).optional(),
    measurements: z.record(z.string(), z.unknown()).optional(), blockers: z.array(z.unknown()).optional(),
  }).strict(),
  evidence_gaps: z.array(z.string().max(256)).max(64),
}).strict();
export const policyCanaryControlFields = {
  controls: z.array(policyCanaryControlSchema).max(20).optional(),
  controls_summary: z.object({ expected_count: z.literal(20), recorded_count: z.number().int().min(0).max(20),
    completed_count: z.number().int().min(0).max(20), passed_count: z.number().int().min(0).max(20),
    verified_cell_count: z.number().int().min(0).max(10) }).strict().optional(),
  controls_gate: z.object({ status: z.enum(["passed", "blocked"]), required_control_episode_count: z.literal(20),
    candidate_policies_loaded_during_controls: z.literal(false) }).strict().optional(),
  strict_paired_gate: z.object({ schema_version: z.literal("policy_canary_strict_paired_gate.v1"),
    status: z.enum(["passed", "blocked"]), blockers: z.array(z.string()).max(128),
    deterministic_success_required: z.literal(false) }).strict().optional(),
  paired_delivery: z.object({ schema_version: z.string().optional(), status: z.string().optional(),
    archive_sha256: z.string().optional(), archive_size_bytes: z.number().int().positive().optional(),
    witness_manifest_digest: z.string().optional(), authority_digest: z.string().optional(),
    runtime_inputs_digest: z.string().optional(), run_id: z.string().optional(), result_digest: z.string().optional(),
  }).strict().optional(),
  strict_gate_blockers: z.array(z.string().max(512)).max(128).optional(),
};

type Controls = z.infer<typeof policyCanaryControlSchema>;
type Projection = {
  scene_controls_status?: string; warning?: string; controls?: Controls[];
  controls_summary?: { expected_count: number; recorded_count: number; completed_count: number; passed_count: number; verified_cell_count: number };
  controls_gate?: { status: string; required_control_episode_count: number; candidate_policies_loaded_during_controls: boolean };
  counts?: { completed_diagnostic_control_rollout_count: number };
  episodes?: Array<{ cell_id: string; candidate_id: string; seed: number }>;
  result_status?: string;
};

export function controlsProjectionBlockers(value: Projection): string[] {
  const status = value.scene_controls_status || "configured_controls_pending";
  const blockers: string[] = [];
  if (value.warning !== undefined && value.warning !== controlsWarnings[status as keyof typeof controlsWarnings]) blockers.push("controls_warning_mismatch");
  const rows = value.controls;
  if (!rows) return status === "configured_controls_pending" ? blockers : [...blockers, "controls_evidence_missing"];
  const pairs = new Set(rows.map((row) => `${row.cell_id}/${row.control_id}`));
  if (pairs.size !== rows.length) blockers.push("controls_duplicate_pair");
  const cells = new Map<string, Controls[]>();
  for (const row of rows) {
    cells.set(row.cell_id, [...(cells.get(row.cell_id) || []), row]);
    const expectedSuccess = row.control_id === "deterministic_scripted_positive";
    if (row.control_passed && (row.score.status !== "scored" || row.score.task_succeeded !== expectedSuccess
      || (!expectedSuccess && row.score.outcome !== "never_moved") || row.terminal_state !== "completed"
      || row.evidence_gaps.length || ["external", "wrist", "overview"].some((camera) => !row.videos[camera])
      || ["control_cell_archive", "frame_manifest", "state_trace", "action_trace"].some((role) => !row.artifacts.some((artifact) => artifact.role === role)))) blockers.push("controls_score_or_media_invalid");
  }
  const verifiedCells = [...cells].filter(([cell, pair]) => pair.length === 2
    && new Set(pair.map((row) => row.control_id)).size === 2 && pair[0].seed === pair[1].seed
    && pair.every((row) => row.control_passed && row.terminal_state === "completed" && !row.evidence_gaps.length)
    && ["pi05_droid", "groot_n17_droid"].every((candidate) => value.episodes?.some((episode) => episode.candidate_id === candidate && episode.cell_id === cell && episode.seed === pair[0].seed))).length;
  const expected = { expected_count: 20, recorded_count: rows.length,
    completed_count: rows.filter((row) => row.terminal_state === "completed").length,
    passed_count: rows.filter((row) => row.control_passed).length, verified_cell_count: verifiedCells };
  if (!value.controls_summary || Object.entries(expected).some(([key, count]) => value.controls_summary?.[key as keyof typeof expected] !== count)
    || (value.counts && value.counts.completed_diagnostic_control_rollout_count !== expected.completed_count)) blockers.push("controls_counts_mismatch");
  const verified = expected.recorded_count === 20 && expected.passed_count === 20 && verifiedCells === 10
    && value.controls_gate?.status === "passed" && value.controls_gate.required_control_episode_count === 20
    && value.controls_gate.candidate_policies_loaded_during_controls === false;
  if (status !== (verified ? "controls_verified_development_only" : "controls_failed")) blockers.push("controls_status_mismatch");
  if (!verified && value.result_status === "completed_unqualified") blockers.push("required_controls_unverified");
  return [...new Set(blockers)];
}
