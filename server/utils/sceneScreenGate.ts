/**
 * The four-conditions screen stopped gating the simulation (owner decision
 * 2026-11-11: "yes drop the four conditions screen as a gate").
 *
 * A job gets its scene grant whatever the screen's disposition, which stays on
 * the record as a note for staff. The change applies to jobs whose video is
 * uploaded after it is deployed: the first publication of a job's original
 * walkthrough stamps this marker on the request, in the same commit. A job
 * already published before the change never gets it, so a job held by the old
 * refusal does not start a paid build by itself; the owner decides those
 * separately.
 */
export const SCENE_SCREEN_GATE_ENDED_FIELD = "scene_screen_gate_ended";
export const SCENE_SCREEN_GATE_ENDED_SCHEMA = "scene_screen_gate_ended.v1";

export type SceneScreenGateEnded = {
  schema_version: typeof SCENE_SCREEN_GATE_ENDED_SCHEMA;
  decision: "owner_2026_11_11";
  capture_id: string;
  published_at_iso: string;
};

export function sceneScreenGateEndedMarker(requestId: string, publishedAtIso: string): SceneScreenGateEnded {
  return { schema_version: SCENE_SCREEN_GATE_ENDED_SCHEMA, decision: "owner_2026_11_11",
    capture_id: `walkthrough-${requestId}`, published_at_iso: publishedAtIso };
}

/** True when this job's video arrived after the screen stopped gating. */
export function sceneScreenGateEnded(record: Record<string, any> | undefined | null, requestId: string): boolean {
  const marker = record?.[SCENE_SCREEN_GATE_ENDED_FIELD];
  return Boolean(marker && marker.schema_version === SCENE_SCREEN_GATE_ENDED_SCHEMA
    && marker.decision === "owner_2026_11_11" && marker.capture_id === `walkthrough-${requestId}`
    && typeof marker.published_at_iso === "string" && Number.isFinite(Date.parse(marker.published_at_iso)));
}
