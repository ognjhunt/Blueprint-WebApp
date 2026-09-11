import { Router } from "express";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildSceneIntake,
  sceneDigest,
  sceneIntakeCommand,
  sceneOwner,
  sceneSourceReference,
  sceneProviderTerms,
  validateSceneProviderTerms,
  nativeSourceInOrganization,
  scenePublicSourceCatalog,
  SCENE_INTAKE_COLLECTION,
} from "../utils/taskEvaluationSceneIntake";
import { resolvePublishedLaunchProfileCatalog } from "../utils/taskEvaluationLaunchContract";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "../utils/taskEvaluationLaunchStore";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
function projection(id: string, value: Record<string, any>) {
  return {
    id,
    submission_id: value.request.submission_id,
    source_session_id: value.source_session_id,
    state: value.state,
    blocker: value.blocker || null,
    request_digest: value.request_digest,
    receipt: value.receipt || null,
    pipeline_status: value.pipeline_status || null,
    revocation_receipt: value.revocation_receipt || null,
    created_at_iso: value.created_at_iso,
  };
}
router.post("/", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Intake store unavailable" });
  const parsed = sceneIntakeCommand.safeParse(req.body);
  if (!parsed.success) {
    // Surface the same canonical, actionable codes the completed-scene factory
    // would raise so a description-only submission is not silently dropped.
    const paths = parsed.error.issues.map((issue) => issue.path.join("."));
    const error = paths.some((path) => path.startsWith("task.destination"))
      ? "task_destination_pose_required"
      : paths.some((path) => path.startsWith("task.success"))
        ? "task_success_criteria_required"
        : "Invalid scene, task, or bounded consent";
    return res.status(400).json({ error, issues: parsed.error.flatten() });
  }
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    const id = `scene-${sceneDigest({ owner, submission_id: parsed.data.submission_id }).slice(7)}`;
    const ref = db.collection(SCENE_INTAKE_COLLECTION).doc(id);
    const commandDigest = sceneDigest(parsed.data);
    const existing = await storeTimeout(ref.get());
    if (existing.exists) {
      const retained = existing.data()!;
      if (retained.command_digest !== commandDigest) throw new Error("idempotency_conflict");
      return res.status(202).json(projection(id, retained));
    }
    const publicChoice = parsed.data.source_session_id.startsWith("public-")
      ? (await scenePublicSourceCatalog()).find((row) => row.binding_id === parsed.data.source_session_id)
      : undefined;
    if (parsed.data.source_session_id.startsWith("public-") && !publicChoice)
      throw new Error("source_validation_required");
    const result = await storeTimeout(
      db.runTransaction(async (transaction) => {
        const previous = await transaction.get(ref);
        if (previous.exists) {
          const record = previous.data()!;
          if (record.command_digest !== commandDigest)
            throw new Error("idempotency_conflict");
          return record;
        }
        const sourceRef = sceneSourceReference(parsed.data.source_session_id);
        validateSceneProviderTerms(parsed.data);
        const source = publicChoice ? undefined : await transaction.get(
          db!.collection(sourceRef.collection).doc(sourceRef.id));
        const collisionRef = parsed.data.collision_source_session_id ? sceneSourceReference(parsed.data.collision_source_session_id) : null;
        const collision = collisionRef ? await transaction.get(db!.collection(collisionRef.collection).doc(collisionRef.id)) : null;
        const request = buildSceneIntake(
          parsed.data,
          owner,
          publicChoice || source?.data() || {},
          Date.now() / 1000,
          collision?.data(),
        );
        const record = {
          owner_user_id: owner.user_id,
          organization_id: owner.organization_id,
          source_session_id: parsed.data.source_session_id,
          command: parsed.data,
          command_digest: commandDigest,
          request,
          request_digest: sceneDigest(request),
          state: "forward_pending",
          forward_attempt_count: 0,
          next_forward_at_ms: 0,
          created_at_iso: new Date().toISOString(),
        };
        transaction.create(ref, record);
        return record;
      }),
    );
    return res.status(202).json(projection(id, result));
  } catch (error) {
    const code = error instanceof Error ? error.message : "intake_failed";
    const known = [
      "authentication_required",
      "source_not_owned",
      "source_validation_required",
      "source_rights_binding_required",
      "public_scene_task_selection_changed",
      "public_scene_required_provider_missing",
      "collision_source_binding_required",
      "collision_source_mesh_required",
      "source_revoked",
      "consent_expiry_invalid",
      "idempotency_conflict",
      "provider_terms_not_configured_or_changed",
    ];
    return res
      .status(
        code === "authentication_required"
          ? 401
          : code === "source_not_owned"
            ? 404
            : known.includes(code)
              ? 409
              : 503,
      )
      .json({
        error: known.includes(code) ? code : "intake_persistence_unavailable",
        retry_same_submission_id: true,
      });
  }
});
router.get("/", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Intake store unavailable" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    const rows = await storeTimeout(
      db
        .collection(SCENE_INTAKE_COLLECTION)
        .where("owner_user_id", "==", owner.user_id)
        .where("organization_id", "==", owner.organization_id)
        .orderBy("created_at_iso", "desc")
        .limit(100)
        .get(),
    );
    return res.json({
      intakes: rows.docs
        .filter((row) => row.data().organization_id === owner.organization_id)
        .map((row) => projection(row.id, row.data())),
    });
  } catch {
    return res.status(503).json({ error: "Intake status unavailable" });
  }
});
router.get("/sources", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Source store unavailable" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    const [captures, publicSources, submissions] = await Promise.all([
      storeTimeout(
        db
          .collection("creatorCaptures")
          .where("creator_id", "==", owner.user_id)
          .limit(100)
          .get(),
      ),
      scenePublicSourceCatalog().catch(() => []),
      storeTimeout(
        db
          .collection("capture_submissions")
          .where("creator_id", "==", owner.user_id)
          .limit(100)
          .get(),
      ),
    ]);
    const native = new Map(
      captures.docs
        .filter((row) => nativeSourceInOrganization(row.data(), owner))
        .map((row) => [row.id, row.data()]),
    );
    const sources = submissions.docs
      .filter(
        (row) =>
          native.has(row.id) ||
          (owner.organization_id === `user:${owner.user_id}` &&
            !captures.docs.some((capture) => capture.id === row.id)),
      )
      .map((row) => ({
        id: `native-${row.id}`,
        label: String(row.data().scene_id || row.id),
        record: native.get(row.id),
      }));
    for (const [id, record] of native)
      if (!sources.some((source) => source.id === `native-${id}`))
        sources.push({ id: `native-${id}`, label: id, record });
    return res.json({
      sources: [...sources.map((source) => ({
        id: source.id,
        label: source.label,
        kind: "capture_bundle",
        source_type: "native_capture",
        validation_status:
          source.record?.immutable_upload_identity?.verification_status ||
          "immutable_upload_identity_required",
        selectable:
          Boolean(
            source.record?.immutable_upload_identity?.raw_bundle_digest,
          ) &&
          source.record?.capture_access?.future_processing_allowed !== false,
      })), ...publicSources.map((source) => ({
        id: source.binding_id, label: source.label || `InteriorGS ${source.publisher_scene_id}`,
        kind: "public_scene", source_type: "publisher_scene", validation_status: "publisher_bytes_pending_controller_verification",
        selectable: true, task_proposal: source.task_proposal, task_proposal_digest: source.task_proposal_digest,
        required_providers: source.required_providers,
      }))],
    });
  } catch {
    return res.status(503).json({ error: "Native sources unavailable" });
  }
});
router.get("/options", async (_req, res) => {
  const catalog = await resolvePublishedLaunchProfileCatalog();
  const pairs = new Map<
    string,
    Array<{ id: string; artifact_digest: string }>
  >();
  for (const profile of catalog.profiles)
    for (const preset of profile.internal_policy_canary_setup?.robot_presets ||
      []) {
      if (preset.readiness.status !== "verified_runnable") continue;
      const pair = ["pi05_droid", "groot_n17_droid"].map((id) =>
        preset.policy_candidates.find(
          (candidate) =>
            candidate.candidate_id === id &&
            candidate.readiness.status === "verified_runnable",
        ),
      );
      if (pair.every(Boolean)) {
        const identities = pair.map((candidate) => ({
          id: candidate!.candidate_id,
          artifact_digest: candidate!.checkpoint.digest,
        }));
        pairs.set(sceneDigest(identities), identities);
      }
    }
  let pairSource = pairs.size ? "published_verified_runnable" : "unavailable";
  if (!pairs.size) {
    try {
      const configured =
        sceneIntakeCommand.shape.execution.shape.policy_candidates.parse(
          JSON.parse(
            process.env.TASK_EVALUATION_SCENE_POLICY_CANDIDATES_JSON || "null",
          ),
        );
      pairs.set(sceneDigest(configured), configured);
      pairSource = "configured_identity_runtime_admission_required";
    } catch {
      /* No fabricated checkpoint defaults when no admitted identity is configured. */
    }
  }
  res.set("Cache-Control", "no-store");
  return res.json({
    provider_terms: sceneProviderTerms(),
    policy_pairs: [...pairs.values()],
    policy_pair_source: pairSource,
    policy_catalog_blocker: catalog.blocker || null,
  });
});
router.post("/:id/revoke", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Intake store unavailable" });
  if (!/^scene-[0-9a-f]{64}$/.test(req.params.id))
    return res.status(404).json({ error: "Intake not found" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    const ref = db.collection(SCENE_INTAKE_COLLECTION).doc(req.params.id);
    const result = await storeTimeout(
      db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const value = snapshot.data();
        if (!value || sceneDigest(value.request.owner) !== sceneDigest(owner))
          throw new Error("not_found");
        if (value.state === "revoked") return value;
        const unissued =
          !value.receipt &&
          !value.forwarding_started &&
          value.forward_attempt_count === 0 &&
          !(value.lease_until_ms > Date.now());
        const patch = {
          revocation_requested: true,
          state: unissued ? "revoked" : "revocation_pending",
          next_forward_at_ms: 0,
        };
        transaction.update(ref, patch);
        return { ...value, ...patch };
      }),
    );
    return res.status(202).json(projection(req.params.id, result));
  } catch (error) {
    return res
      .status(
        error instanceof Error && error.message === "not_found" ? 404 : 503,
      )
      .json({
        error: "Revocation could not be retained; retry the same intent",
      });
  }
});
export default router;
