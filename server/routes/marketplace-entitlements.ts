import { Router, type Request, type Response } from "express";

import {
  marketplaceScenes,
  scenes,
  syntheticDatasets,
  trainingDatasets,
} from "../../client/src/data/content";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const router = Router();

function normalizeSku(value: string): string {
  return value.trim().toLowerCase();
}

function resolveAccessUrl(entitlement: Record<string, unknown>) {
  const sku = normalizeSku(String(entitlement.sku || ""));
  const accessState = String(entitlement.access_state || "");
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

  const primary: Record<string, unknown> | null = entitlements[0] || null;
  const access = primary ? resolveAccessUrl(primary) : null;

  return res.status(200).json({
    entitlement: primary,
    access,
    entitlements,
  });
});

export default router;
