/** ADP-009D/day-21: a saved team setup selects a separately authorized evaluation. */
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { sceneDigest, sceneIntakeCommand, sceneOwner } from "./taskEvaluationSceneIntake";
import type { RobotSetup } from "../../client/src/types/workspace";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const ownerSchema = z.object({ user_id:z.string(), organization_id:z.string() }).strict();
const configurationSchema = z.object({id, label:z.string(), binding_digest:digest,
  policy_candidates:z.array(z.object({id, artifact_digest:digest}).strict()).length(2)}).strict();
export const teamContextSchema = z.object({schema_version:z.literal("task_evaluation_team_context.v1"),
  owner:ownerSchema, source_launch_id:id, source_profile_digest:digest, configured_scene_revision_digest:digest,
  source:z.record(z.unknown()), task:z.record(z.unknown()), rights_reference:z.string(),
  configurations:z.array(configurationSchema), claim_scope:z.literal("development_only"),
  provider_mutation_performed:z.literal(false), context_digest:digest}).strict();
export const teamEvaluationCommand = z.object({id, setupId:id, sourceLaunchId:id,
  configurationId:id, configurationDigest:digest, sourceProfileDigest:digest, sceneRevisionDigest:digest,
  execution:sceneIntakeCommand.shape.execution.refine(v=>!v.purpose, "Choose evaluation policies"),
  consent:sceneIntakeCommand.shape.consent}).strict();
export type TeamEvaluationContext = z.infer<typeof teamContextSchema>;

export async function loadRobotSetups(uid:string):Promise<RobotSetup[]> {
  if (!db) throw new Error("intake_store_unavailable");
  const snapshot=await db.collection("users").doc(uid).collection("robotSetups").limit(50).get();
  return Promise.all(snapshot.docs.map(async doc=>{
    try {
      return {...JSON.parse(await decryptFieldValue(doc.data().payload)),id:doc.id};
    } catch {
      throw new Error("saved_setup_unreadable");
    }
  }));
}

export async function fetchTeamEvaluationContext(sourceLaunchId:string, owner:ReturnType<typeof sceneOwner>) {
  id.parse(sourceLaunchId);
  const configured=process.env.TASK_EVALUATION_LAUNCH_URL || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token=process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token) throw new Error("pipeline_forwarding_not_configured");
  const url=new URL(configured);
  url.pathname="/api/live-pipeline/task-evaluation-team-context"; url.search=""; url.hash="";
  const body=JSON.stringify({source_launch_id:sourceLaunchId,owner});
  const timestamp=new Date().toISOString(), nonce=randomUUID(), client="blueprint-webapp";
  const signature=createHmac("sha256",token).update(`${timestamp}.${client}.${nonce}.${body}`).digest("hex");
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",
    "x-blueprint-pipeline-timestamp":timestamp,"x-blueprint-pipeline-client-id":client,
    "x-blueprint-pipeline-nonce":nonce,"x-blueprint-pipeline-signature":`sha256=${signature}`},
    body,signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error("evaluation_context_unavailable");
  const result=teamContextSchema.parse(await response.json());
  const {context_digest,...content}=result;
  if (sceneDigest(content)!==context_digest || sceneDigest(result.owner)!==sceneDigest(owner)
      || result.source_launch_id!==sourceLaunchId) throw new Error("evaluation_context_binding_invalid");
  return result;
}

export function buildTeamEvaluationRequest(raw:unknown, context:TeamEvaluationContext,
  setup:RobotSetup, owner:ReturnType<typeof sceneOwner>, acceptedAt=Date.now()/1000) {
  const command=teamEvaluationCommand.parse(raw);
  const configuration=context.configurations.find(c=>c.id===command.configurationId);
  const robot=setup.robotDescription;
  if (robot?.source==="model") throw new Error("robot_model_validation_required");
  if (robot?.source==="catalog" && (robot.configurationId!==command.configurationId
      || robot.configurationDigest!==configuration?.binding_digest))
    throw new Error("robot_configuration_changed");
  if (setup.id!==command.setupId || setup.executionBindingId!==command.configurationId)
    throw new Error("saved_execution_setup_required");
  if (!configuration || configuration.binding_digest!==command.configurationDigest
      || context.source_profile_digest!==command.sourceProfileDigest
      || context.configured_scene_revision_digest!==command.sceneRevisionDigest
      || context.source_launch_id!==command.sourceLaunchId || sceneDigest(context.owner)!==sceneDigest(owner))
    throw new Error("evaluation_selection_changed");
  if (sceneDigest(configuration.policy_candidates)!==sceneDigest(command.execution.policy_candidates))
    throw new Error("evaluation_policy_selection_changed");
  if (command.execution.expires_at_epoch<=acceptedAt || command.execution.expires_at_epoch>acceptedAt+7*86400)
    throw new Error("consent_expiry_invalid");
  return {schema_version:"task_evaluation_scene_intake_request.v1", submission_id:command.id, owner,
    source:context.source, task:{...context.task,robot_binding_id:configuration.id,
      robot_binding_digest:configuration.binding_digest,
      evaluation_source:{evaluation_run_id:command.id,source_launch_id:command.sourceLaunchId,
        source_profile_digest:command.sourceProfileDigest,configured_scene_revision_digest:command.sceneRevisionDigest}},
    execution:command.execution,consent:{...command.consent,rights_reference:context.rights_reference,
      accepted_by:owner.user_id,accepted_at_epoch:acceptedAt}};
}

