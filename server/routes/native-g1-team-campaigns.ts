import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { sceneOwner } from "../utils/taskEvaluationSceneIntake";
import { makeTeamPolicyDeliveryProfile, teamPolicyDeliverySubmissionSchema } from "../utils/teamPolicyDeliveryProfile";
import {
  fetchG1TeamCatalog,
  g1SubmissionSchema,
  submitG1TeamCampaign,
} from "../utils/nativeG1TeamCampaignForwarding";

const router = Router();
const deliveryCollection = "teamPolicyDeliveryProfiles";

function verifiedDelivery(value: Record<string, any> | undefined) {
  if (!value || value.schema_version !== "team_policy_delivery_profile.v1"
    || value.status !== "registered_for_runtime_review"
    || value.claim_ceiling !== "planning_only"
    || value.provider_mutation_performed !== false) return null;
  const { created_at_iso: _created, ...profile } = value;
  return profile.profile_digest === crossRuntimeArtifactDigest(profile, "profile_digest")
    ? profile : null;
}

router.get("/policy-deliveries", async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  if (!db) return res.status(503).json({ error: "Policy delivery store unavailable" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    const snapshot = await db.collection(deliveryCollection)
      .where("owner.user_id", "==", owner.user_id).limit(100).get();
    const profiles = snapshot.docs.map((doc) => {
      const profile = verifiedDelivery(doc.data());
      return profile?.profile_digest.slice(7) === doc.id ? profile : null;
    })
      .filter((value) => value?.owner?.organization_id === owner.organization_id
        && value?.owner?.user_id === owner.user_id);
    return res.json({ schema_version: "team_policy_delivery_profile_list.v1", profiles });
  } catch {
    return res.status(503).json({ error: "Policy delivery store unavailable" });
  }
});

router.post("/policy-deliveries", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  if (!db) return res.status(503).json({ error: "Policy delivery store unavailable" });
  const parsed = teamPolicyDeliverySubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Policy delivery configuration invalid" });
  let profile: ReturnType<typeof makeTeamPolicyDeliveryProfile>;
  const owner = sceneOwner(res.locals.firebaseUser || {});
  let catalog: Awaited<ReturnType<typeof fetchG1TeamCatalog>>;
  try {
    catalog = await fetchG1TeamCatalog(owner);
  } catch {
    return res.status(503).json({ error: "G1 task setups are unavailable" });
  }
  try {
    const matches = catalog.setups.filter((setup) => setup.setup_digest === parsed.data.setup_digest);
    if (matches.length !== 1) return res.status(409).json({ error: "G1 setup unavailable" });
    profile = makeTeamPolicyDeliveryProfile(parsed.data, matches[0], owner);
  } catch {
    return res.status(422).json({ error: "Policy delivery configuration invalid" });
  }
  const document = db.collection(deliveryCollection).doc(profile.profile_digest.slice(7));
  try {
    const prior = await document.get();
    if (prior.exists) {
      return verifiedDelivery(prior.data())?.profile_digest === profile.profile_digest
        ? res.status(200).json(profile)
        : res.status(409).json({ error: "Policy delivery identity conflict" });
    }
    await document.create({ ...profile, created_at_iso: new Date().toISOString() });
    return res.status(201).json(profile);
  } catch {
    try {
      const raced = await document.get();
      if (verifiedDelivery(raced.data())?.profile_digest === profile.profile_digest) {
        return res.status(200).json(profile);
      }
    } catch { /* The store failure is reported below. */ }
    return res.status(503).json({ error: "Policy delivery store unavailable" });
  }
});

router.get("/setups", async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    return res.json(await fetchG1TeamCatalog(owner));
  } catch {
    return res.status(503).json({ error: "G1 task setups are unavailable" });
  }
});

router.post("/", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const parsed = g1SubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Confirm the G1 setup, four policies, and provider cost limit" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    return res.status(202).json(await submitG1TeamCampaign(parsed.data, owner));
  } catch (error) {
    const code = error instanceof Error ? error.message : "g1_submission_unavailable";
    return res.status(code.includes("unavailable") || code.startsWith("g1_pipeline_5") ? 503 : 409)
      .json({ error: code });
  }
});

export default router;
