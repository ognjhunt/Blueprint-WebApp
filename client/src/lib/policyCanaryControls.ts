export const controlsStatuses = ["configured_controls_pending", "controls_failed", "controls_verified_development_only"] as const;
export type ControlsStatus = typeof controlsStatuses[number];
export const controlsWarnings: Record<ControlsStatus, string> = {
  configured_controls_pending: "Controls pending — results are unqualified.",
  controls_failed: "Required controls failed — results are unqualified.",
  controls_verified_development_only: "Controls verified for this simulation matrix — development-only results remain unqualified.",
};
export type ControlArtifact = { artifact_id: string; digest: string; size_bytes: number };
export type PolicyCanaryControl = {
  episode_id: string; cell_id: string; seed: number;
  control_id: "zero_action_negative" | "deterministic_scripted_positive";
  terminal_state: "completed" | "blocked"; control_passed: boolean; receipt_digest: string;
  receipt: ControlArtifact; cell_receipt: ControlArtifact; videos: Record<string, ControlArtifact>;
  artifacts: Array<ControlArtifact & { role: string }>;
  score: { status?: string; task_succeeded?: boolean | null; outcome?: string | null;
    failed_criteria?: unknown[]; measurements?: Record<string, unknown>; blockers?: unknown[] };
  evidence_gaps: string[];
};
export type ControlsSummary = { expected_count: number; recorded_count: number; completed_count: number; passed_count: number; verified_cell_count: number };
export function controlsVerified(value: { scene_controls_status?: string; controls?: PolicyCanaryControl[]; controls_summary?: ControlsSummary }) {
  return value.scene_controls_status === "controls_verified_development_only"
    && value.controls?.length === 20 && value.controls_summary?.verified_cell_count === 10
    && value.controls.every((row) => row.control_passed && row.terminal_state === "completed" && !row.evidence_gaps.length
      && ["external", "wrist", "overview"].every((camera) => row.videos[camera])
      && ["control_cell_archive", "frame_manifest", "state_trace", "action_trace"].every((role) => row.artifacts.some((artifact) => artifact.role === role)));
}
