/** A team-owned policy interface and delivery reference, before runtime admission. */
import { isIP } from "node:net";
import { z } from "zod";

import { crossRuntimeDigest } from "./crossRuntimeCanonical";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const schemaId = z.string().trim().min(1).max(160);
const endpoint = z.string().url().max(2048).superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search
    || (url.port && url.port !== "443") || isIP(url.hostname.replace(/^\[|\]$/g, ""))
    || url.hostname === "localhost" || url.hostname.endsWith(".localhost")
    || url.hostname.endsWith(".internal") || url.hostname.endsWith(".local")
    || !url.hostname.includes(".")) {
    context.addIssue({ code: "custom", message: "A public HTTPS endpoint without URL credentials is required" });
  }
});

export const teamPolicyDeliverySubmissionSchema = z.object({
  setup_digest: digest,
  robot_preset_id: identifier,
  label: z.string().trim().min(1).max(120),
  delivery: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("authenticated_endpoint"),
      endpoint_url: endpoint,
      auth_secret_ref: z.string().regex(/^secretref:[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/),
      timeout_ms: z.number().int().min(100).max(30_000),
    }).strict(),
    z.object({
      mode: z.literal("container"),
      image_ref: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,400}@sha256:[0-9a-f]{64}$/),
      protocol: z.literal("jsonl_observation_action_v1"),
    }).strict(),
    z.object({
      mode: z.literal("noncontainer_artifact"),
      artifact_uri: endpoint,
      artifact_sha256: digest,
      entrypoint: z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_./-]{0,190}$/)
        .refine((value) => !value.split("/").includes("..") && !value.startsWith("/")),
      protocol: z.literal("jsonl_observation_action_v1"),
    }).strict(),
  ]),
}).strict();

export type TeamPolicyDeliverySubmission = z.infer<typeof teamPolicyDeliverySubmissionSchema>;

type Setup = {
  setup_digest: string;
  scene_id: string;
  task_id: string;
  robot_presets: Array<{
    robot_preset_id: string;
    embodiment_id?: string;
    observation_schema?: { schema_id?: string };
    action_schema?: { schema_id?: string };
  }>;
};

export function makeTeamPolicyDeliveryProfile(
  raw: unknown,
  setup: Setup,
  owner: { user_id: string; organization_id: string },
) {
  const submission = teamPolicyDeliverySubmissionSchema.parse(raw);
  const robot = setup.robot_presets.find((row) => row.robot_preset_id === submission.robot_preset_id);
  if (submission.setup_digest !== setup.setup_digest || !robot
    || !schemaId.safeParse(robot.embodiment_id).success
    || !schemaId.safeParse(robot.observation_schema?.schema_id).success
    || !schemaId.safeParse(robot.action_schema?.schema_id).success) {
    throw new Error("team_policy_delivery_setup_mismatch");
  }
  const profile = {
    schema_version: "team_policy_delivery_profile.v1" as const,
    owner,
    label: submission.label,
    source_setup_digest: setup.setup_digest,
    source_scene_id: setup.scene_id,
    source_task_id: setup.task_id,
    robot_preset_id: robot.robot_preset_id,
    embodiment_id: robot.embodiment_id!,
    observation_schema_id: robot.observation_schema!.schema_id!,
    action_schema_id: robot.action_schema!.schema_id!,
    delivery: submission.delivery,
    status: "registered_for_runtime_review" as const,
    claim_ceiling: "planning_only" as const,
    provider_mutation_performed: false as const,
    public_redistribution_authorized: false as const,
  };
  return { ...profile, profile_digest: crossRuntimeDigest(profile) };
}
