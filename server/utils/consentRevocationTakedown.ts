import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

/**
 * Consent-revocation takedown ingestion (audit finding R027).
 *
 * The Pipeline emits `webapp_rights_privacy_takedown_notice.json` when a
 * capture's consent is revoked (see
 * BlueprintCapturePipeline/src/blueprint_pipeline/post_training_data_package.py).
 * That notice is a downstream handoff only — the Pipeline reports
 * `webapp_takedown_executed=False` and cannot flip WebApp state itself.
 *
 * This module is the WebApp-side executor: it consumes the notice, finds every
 * marketplace entitlement linked to the revoked capture/scene/site, and flips
 * each provisioned entitlement to `access_state="revoked"` so the signed-URL
 * mint paths (which gate on `access_state==="provisioned"`) refuse it. It also
 * records a per-entitlement takedown audit trail plus a ledger row keyed by the
 * source notice.
 */

const MARKETPLACE_ENTITLEMENT_COLLECTION = "marketplaceEntitlements";
const MARKETPLACE_INVENTORY_COLLECTIONS = [
  "publishedMarketplaceInventory",
  "marketplace_items",
] as const;
const CONSENT_REVOCATION_TAKEDOWN_LEDGER_COLLECTION = "consentRevocationTakedowns";

const REVOKED_ACCESS_STATE = "revoked";
const TAKEDOWN_REASON = "consent_revoked_takedown_required";

/**
 * Shape of the Pipeline `webapp_rights_privacy_takedown_notice.json` payload.
 * Only the fields the WebApp matches on are typed; unknown extras are ignored.
 */
export interface ConsentRevocationNotice {
  schema_version?: string;
  generated_at?: string;
  notice_id?: string;
  scene_id?: string;
  capture_id?: string;
  site_submission_id?: string;
  consent_revoked?: boolean;
  consent_revoked_at?: string | null;
  status?: string;
  required_webapp_state?: string;
  revocation_takedown_manifest_path?: string;
  [key: string]: unknown;
}

