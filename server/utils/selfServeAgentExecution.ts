/**
 * The payment setup record, made without a person.
 *
 * A robot team can pay for a run only when `discoverAgentExecutionAdmission`
 * finds exactly one prepared Task Evaluation Run request that binds the team,
 * its checkpoint, the site's capture and testbed, the task and scenario, the
 * episode count and the price. That record used to be built by hand for every
 * team, robot and site. This builds it from facts the system already holds:
 *
 * - **Who pays:** the verified Blueprint account bound to the team
 *   (`robotTeamAccounts`). No account, no record.
 * - **What runs:** the team's checkpoint, as registered. A model artifact is
 *   never admitted, so it is never prepared.
 * - **Where it runs:** a runnable site whose owner consented to robot
 *   evaluation, the Pipeline's published testbed for its scene, and the
 *   Pipeline's own execution offer (capture root, the one scenario it runs,
 *   and its episode count), which the executor re-checks before it claims.
 * - **At what price:** the standing self-serve offer, quoted by the plan.
 *
 * It then goes through `submitTaskEvaluationRunRequest`, the same validation,
 * normalization, beta-cohort gate, entitlement verification and persistence a
 * person's request goes through. Nothing here constructs a missing fact: any
 * gap is returned as a blocker and the plan stays unpayable.
 *
 * Preparing a record authorizes nothing by itself. Money moves only when the
 * team confirms a signed plan, and the Pipeline runs only runs that hold money.
 */

import { createHash } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { submitTaskEvaluationRunRequest } from "../routes/robot-eval-job-requests";
import { ROBOT_TEAMS_COLLECTION, type RobotTeamRecord } from "../types/robot-team-registry";
import { sceneExecutionFacts } from "./agentExecutionAdmission";
import { teamAccountUid } from "./robotTeamAccounts";
import { isRunnableTask } from "./teamEvalCandidates";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { InboundRequest } from "../types/inbound-request";

export const SELF_SERVE_ENTITLEMENT_SKU = "self-serve-agent-execution";

/** What the Pipeline publishes once a website scene's episode specs exist. */
export interface AgentExecutionOffer {
  schema_version: "blueprint.agent_execution_offer.v1";
  scene_id: string;
  capture_id: string;
  capture_root: string;
  scenario_id: string;
  episode_count: number;
  episode_specs_sha256: string;
}

