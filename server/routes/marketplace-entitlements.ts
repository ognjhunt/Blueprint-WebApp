import { Router, type Request, type Response } from "express";

import {
  marketplaceScenes,
  scenes,
  syntheticDatasets,
  trainingDatasets,
} from "../../client/src/data/content";
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { effectiveEntitlementAccessState } from "../utils/entitlementExpiry";

const router = Router();

const SIGNED_ARTIFACT_URL_TTL_MS = 15 * 60 * 1000;
const DIRECT_ARTIFACT_FIELDS = [
  "artifact_uri",
  "artifactUri",
  "delivery_artifact_uri",
  "deliveryArtifactUri",
  "package_uri",
  "packageUri",
  "canonical_package_uri",
  "canonicalPackageUri",
  "post_training_data_package_uri",
  "postTrainingDataPackageUri",
  "manifest_uri",
  "manifestUri",
];
const ARTIFACT_MAP_FIELDS = [
  "artifact_uris",
  "artifactUris",
  "artifacts",
  "delivery_artifacts",
  "deliveryArtifacts",
];
const NESTED_ARTIFACT_FIELDS = ["delivery", "package", "pipeline", "site_package", "sitePackage"];
const PREFERRED_ARTIFACT_KEYS = [
  "post_training_data_package_uri",
  "postTrainingDataPackageUri",
  "package_uri",
  "packageUri",
  "canonical_package_uri",
  "canonicalPackageUri",
  "manifest_uri",
  "manifestUri",
  "robot_eval_dataset_manifest_uri",
];

type ArtifactCandidate = {
  key: string;
  uri: string;
  source: string;
};

function normalizeSku(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArtifactKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, "").toLowerCase();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseGsUri(uri: string): { bucket: string; objectPath: string } {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri.trim());
  if (!match || !match[1] || !match[2]) {
    throw new Error("artifact_uri_must_be_gs_uri");
  }
  return { bucket: match[1], objectPath: match[2] };
}

function addArtifactCandidate(
  candidates: ArtifactCandidate[],
  key: string,
  uri: unknown,
  source: string,
) {
  const normalizedUri = stringValue(uri);
  if (!normalizedUri.startsWith("gs://")) {
    return;
  }
  candidates.push({ key, uri: normalizedUri, source });
}

