/** Signed, owner-scoped forwarding for one G1 development task packet. */
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { sceneOwner } from "./taskEvaluationSceneIntake";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const ownerSchema = z.object({ user_id: identifier, organization_id: z.string().min(1) }).strict();
const policy = z.object({
  candidate_id: identifier,
  evaluation_objective_id: z.enum(["task_success", "g1_navigation_goal"]),
}).passthrough();
const robot = z.object({ robot_preset_id: identifier, policy_candidates: z.array(policy).length(4) }).passthrough();
const setupSchema = z.object({
  schema_version: z.literal("task_evaluation_packet_planning_setup.v1"),
  claim_ceiling: z.literal("planning_only"),
  scene_id: z.string().min(1),
  task_id: z.string().min(1),
  source_packet_receipt_digest: digest,
  setup_digest: digest,
  robot_presets: z.array(robot).length(1),
}).passthrough();
export const g1CatalogSchema = z.object({
  schema_version: z.literal("native_g1_team_campaign_setup_catalog.v1"),
  owner: ownerSchema,
  setups: z.array(setupSchema).max(100),
  claim_ceiling: z.literal("planning_only"),
  provider_mutation_performed: z.literal(false),
  catalog_digest: digest,
}).strict();
const choiceSchema = z.object({
  schema_version: z.literal("task_evaluation_packet_policy_pair_choice.v1"),
  claim_ceiling: z.literal("planning_only"),
  setup_digest: digest,
  source_packet_receipt_digest: digest,
  robot_preset_id: identifier,
  policy_candidate_ids: z.tuple([identifier, identifier]),
  objective_id: z.enum(["task_success", "g1_navigation_goal"]),
  choice_digest: digest,
}).strict();
const handoffSchema = z.object({
  schema_version: z.literal("task_evaluation_packet_policy_handoff.v1"),
  claim_ceiling: z.literal("planning_only"),
  setup: setupSchema,
  choice: choiceSchema,
  handoff_digest: digest,
}).strict();
export const g1SubmissionSchema = z.object({
  run_id: identifier,
  setup_digest: digest,
  book_handoff: handoffSchema,
  movement_handoff: handoffSchema,
  authorization_expires_at_epoch: z.number().finite().positive(),
  authorize_maximum_cost_usd_12: z.literal(true),
  maximum_cost_usd: z.number().finite().min(1).max(12)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
    .default(12),
}).strict();
const receiptSchema = z.object({
  schema_version: z.literal("native_g1_team_campaign_intake_receipt.v1"),
  status: z.literal("accepted_not_dispatched"),
  intent_id: identifier,
  intent_digest: digest,
  request_digest: digest,
  provider_mutation_performed_inside_http_request: z.literal(false),
  receipt_digest: digest,
}).strict();

type Owner = ReturnType<typeof sceneOwner>;

async function signedPipelinePost(path: string, value: unknown) {
  const configured = process.env.TASK_EVALUATION_LAUNCH_URL || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token = process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token) throw new Error("g1_pipeline_forwarding_not_configured");
  const url = new URL(configured);
  url.pathname = `/api/live-pipeline/${path}`;
  url.search = "";
  url.hash = "";
  const body = JSON.stringify(value);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const client = "blueprint-webapp";
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${client}.${nonce}.${body}`).digest("hex");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": client,
      "x-blueprint-pipeline-nonce": nonce,
      "x-blueprint-pipeline-signature": `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`g1_pipeline_${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function fetchG1TeamCatalog(owner: Owner) {
  const catalog = g1CatalogSchema.parse(await signedPipelinePost(
    "native-g1-team-campaign-setups", { owner },
  ));
  if (crossRuntimeArtifactDigest(catalog, "catalog_digest") !== catalog.catalog_digest
    || crossRuntimeDigest(catalog.owner) !== crossRuntimeDigest(owner)
    || catalog.setups.some((setup) =>
      crossRuntimeArtifactDigest(setup, "setup_digest") !== setup.setup_digest)) {
    throw new Error("g1_catalog_binding_invalid");
  }
  return catalog;
}

function boundHandoff(
  raw: z.infer<typeof handoffSchema>,
  setup: z.infer<typeof setupSchema>,
  objective: "task_success" | "g1_navigation_goal",
) {
  if (crossRuntimeArtifactDigest(raw, "handoff_digest") !== raw.handoff_digest
    || crossRuntimeArtifactDigest(raw.choice, "choice_digest") !== raw.choice.choice_digest
    || crossRuntimeDigest(raw.setup) !== crossRuntimeDigest(setup)
    || raw.choice.setup_digest !== setup.setup_digest
    || raw.choice.source_packet_receipt_digest !== setup.source_packet_receipt_digest
    || raw.choice.robot_preset_id !== setup.robot_presets[0].robot_preset_id
    || raw.choice.objective_id !== objective) throw new Error("g1_handoff_binding_invalid");
  const expected = setup.robot_presets[0].policy_candidates
    .filter((candidate) => candidate.evaluation_objective_id === objective)
    .map((candidate) => candidate.candidate_id);
  if (expected.length !== 2 || crossRuntimeDigest(raw.choice.policy_candidate_ids) !== crossRuntimeDigest(expected)) {
    throw new Error("g1_handoff_candidate_set_invalid");
  }
}

export async function submitG1TeamCampaign(raw: unknown, owner: Owner) {
  const input = g1SubmissionSchema.parse(raw);
  const catalog = await fetchG1TeamCatalog(owner);
  const matches = catalog.setups.filter((setup) => setup.setup_digest === input.setup_digest);
  if (matches.length !== 1) throw new Error("g1_setup_unavailable");
  const setup = matches[0];
  boundHandoff(input.book_handoff, setup, "task_success");
  boundHandoff(input.movement_handoff, setup, "g1_navigation_goal");
  const now = Date.now() / 1000;
  if (input.authorization_expires_at_epoch <= now
    || input.authorization_expires_at_epoch > now + 3600) {
    throw new Error("g1_authorization_expiry_invalid");
  }
  const request = {
    schema_version: "native_g1_team_campaign_request.v1",
    run_id: input.run_id,
    owner,
    scene_id: setup.scene_id,
    task_id: setup.task_id,
    source_packet_receipt_digest: setup.source_packet_receipt_digest,
    robot_preset_id: setup.robot_presets[0].robot_preset_id,
    book_handoff: input.book_handoff,
    movement_handoff: input.movement_handoff,
    authorization: {
      maximum_cost_usd: input.maximum_cost_usd,
      hard_ttl_seconds: 14_400,
      expires_at_epoch: input.authorization_expires_at_epoch,
      retry_cap: 0,
    },
    claim_ceiling: "development_only",
    public_redistribution_authorized: false,
  };
  const sealed = { ...request, request_digest: crossRuntimeDigest(request) };
  const receipt = receiptSchema.parse(await signedPipelinePost("native-g1-team-campaigns", sealed));
  if (crossRuntimeArtifactDigest(receipt, "receipt_digest") !== receipt.receipt_digest
    || receipt.request_digest !== sealed.request_digest) throw new Error("g1_intake_receipt_invalid");
  return receipt;
}
