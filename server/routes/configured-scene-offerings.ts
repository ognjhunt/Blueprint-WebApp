import { Router, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { submitTaskEvaluationLaunchPreparation } from "./admin-task-evaluation-launches";
import { resolveAccessContext } from "../utils/access-control";
import {
  configuredSceneOfferingBinding,
  configuredSceneOfferingSchema,
  preparationMatchesConfiguredSceneOffering,
  type ConfiguredSceneOffering,
} from "../utils/configuredSceneOfferingContract";
import { readConfiguredSceneThumbnail } from "../utils/configuredSceneThumbnail";
import { withTaskEvaluationLaunchStoreTimeout } from "../utils/taskEvaluationLaunchStore";

const router = Router();
const COLLECTION = "taskEvaluationLaunches";
const STORED_OFFERING_STATES = [
  "launch_ready",
  "configured_controls_pending",
  "evaluation_ready",
] as const;

function isStoredOfferingState(value: unknown): value is ConfiguredSceneOffering["status"] {
  return STORED_OFFERING_STATES.includes(value as ConfiguredSceneOffering["status"]);
}

function firebaseTenantId(res: Response) {
  const user = res.locals.firebaseUser as { tenantId?: string; tenant_id?: string } | undefined;
  return String(user?.tenantId || user?.tenant_id || "").trim();
}

async function accessibleOffering(launchId: string, res: Response) {
  if (!db) return null;
  const access = await resolveAccessContext(res);
  if (!access.uid) return null;
  const snapshot = await withTaskEvaluationLaunchStoreTimeout(
    db.collection(COLLECTION).doc(launchId).get(),
  );
  if (!snapshot.exists) return null;
  const record = snapshot.data() as Record<string, unknown>;
  const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
  if (
    !isStoredOfferingState(record.configured_scene_offering_state)
    || !parsed.success
    || parsed.data.status !== record.configured_scene_offering_state
    || parsed.data.offering_digest !== record.configured_scene_offering_digest
  ) return null;
  const tenantId = firebaseTenantId(res);
  if (!access.isOps && (!tenantId || tenantId !== parsed.data.team_namespace)) return null;
  return { offering: parsed.data, access };
}

function card(offering: ConfiguredSceneOffering, sourceLaunchId: string) {
  return {
    source_launch_id: sourceLaunchId,
    status: offering.status,
    offering_digest: offering.offering_digest,
    configuration_run_id: offering.configuration_run_id,
    team_namespace: offering.team_namespace,
    scene_identity: offering.scene_identity,
    task: offering.task,
    presentation: {
      thumbnail_url: `/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/thumbnail`,
      selection: offering.presentation.selection,
      selected_from_exact_reviewed_frame_count:
        offering.presentation.selected_from_exact_reviewed_frame_count,
    },
    evaluation_preparation_binding: offering.evaluation_preparation_binding,
    proof_boundary: offering.proof_boundary,
    evaluation_admission: offering.evaluation_admission,
  };
}

router.get("/", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Configured scene offering store is unavailable" });
  const access = await resolveAccessContext(res);
  if (!access.uid) return res.status(401).json({ error: "Authentication required" });
  const tenantId = firebaseTenantId(res);
  if (!access.isOps && !tenantId) return res.status(200).json({
    schema_version: "task_evaluation_configured_scene_offering_catalog.v1",
    scope: "owner_without_verified_team",
    offerings: [],
  });
  try {
    const query = access.isOps
      ? db.collection(COLLECTION).where("configured_scene_offering_state", "in", STORED_OFFERING_STATES)
      : db.collection(COLLECTION).where("configured_scene_offering_team_namespace", "==", tenantId);
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(query.limit(100).get());
    const offerings: ReturnType<typeof card>[] = [];
    for (const document of snapshot.docs) {
      const record = document.data() as Record<string, unknown>;
      if (!isStoredOfferingState(record.configured_scene_offering_state)) continue;
      const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
      if (
        !parsed.success
        || parsed.data.status !== record.configured_scene_offering_state
        || parsed.data.offering_digest !== record.configured_scene_offering_digest
      ) {
        throw new Error("configured_scene_offering_store_invalid");
      }
      if (!access.isOps && parsed.data.team_namespace !== tenantId) continue;
      offerings.push(card(parsed.data, document.id));
    }
    res.set("Cache-Control", "private, no-store");
    return res.json({
      schema_version: "task_evaluation_configured_scene_offering_catalog.v1",
      scope: access.isOps ? "blueprint_operations" : "verified_team",
      offerings,
    });
  } catch {
    return res.status(503).json({
      error: "Configured scene offering store is unavailable",
      offerings: [],
    });
  }
});

router.get("/:launchId/thumbnail", async (req, res) => {
  if (!db) return res.status(503).json({
    error: "Configured scene thumbnail store is unavailable",
  });
  try {
    const resolved = await accessibleOffering(req.params.launchId, res);
    if (!resolved) return res.status(404).json({ error: "Configured scene offering not found" });
    const buffer = await readConfiguredSceneThumbnail(
      resolved.offering.presentation.task_thumbnail,
    );
    res.set("Cache-Control", "private, no-store");
    res.type("png");
    return res.send(buffer);
  } catch {
    return res.status(503).json({ error: "Configured scene thumbnail store is unavailable" });
  }
});

router.post("/:launchId/preparations", async (req, res) => {
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json({ error: "Configured scene offering store is unavailable" });
  }
  if (!resolved) return res.status(404).json({ error: "Configured scene offering not found" });
  if (resolved.offering.status === "configured_controls_pending") return res.status(409).json({
    error: "Configured scene controls have not passed",
    code: "configured_scene_offering_controls_pending",
    paid_execution_requested: false,
  });
  if (!preparationMatchesConfiguredSceneOffering(req.body, resolved.offering)) return res.status(409).json({
    error: "Task Evaluation preparation does not match the configured scene offering",
    code: "configured_scene_offering_preparation_binding_mismatch",
    paid_execution_requested: false,
  });
  return submitTaskEvaluationLaunchPreparation(req, res, {
    actorId: resolved.access.uid,
    actorRole: resolved.access.isAdmin
      ? "admin"
      : resolved.access.isOps ? "ops" : "team_member",
    channel: "production_webapp_browser",
    serviceId: null,
    idempotencyKey: String(req.header("idempotency-key") || req.body?.preparation_id || ""),
    configuredSceneOfferingBinding: configuredSceneOfferingBinding(
      resolved.offering,
      req.params.launchId,
    ),
  });
});

export default router;
