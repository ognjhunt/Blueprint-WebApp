import { createHash } from "node:crypto";

import { z } from "zod";

import { crossRuntimeDigest, matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const label = z.string().trim().min(1).max(256);
const artifact = z.object({
  relative_path: z.string().min(1).refine((value) =>
    !value.startsWith("/") && !value.includes("\\")
      && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
  ),
  sha256: digest,
  size_bytes: z.number().int().positive().safe(),
}).strict();

const candidateIds = [
  "humanoidarena_dp_g1_dex3_sonic",
  "humanoidarena_pi05_g1_dex3_sonic",
  "humanoidarena_dp_g1_dex3_sonic_vision_navi",
  "humanoidarena_pi05_g1_dex3_sonic_vision_navi",
] as const;

const builtinG1PrivateReviewSchema = z.object({
  schema_version: z.literal("native_g1_private_review.v1"),
  status: z.literal("verified_private_development_review"),
  claim_ceiling: z.literal("development_only"),
  scene_id: label,
  task_id: label,
  embodiment_id: z.literal("unitree_g1_dex3_v1"),
  runtime_delivery_mode: z.literal("container"),
  container_image: z.string().min(1),
  campaign_plan_digest: digest,
  provider_bundle_sha256: digest,
  terminal_result_digest: digest,
  episodes: z.array(z.object({
    candidate_id: z.enum(candidateIds),
    objective_id: z.enum(["task_success", "g1_navigation_goal"]),
    policy_query_count: z.number().int().positive().safe(),
    score: z.object({
      score_digest: digest,
      episode_result_digest: digest,
      outcome: z.string().min(1),
    }).passthrough(),
    frame_manifest: artifact,
    review_videos: z.object({ head: artifact, overview: artifact }).strict(),
  }).strict()).length(4),
  public_redistribution_authorized: z.literal(false),
  physical_outcome_claimed: z.literal(false),
  simulator_result_is_physical_proof: z.literal(false),
  review_digest: digest,
}).strict();

const selectedG1PrivateReviewSchema = z.object({
  schema_version: z.literal("native_g1_team_private_review.v1"),
  status: z.literal("verified_private_development_review"),
  claim_ceiling: z.literal("development_only"),
  intent_id: z.string().regex(/^g1-team-policy-[0-9a-f]{64}$/),
  run_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  owner_user_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  organization_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  scene_id: label,
  task_id: label,
  embodiment_id: z.literal("unitree_g1_dex3_v1"),
  runtime_delivery_mode: z.literal("container"),
  container_image: label,
  policy_delivery_mode: z.enum(["authenticated_endpoint", "container", "noncontainer_artifact"]),
  execution_packet_digest: digest,
  policy_profile_digest: digest,
  provider_bundle_sha256: digest,
  worker_result_digest: digest,
  episodes: z.array(z.object({
    candidate_id: z.string().regex(/^team_policy_[0-9a-f]{64}$/),
    objective_id: z.enum(["task_success", "g1_navigation_goal"]),
    policy_query_count: z.number().int().positive().safe(),
    score: z.object({ status: z.literal("scored"), score_digest: digest,
      episode_result_digest: digest, outcome: z.string().min(1) }).passthrough(),
    frame_manifest: artifact,
    review_videos: z.object({ head: artifact, overview: artifact }).strict(),
  }).strict()).length(1),
  public_redistribution_authorized: z.literal(false),
  physical_outcome_claimed: z.literal(false),
  simulator_result_is_physical_proof: z.literal(false),
  review_digest: digest,
}).strict();

export const nativeG1PrivateReviewSchema = z.discriminatedUnion("schema_version", [
  builtinG1PrivateReviewSchema, selectedG1PrivateReviewSchema,
]);

export type NativeG1PrivateReview = z.infer<typeof nativeG1PrivateReviewSchema>;
export type NativeG1ReviewArtifact = z.infer<typeof artifact> & {
  artifact_id: string;
  role: "g1_frame_manifest" | "g1_head_video" | "g1_overview_video";
};

export function parseNativeG1PrivateReview(value: unknown): NativeG1PrivateReview | null {
  const parsed = nativeG1PrivateReviewSchema.safeParse(value);
  if (!parsed.success) return null;
  const review = parsed.data;
  if (!matchesCrossRuntimeArtifactDigest(review, "review_digest")) return null;
  if (review.schema_version === "native_g1_team_private_review.v1") {
    const expectedIntent = `g1-team-policy-${crossRuntimeDigest({
      owner: { user_id: review.owner_user_id, organization_id: review.organization_id }, run_id: review.run_id,
    }).slice(7)}`;
    if (review.intent_id !== expectedIntent) return null;
    const episode = review.episodes[0];
    if (episode.candidate_id !== `team_policy_${review.policy_profile_digest.slice(7)}`
      || !matchesCrossRuntimeArtifactDigest(episode.score, "score_digest")
      || [episode.frame_manifest, ...Object.values(episode.review_videos)].some((row) =>
        !row.relative_path.startsWith("selected-worker/worker/"),
      )) return null;
  } else if (review.episodes.some((episode, index) =>
    episode.candidate_id !== candidateIds[index]
      || episode.objective_id !== (index < 2 ? "task_success" : "g1_navigation_goal")
      || !episode.frame_manifest.relative_path.startsWith(index < 2 ? "manipulation_pair/" : "movement_pair/")
      || Object.values(episode.review_videos).some((video) =>
        !video.relative_path.startsWith(index < 2 ? "manipulation_pair/" : "movement_pair/"),
      ),
  )) return null;
  const artifacts = nativeG1ReviewArtifacts(review);
  if (new Set(artifacts.map((row) => row.artifact_id)).size !== artifacts.length) return null;
  if (new Set(artifacts.map((row) => row.relative_path)).size !== artifacts.length) return null;
  return review;
}

export function nativeG1ReviewArtifacts(review: NativeG1PrivateReview): NativeG1ReviewArtifact[] {
  return review.episodes.flatMap((episode) => (
    [
      ["g1_frame_manifest", episode.frame_manifest],
      ["g1_head_video", episode.review_videos.head],
      ["g1_overview_video", episode.review_videos.overview],
    ] as const
  ).map(([role, row]) => ({
    ...row,
    role,
    artifact_id: createHash("sha256")
      .update(`${role}\0${row.relative_path}\0${row.sha256}`)
      .digest("hex").slice(0, 32),
  })));
}