function collectArtifactCandidatesFromRecord(
  value: Record<string, unknown>,
  source: string,
): ArtifactCandidate[] {
  const candidates: ArtifactCandidate[] = [];

  for (const field of DIRECT_ARTIFACT_FIELDS) {
    addArtifactCandidate(candidates, field, value[field], source);
  }

  for (const field of ARTIFACT_MAP_FIELDS) {
    const artifactMap = value[field];
    if (!isRecord(artifactMap)) {
      continue;
    }
    for (const [key, uri] of Object.entries(artifactMap)) {
      addArtifactCandidate(candidates, key, uri, source);
    }
  }

  for (const field of NESTED_ARTIFACT_FIELDS) {
    const nested = value[field];
    if (!isRecord(nested)) {
      continue;
    }
    candidates.push(...collectArtifactCandidatesFromRecord(nested, `${source}.${field}`));
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const dedupeKey = `${normalizeArtifactKey(candidate.key)}:${candidate.uri}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
}

function selectArtifactCandidate(
  candidates: ArtifactCandidate[],
  req: Request,
): ArtifactCandidate | null {
  const requestedUri = stringValue(req.query.artifact_uri || req.query.artifactUri);
  if (requestedUri) {
    return candidates.find((candidate) => candidate.uri === requestedUri) || null;
  }

  const requestedKey = normalizeArtifactKey(
    stringValue(req.query.artifact || req.query.artifact_key || req.query.artifactKey),
  );
  if (requestedKey) {
    return (
      candidates.find((candidate) => normalizeArtifactKey(candidate.key) === requestedKey) || null
    );
  }

  for (const preferredKey of PREFERRED_ARTIFACT_KEYS) {
    const candidate = candidates.find(
      (entry) => normalizeArtifactKey(entry.key) === normalizeArtifactKey(preferredKey),
    );
    if (candidate) {
      return candidate;
    }
  }

  return candidates[0] || null;
}

async function loadPublishedMarketplaceItem(sku: string): Promise<Record<string, unknown> | null> {
  if (!db || !sku) {
    return null;
  }
  for (const collectionName of ["publishedMarketplaceInventory", "marketplace_items"]) {
    const snapshot = await db.collection(collectionName).doc(sku).get();
    if (snapshot.exists) {
      return {
        id: snapshot.id || sku,
        ...((snapshot.data() || {}) as Record<string, unknown>),
      };
    }
  }
  return null;
}

function resolveAccessUrl(entitlement: Record<string, unknown>) {
  const sku = normalizeSku(String(entitlement.sku || ""));
  const accessState = effectiveEntitlementAccessState(entitlement);
  if (accessState !== "provisioned") {
    return null;
  }

  const staticScene = scenes.find((item) => normalizeSku(item.slug) === sku);
  if (staticScene?.download) {
    return {
      url: staticScene.download,
      label: "Download Scene Package",
      kind: "download",
    };
  }

  const marketplaceScene = marketplaceScenes.find(
    (item) =>
      normalizeSku(item.slug) === sku || sku.startsWith(`${normalizeSku(item.slug)}-`),
  );
  if (marketplaceScene) {
    return {
      url: `/marketplace/scenes/${marketplaceScene.slug}`,
      label: "Open Licensed Scene",
      kind: "detail",
    };
  }

  const trainingDataset = trainingDatasets.find(
    (item) =>
      normalizeSku(item.slug) === sku || sku.startsWith(`${normalizeSku(item.slug)}-`),
  );
  if (trainingDataset) {
    return {
      url: `/marketplace/datasets/${trainingDataset.slug}`,
      label: "Open Licensed Dataset",
      kind: "detail",
    };
  }

  const syntheticDataset = syntheticDatasets.find(
    (item) =>
      normalizeSku(item.slug) === sku || sku.startsWith(`${normalizeSku(item.slug)}-`),
  );
  if (syntheticDataset) {
    return {
      url: `/marketplace/datasets/${syntheticDataset.slug}`,
      label: "Open Licensed Dataset",
      kind: "detail",
    };
  }

  return null;
}

router.get("/current", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const buyerUserId = String(res.locals.firebaseUser?.uid || "").trim();
  if (!buyerUserId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const requestedSku = normalizeSku(String(req.query.sku || ""));
  const snapshot = await db
    .collection("marketplaceEntitlements")
    .where("buyer_user_id", "==", buyerUserId)
    .get();

  const entitlements: Array<Record<string, unknown>> = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...((doc.data() || {}) as Record<string, unknown>),
    }))
    .filter((entry: Record<string, unknown>) => {
      if (!requestedSku) {
        return true;
      }
      const sku = normalizeSku(String(entry["sku"] || ""));
      return sku === requestedSku || sku.startsWith(`${requestedSku}-`);
    });

  const hydratedEntitlements = entitlements.map((entitlement) => {
    const effectiveAccessState = effectiveEntitlementAccessState(entitlement);
    return {
      ...entitlement,
      access_state: effectiveAccessState,
      access: resolveAccessUrl({ ...entitlement, access_state: effectiveAccessState }),
    };
  });
  const primary: Record<string, unknown> | null = hydratedEntitlements[0] || null;
  const access = primary ? resolveAccessUrl(primary) : null;

  return res.status(200).json({
    entitlement: primary,
    access,
    entitlements: hydratedEntitlements,
  });
});

router.get("/:entitlementId/artifact-access", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }
  if (!storageAdmin) {
    return res.status(500).json({ error: "Storage not available" });
  }

  const buyerUserId = String(res.locals.firebaseUser?.uid || "").trim();
  if (!buyerUserId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const entitlementId = String(req.params.entitlementId || "").trim();
  if (!entitlementId) {
    return res.status(400).json({ error: "Missing entitlement id" });
  }

  const snapshot = await db.collection("marketplaceEntitlements").doc(entitlementId).get();
  if (!snapshot.exists) {
    return res.status(404).json({ error: "Entitlement not found" });
  }

  const entitlement: Record<string, unknown> = {
    id: snapshot.id || entitlementId,
    ...((snapshot.data() || {}) as Record<string, unknown>),
  };
  const entitlementBuyerUserId = stringValue(
    entitlement.buyer_user_id || entitlement.buyerUserId,
  );
  if (entitlementBuyerUserId !== buyerUserId) {
    return res.status(403).json({ error: "Entitlement does not belong to caller" });
  }
  const effectiveAccessState = effectiveEntitlementAccessState(entitlement);
  if (effectiveAccessState !== "provisioned") {
    return res.status(409).json({
      error: "Entitlement is not provisioned for artifact access",
      code:
        effectiveAccessState === "expired"
          ? "entitlement_expired"
          : "entitlement_not_provisioned",
    });
  }

  const sku = normalizeSku(String(entitlement.sku || ""));
  const marketplaceItem = await loadPublishedMarketplaceItem(sku);
  const candidates = [
    ...collectArtifactCandidatesFromRecord(entitlement, "entitlement"),
    ...(marketplaceItem
      ? collectArtifactCandidatesFromRecord(marketplaceItem, "published_marketplace_item")
      : []),
  ];
  const selected = selectArtifactCandidate(candidates, req);
  if (!selected) {
    return res.status(404).json({
      error: "No entitlement artifact URI is available for signed access",
      code: "artifact_access_not_configured",
      available_artifact_keys: candidates.map((candidate) => candidate.key),
    });
  }

  try {
    const { bucket, objectPath } = parseGsUri(selected.uri);
    const expiresAt = new Date(Date.now() + SIGNED_ARTIFACT_URL_TTL_MS);
    const [signedUrl] = await storageAdmin.bucket(bucket).file(objectPath).getSignedUrl({
      action: "read",
      expires: expiresAt.getTime(),
    });
    return res.status(200).json({
      entitlement_id: entitlementId,
      sku,
      artifact_key: selected.key,
      artifact_uri: selected.uri,
      artifact_source: selected.source,
      signed_url: signedUrl,
      signed_url_expires_at: expiresAt.toISOString(),
      access: {
        kind: "signed_storage_url",
        entitlement_verified: true,
        expires_at: expiresAt.toISOString(),
      },
      buyer_access_check: {
        entitlement_verified: true,
        buyer_access_checked: true,
        buyer_accessible: true,
        status: "signed_url_minted",
      },
      claim_boundary:
        "Signed URL access proves this authenticated buyer has a provisioned entitlement for the referenced artifact. It is not proof of package semantic success.",
    });
  } catch (error) {
    return res.status(400).json({
      error: "Failed to create signed artifact access URL",
      code: error instanceof Error ? error.message : "signed_artifact_url_failed",
    });
  }
});

export default router;