export interface ConsentRevocationTakedownResult {
  ok: boolean;
  notice_id: string;
  capture_id: string | null;
  scene_id: string | null;
  site_submission_id: string | null;
  affected_skus: string[];
  revoked_entitlement_ids: string[];
  already_revoked_entitlement_ids: string[];
  scanned_entitlement_count: number;
  code?: string;
  message?: string;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function deriveNoticeId(notice: ConsentRevocationNotice): string {
  const explicit = stringValue(notice.notice_id);
  if (explicit) {
    return explicit;
  }
  const anchor =
    stringValue(notice.capture_id) ||
    stringValue(notice.scene_id) ||
    stringValue(notice.site_submission_id) ||
    "unknown";
  const generatedAt = stringValue(notice.generated_at) || "unknown";
  return `consent_revocation_takedown:${anchor}:${generatedAt}`;
}

/**
 * A notice authorizes a takedown only when consent is actually revoked. We
 * accept the explicit boolean, the Pipeline `status`, or the
 * `required_webapp_state` signal so a schema tweak on one field does not silently
 * leave the enforcement gap open.
 */
function noticeAuthorizesTakedown(notice: ConsentRevocationNotice): boolean {
  if (notice.consent_revoked === true) {
    return true;
  }
  const status = stringValue(notice.status).toLowerCase();
  if (status.includes("takedown") || status.includes("revoked")) {
    return true;
  }
  return (
    stringValue(notice.required_webapp_state) ===
    "blocked_consent_revoked_takedown_required"
  );
}

type EntitlementCandidate = {
  id: string;
  data: Record<string, unknown>;
};

function collectDocs(
  target: Map<string, EntitlementCandidate>,
  docs: Array<{ id?: string; data: () => unknown }>,
): void {
  for (const doc of docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const id = stringValue(doc.id) || stringValue(data.id);
    if (!id) {
      continue;
    }
    target.set(id, { id, data });
  }
}

/**
 * Ingest a Pipeline consent-revocation takedown notice and revoke every
 * marketplace entitlement linked to the revoked capture/scene/site.
 *
 * Matching is two-pronged so the linkage is robust regardless of how the
 * entitlement was minted:
 *  1. Resolve affected SKUs from marketplace inventory (which carries
 *     capture_id/scene_id/site_submission_id and is keyed by sku), then revoke
 *     every entitlement holding one of those SKUs.
 *  2. Directly match entitlements that themselves carry capture_id/scene_id/
 *     site_submission_id fields.
 */
export async function ingestConsentRevocationTakedown(
  notice: ConsentRevocationNotice,
): Promise<ConsentRevocationTakedownResult> {
  const captureId = stringValue(notice.capture_id) || null;
  const sceneId = stringValue(notice.scene_id) || null;
  const siteSubmissionId = stringValue(notice.site_submission_id) || null;
  const noticeId = deriveNoticeId(notice);
  const consentRevokedAt = stringValue(notice.consent_revoked_at) || null;

  const base: ConsentRevocationTakedownResult = {
    ok: false,
    notice_id: noticeId,
    capture_id: captureId,
    scene_id: sceneId,
    site_submission_id: siteSubmissionId,
    affected_skus: [],
    revoked_entitlement_ids: [],
    already_revoked_entitlement_ids: [],
    scanned_entitlement_count: 0,
  };

  if (!db) {
    return {
      ...base,
      code: "database_not_available",
      message: "Database not available",
    };
  }

  if (!noticeAuthorizesTakedown(notice)) {
    return {
      ...base,
      code: "notice_not_a_revocation",
      message:
        "Notice does not indicate consent revocation; refusing to revoke entitlements.",
    };
  }

  if (!captureId && !sceneId && !siteSubmissionId) {
    return {
      ...base,
      code: "missing_capture_or_scene_identifier",
      message:
        "Consent revocation notice must carry a capture_id, scene_id, or site_submission_id.",
    };
  }

  const linkFields = [
    ["capture_id", captureId],
    ["scene_id", sceneId],
    ["site_submission_id", siteSubmissionId],
  ] as const;

  // 1. Resolve affected SKUs from the marketplace inventory linkage.
  const affectedSkus = new Set<string>();
  for (const collectionName of MARKETPLACE_INVENTORY_COLLECTIONS) {
    for (const [field, value] of linkFields) {
      if (!value) {
        continue;
      }
      const snapshot = await db
        .collection(collectionName)
        .where(field, "==", value)
        .get();
      for (const doc of snapshot.docs) {
        const data = (doc.data() || {}) as Record<string, unknown>;
        const sku = stringValue(data.sku) || stringValue(doc.id);
        if (sku) {
          affectedSkus.add(sku);
        }
      }
    }
  }

  // 2. Gather candidate entitlements by SKU and by direct capture/scene/site link.
  const candidates = new Map<string, EntitlementCandidate>();
  for (const sku of affectedSkus) {
    const snapshot = await db
      .collection(MARKETPLACE_ENTITLEMENT_COLLECTION)
      .where("sku", "==", sku)
      .get();
    collectDocs(candidates, snapshot.docs);
  }
  for (const [field, value] of linkFields) {
    if (!value) {
      continue;
    }
    const snapshot = await db
      .collection(MARKETPLACE_ENTITLEMENT_COLLECTION)
      .where(field, "==", value)
      .get();
    collectDocs(candidates, snapshot.docs);
  }

  // 3. Flip every candidate that is not already revoked.
  const revokedAt = new Date().toISOString();
  const revokedEntitlementIds: string[] = [];
  const alreadyRevokedEntitlementIds: string[] = [];

  for (const candidate of candidates.values()) {
    const accessState = stringValue(candidate.data.access_state);
    if (accessState === REVOKED_ACCESS_STATE) {
      alreadyRevokedEntitlementIds.push(candidate.id);
      continue;
    }

    await db
      .collection(MARKETPLACE_ENTITLEMENT_COLLECTION)
      .doc(candidate.id)
      .set(
        {
          access_state: REVOKED_ACCESS_STATE,
          takedown: {
            revoked: true,
            reason: TAKEDOWN_REASON,
            source_notice_id: noticeId,
            source_notice_schema_version:
              stringValue(notice.schema_version) || null,
            capture_id: captureId,
            scene_id: sceneId,
            site_submission_id: siteSubmissionId,
            previous_access_state: accessState || null,
            consent_revoked_at: consentRevokedAt,
            revoked_at: revokedAt,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    revokedEntitlementIds.push(candidate.id);
  }

  // 4. Record a top-level takedown audit ledger row keyed by the source notice.
  await db
    .collection(CONSENT_REVOCATION_TAKEDOWN_LEDGER_COLLECTION)
    .doc(noticeId)
    .set(
      {
        notice_id: noticeId,
        source: "pipeline_consent_revocation_notice",
        schema_version: stringValue(notice.schema_version) || null,
        capture_id: captureId,
        scene_id: sceneId,
        site_submission_id: siteSubmissionId,
        consent_revoked_at: consentRevokedAt,
        affected_skus: Array.from(affectedSkus),
        revoked_entitlement_ids: revokedEntitlementIds,
        already_revoked_entitlement_ids: alreadyRevokedEntitlementIds,
        scanned_entitlement_count: candidates.size,
        revoked_at: revokedAt,
        webapp_takedown_executed: true,
        claim_boundary:
          "Ledger records that affected WebApp entitlements were flipped to access_state=revoked. It is not proof of hosted-session teardown or downstream training deletion.",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch((error: unknown) => {
      logger.warn(
        { error, noticeId },
        "Failed to persist consent revocation takedown ledger row",
      );
    });

  logger.info(
    {
      noticeId,
      captureId,
      sceneId,
      siteSubmissionId,
      affectedSkus: Array.from(affectedSkus),
      revokedEntitlementIds,
      alreadyRevokedEntitlementIds,
    },
    "Executed consent revocation takedown on marketplace entitlements",
  );

  return {
    ok: true,
    notice_id: noticeId,
    capture_id: captureId,
    scene_id: sceneId,
    site_submission_id: siteSubmissionId,
    affected_skus: Array.from(affectedSkus),
    revoked_entitlement_ids: revokedEntitlementIds,
    already_revoked_entitlement_ids: alreadyRevokedEntitlementIds,
    scanned_entitlement_count: candidates.size,
  };
}