export type SelfServePreparation =
  | { prepared: true; requestId: string; created: boolean }
  | { prepared: false; blockers: string[] };

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(prefix: string, parts: unknown): string {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32)}`;
}

/** The offer, if the Pipeline published a complete one for this capture. */
export function agentExecutionOfferFrom(record: unknown, captureId: string): AgentExecutionOffer | null {
  const offer = object(object(record).agent_execution_offer);
  if (
    offer.schema_version !== "blueprint.agent_execution_offer.v1"
    || text(offer.capture_id) !== captureId
    || !text(offer.capture_root).startsWith("/")
    || !text(offer.scenario_id)
    || !Number.isInteger(offer.episode_count)
    || offer.episode_count <= 0
  ) return null;
  return offer as AgentExecutionOffer;
}

function policyPackageFor(checkpoint: Record<string, any>): Record<string, unknown> | null {
  const reference = text(checkpoint.reference);
  if (!reference) return null;
  if (checkpoint.runtime === "policy_endpoint") return { policy_api_endpoint: { endpoint_url: reference } };
  if (checkpoint.runtime === "container_image") return { docker_container: { image_ref: reference } };
  // A model artifact is never admitted for agent execution, so it is never prepared.
  return null;
}

/**
 * Make sure the prepared record for this exact team, checkpoint, scene and
 * quote exists. Idempotent: the ids are derived from every bound fact, so a
 * repeated plan reuses the record and a changed fact makes a new one.
 */
export async function ensureSelfServeAgentExecution(params: {
  teamId: string;
  checkpointId: string;
  sceneId: string;
  quotedEpisodes: number;
  quotedUsd: number;
}): Promise<SelfServePreparation> {
  if (!db) return { prepared: false, blockers: ["agent_execution_store_unavailable"] };

  const accountUid = await teamAccountUid(params.teamId);
  if (!accountUid) return { prepared: false, blockers: ["team_account_required"] };

  const [teamSnapshot, checkpointSnapshot, sceneSnapshot] = await Promise.all([
    db.collection(ROBOT_TEAMS_COLLECTION).doc(params.teamId).get(),
    db.collection("robotCheckpoints").doc(params.checkpointId).get(),
    db.collection("inboundRequests").doc(params.sceneId).get(),
  ]);
  const team = teamSnapshot.data() as RobotTeamRecord | undefined;
  const checkpoint = object(checkpointSnapshot.data());
  const scene = object(sceneSnapshot.data());

  const blockers: string[] = [];
  if (!team) blockers.push("team_missing");
  if (!checkpointSnapshot.exists || checkpoint.teamId !== params.teamId) {
    blockers.push("agent_execution_checkpoint_team_mismatch");
  }
  const policyPackage = policyPackageFor(checkpoint);
  if (!policyPackage) blockers.push("agent_execution_checkpoint_runtime_not_admissible");
  if (!sceneSnapshot.exists || !isRunnableTask(scene as InboundRequest)) {
    blockers.push("scene_not_runnable");
  }
  const rights = projectWebsiteCaptureRights(scene);
  if (!rights.consent_scope.includes("robot_evaluation")) blockers.push("site_rights_not_cleared");
  if (text(object(scene.pipeline).rights_review_status) === "blocked") blockers.push("site_rights_not_cleared");
  if (blockers.length) return { prepared: false, blockers: [...new Set(blockers)] };

  const facts = await sceneExecutionFacts(scene);
  if (!facts.ok) return { prepared: false, blockers: facts.blockers };
  const offer = agentExecutionOfferFrom(scene, facts.captureId);
  if (!offer) return { prepared: false, blockers: ["pipeline_execution_offer_missing"] };
  if (offer.episode_count !== params.quotedEpisodes) {
    return { prepared: false, blockers: ["pipeline_execution_offer_episode_mismatch"] };
  }

  const bound = {
    teamId: params.teamId,
    accountUid,
    checkpointId: params.checkpointId,
    runtime: checkpoint.runtime,
    reference: text(checkpoint.reference),
    sceneId: params.sceneId,
    siteId: facts.siteId,
    captureId: facts.captureId,
    captureDigest: facts.captureDigest,
    testbedDigest: facts.testbedDigest,
    taskId: facts.taskId,
    scenarioId: offer.scenario_id,
    captureRoot: offer.capture_root,
    episodes: params.quotedEpisodes,
    usd: params.quotedUsd,
  };
  const requestId = stableId("selfserve", bound);
  const decisionId = stableId("selfserve-decision", bound);
  const entitlementId = stableId("selfserve-ent", bound);

  const existing = await db.collection("robotEvalJobRequests").doc(requestId).get();
  if (existing.exists && existing.data()?.status === "prepared_agent_execution") {
    return { prepared: true, requestId, created: false };
  }

  // The standing self-serve offer, as an entitlement bound to this buyer, team
  // and site. It grants nothing on its own: a run still needs a confirmed,
  // funded hold. The sku keeps it out of the one-run consumption path.
  const nowIso = new Date().toISOString();
  await db.collection("marketplaceEntitlements").doc(entitlementId).set({
    buyer_user_id: accountUid,
    access_state: "provisioned",
    sku: SELF_SERVE_ENTITLEMENT_SKU,
    team_id: params.teamId,
    robot_team_id: params.teamId,
    site_id: facts.siteId,
    scene_id: params.sceneId,
    capture_id: facts.captureId,
    checkpoint_id: params.checkpointId,
    episodes: params.quotedEpisodes,
    max_cost_usd: params.quotedUsd,
    source: "blueprint_self_serve_offer",
    created_at_iso: nowIso,
  }, { merge: true });

  const canonical = {
    schema_version: "robot_eval_job_request.v1",
    execution_mode: "prepared_agent_execution",
    job_id: requestId,
    buyer_request_id: decisionId,
    idempotency_key: requestId,
    decision_question: "How does this checkpoint perform on the approved task in this site's simulated scene?",
    task_description: facts.taskId,
    site_task_conditions: ["Simulated scene reconstructed from the site's own capture"],
    customer: { id: params.teamId, name: team!.name },
    site_package: {
      site_id: facts.siteId,
      site_slug: facts.siteId,
      capture_id: facts.captureId,
      capture_root: offer.capture_root,
      testbed_id: facts.testbedId || facts.siteId,
      testbed_version: facts.testbedVersion || "1",
      testbed_digest_sha256: facts.testbedDigest,
    },
    capture_root: offer.capture_root,
    requested_tasks: [{ task_id: facts.taskId, scenario_ids: [offer.scenario_id] }],
    robot_profile: { robot_profile_id: params.checkpointId },
    policy_package: policyPackage,
    entitlement: { entitlement_id: entitlementId },
    rights_privacy_scope: { external_use_allowed: true },
    execution_authorization: {
      authorized_by_user_id: accountUid,
      principal_team_id: params.teamId,
      task_id: facts.taskId,
      scenario_id: offer.scenario_id,
      episodes: params.quotedEpisodes,
      max_cost_usd: params.quotedUsd,
      rights_cleared: true,
      one_time_purchase: true,
    },
    claims: [{
      claim_id: "screening_outcome",
      statement: "Observed episodes of this checkpoint on the approved task in the simulated scene.",
      threshold_ids: [],
    }],
    thresholds: [],
    constraints: {
      budget: { amount: params.quotedUsd, currency: "USD", hard_cap: true },
      available_physical_evidence: [{
        artifact_id: facts.captureId,
        kind: "capture",
        uri: offer.capture_root,
        version: facts.testbedVersion || "1",
        digest_sha256: facts.captureDigest,
        evidence_class: "real_observation",
      }],
    },
    source: { selection_state: { policy_id: params.checkpointId, task_id: facts.taskId } },
  };

  const result = await submitTaskEvaluationRunRequest({
    submitted: canonical,
    firebaseUser: { uid: accountUid },
    sourceRoute: "/api/agent-team/plan",
  });
  const status = text(result.body.status);
  if ((result.status === 202 || result.status === 200) && (status === "prepared_agent_execution" || result.body.already_exists)) {
    return { prepared: true, requestId, created: result.status === 202 };
  }
  logger.warn(
    { teamId: params.teamId, sceneId: params.sceneId, status: result.status, code: result.body.code, blockers: result.body.blockers },
    "Self-serve agent execution could not be prepared",
  );
  const refusal = Array.isArray(result.body.blockers) ? result.body.blockers.map(String) : [];
  return { prepared: false, blockers: refusal.length ? refusal : [text(result.body.code) || "agent_execution_preparation_refused"] };
}
