/**
 * The four-conditions screen stopped gating the simulation (owner decision
 * 2026-11-11: "yes drop the four conditions screen as a gate").
 *
 * A job gets its scene grant whatever the screen's disposition, which stays on
 * the record as a note for staff. Server-written only, never from a request
 * body, and never part of a grant, policy or context digest. It is stamped:
 * - when a job is created (`marked_on: "job_created"`), in the job's first
 *   write, so a new job is never held, hidden or mislabelled by the screen,
 *   from intake qualification onwards;
 * - for a job created before the change, when its original video is first
 *   published after it (`marked_on: "video_published"`).
 * A job already published before the change never gets it, so a job held by
 * the old refusal does not start a paid build by itself; the owner decides
 * those separately. Jobs created before the change and not yet filmed stay as
 * they were until their video arrives.
 */
export const SCENE_SCREEN_GATE_ENDED_FIELD = "scene_screen_gate_ended";
export const SCENE_SCREEN_GATE_ENDED_SCHEMA = "scene_screen_gate_ended.v1";

export type SceneScreenGateEnded = {
  schema_version: typeof SCENE_SCREEN_GATE_ENDED_SCHEMA;
  decision: "owner_2026_11_11";
  capture_id: string;
  marked_on?: "job_created" | "video_published";
  /** When the job was created, for `job_created`. */
  created_at_iso?: string;
  /** When the original video was first published, for `video_published`. */
  published_at_iso?: string;
};

export function sceneScreenGateEndedMarker(requestId: string, atIso: string,
  markedOn: "job_created" | "video_published" = "video_published"): SceneScreenGateEnded {
  return { schema_version: SCENE_SCREEN_GATE_ENDED_SCHEMA, decision: "owner_2026_11_11",
    capture_id: `walkthrough-${requestId}`, marked_on: markedOn,
    ...(markedOn === "job_created" ? { created_at_iso: atIso } : { published_at_iso: atIso }) };
}

/** True when this job's video arrived after the screen stopped gating. */
export function sceneScreenGateEnded(record: Record<string, any> | undefined | null, requestId: string): boolean {
  const marker = record?.[SCENE_SCREEN_GATE_ENDED_FIELD];
  return Boolean(marker && marker.schema_version === SCENE_SCREEN_GATE_ENDED_SCHEMA
    && marker.decision === "owner_2026_11_11" && marker.capture_id === `walkthrough-${requestId}`
    && [marker.published_at_iso, marker.created_at_iso].some(at => typeof at === "string" && Number.isFinite(Date.parse(at))));
}