/** Reopen exact scene and saved setup before the existing outbox grants execution. */
export async function rebuildTeamEvaluation(record:Record<string,any>) {
  const command=teamEvaluationCommand.parse(record.command);
  const context=await fetchTeamEvaluationContext(command.sourceLaunchId,record.request.owner);
  const setup=(await loadRobotSetups(record.request.owner.user_id)).find(s=>s.id===command.setupId);
  if (!setup) throw new Error("saved_execution_setup_required");
  return buildTeamEvaluationRequest(command,context,setup,record.request.owner,record.request.consent.accepted_at_epoch);
}

/** Customer price is fixed; the provider budget is a separate internal limit. */
export const TEAM_EVALUATION_PRICE_CENTS = 9900;
export const TEAM_EVALUATION_PROVIDER_CAP_USD = 20;

export function teamEvaluationTaskDetails(context:TeamEvaluationContext) {
  const task=context.task;
  const object=(value:unknown):Record<string,unknown>=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const label=(value:unknown)=>typeof value === "string" ? value.trim().slice(0,1000) : "";
  const subject=object(task.subject), destination=object(task.destination), success=object(task.success);
  const articulation=object(task.articulation);
  const articulated=task.strategy === "articulated_open_close";
  const objectLabel=label(subject.visible_label) || label(subject.description) || label(subject.name);
  const partLabel=label(articulation.part_label);
  const title=label(task.description) || label(task.title)
    || (task.strategy === "pick_and_place" ? "Pick and place"
      : articulated ? `Open the ${partLabel || "moving part"}` : "Task evaluation");
  const requirements:Array<{label:string;value:string}>=[];
  if (objectLabel) requirements.push({label:articulated ? "Assembly" : "Object",value:objectLabel});
  if (articulated && partLabel) requirements.push({label:"Part to open",value:partLabel});
  if (articulated && label(articulation.joint_type)) requirements.push({label:"Mechanism",
    value:articulation.joint_type === "prismatic" ? "sliding (prismatic joint)" : "hinged (revolute joint)"});
  if (articulated && typeof articulation.estimated_usable_stroke_m === "number" && Number.isFinite(articulation.estimated_usable_stroke_m))
    requirements.push({label:"Estimated usable stroke",value:`${articulation.estimated_usable_stroke_m} m (estimate, not measured)`});
  if (articulated && label(articulation.lock_status)) requirements.push({label:"Lock status",value:label(articulation.lock_status)});
  if (label(destination.visible_label)) requirements.push({label:"Destination",value:label(destination.visible_label)});
  for (const [key,name,unit] of [
    ["maximum_episode_seconds","Time limit","seconds"],
    ["minimum_opening_fraction_of_estimated_stroke","Minimum opening","of usable stroke"],
    ["minimum_hold_seconds","Hold open","seconds"],
    ["minimum_lift_m","Minimum lift","m"],
    ["minimum_planar_displacement_m","Minimum travel","m"],
    ["maximum_final_planar_target_error_m","Placement tolerance","m"],
    ["maximum_retries","Retries",""],
    ["maximum_regrasps","Regrasps",""],
  ]) {
    const value=success[key];
    if (typeof value === "number" && Number.isFinite(value)) requirements.push({label:name,
      value:key === "minimum_opening_fraction_of_estimated_stroke" ? `${Math.round(value * 100)}% ${unit}` : `${value} ${unit}`.trim()});
  }
  return {title,description:label(task.instructions) || objectLabel,requirements};
}
