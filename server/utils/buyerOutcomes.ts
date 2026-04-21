import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  appendOperatingGraphEvent,
  buildBuyerOutcomeId,
  buildCityProgramId,
  buildHostedReviewRunId,
  buildPackageRunId,
} from "./operatingGraph";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugifyCity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStableId(parts: Array<string | null | undefined>) {
  return parts
    .map((entry) => normalizeString(entry))
    .filter(Boolean)
    .join(":");
}

export function deriveCityContext(input: { city?: string | null }) {
  const city = normalizeString(input.city);
  const citySlug = city ? slugifyCity(city) : "";
  const cityProgramId = citySlug
    ? buildCityProgramId({
        citySlug,
      })
    : "";

  return {
    city,
    citySlug,
    cityProgramId,
  };
}

export function deriveStablePackageId(input: {
  packageId?: string | null;
  captureId?: string | null;
  sceneId?: string | null;
  siteSubmissionId?: string | null;
  buyerRequestId?: string | null;
  requestId?: string | null;
}) {
  return (
    normalizeString(input.packageId)
    || normalizeString(input.captureId)
    || normalizeString(input.sceneId)
    || normalizeString(input.siteSubmissionId)
    || normalizeString(input.buyerRequestId)
    || normalizeString(input.requestId)
  );
}

export function deriveStableHostedReviewRunId(input: {
  hostedReviewRunId?: string | null;
  requestId?: string | null;
  buyerRequestId?: string | null;
}) {
  return (
    normalizeString(input.hostedReviewRunId)
    || normalizeString(input.requestId)
    || normalizeString(input.buyerRequestId)
  );
}

export function deriveStableBuyerAccountId(input: {
  buyerAccountId?: string | null;
  contactEmail?: string | null;
  contactCompany?: string | null;
  buyerRequestId?: string | null;
}) {
  const explicit = normalizeString(input.buyerAccountId);
  if (explicit) {
    return explicit;
  }

  const email = normalizeString(input.contactEmail).toLowerCase();
  if (email) {
    return `buyer_email:${email}`;
  }

  const company = normalizeString(input.contactCompany).toLowerCase();
  if (company) {
    return `buyer_company:${company.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  }

  const buyerRequestId = normalizeString(input.buyerRequestId);
  if (buyerRequestId) {
    return `buyer_request:${buyerRequestId}`;
  }

  return "";
}

export function buildBuyerOperatingGraphMetadata(input: {
  cityProgramId?: string | null;
  siteSubmissionId?: string | null;
  captureId?: string | null;
  sceneId?: string | null;
  buyerRequestId?: string | null;
  captureJobId?: string | null;
  packageId?: string | null;
  hostedReviewRunId?: string | null;
  buyerOutcomeId?: string | null;
  buyerAccountId?: string | null;
}) {
  const cityProgramId = normalizeString(input.cityProgramId);
  const siteSubmissionId = normalizeString(input.siteSubmissionId);
  const captureId = normalizeString(input.captureId);
  const sceneId = normalizeString(input.sceneId);
  const buyerRequestId = normalizeString(input.buyerRequestId);
  const captureJobId = normalizeString(input.captureJobId);
  const packageId = normalizeString(input.packageId);
  const hostedReviewRunId = normalizeString(input.hostedReviewRunId);
  const buyerOutcomeId = normalizeString(input.buyerOutcomeId);
  const buyerAccountId = normalizeString(input.buyerAccountId);

  return {
    ...(cityProgramId ? { city_program_id: cityProgramId } : {}),
    ...(siteSubmissionId ? { site_submission_id: siteSubmissionId } : {}),
    ...(captureId ? { capture_id: captureId } : {}),
    ...(sceneId ? { scene_id: sceneId } : {}),
    ...(buyerRequestId ? { buyer_request_id: buyerRequestId } : {}),
    ...(captureJobId ? { capture_job_id: captureJobId } : {}),
    ...(packageId ? { package_id: packageId, package_run_id: buildPackageRunId({ packageId }) } : {}),
    ...(hostedReviewRunId
      ? {
          hosted_review_run_id: hostedReviewRunId,
          hosted_review_entity_id: buildHostedReviewRunId({ hostedReviewRunId }),
        }
      : {}),
    ...(buyerOutcomeId ? { buyer_outcome_id: buyerOutcomeId } : {}),
    ...(buyerAccountId ? { buyer_account_id: buyerAccountId } : {}),
    canonical_foreign_keys: {
      ...(cityProgramId ? { city_program_id: cityProgramId } : {}),
      ...(siteSubmissionId ? { site_submission_id: siteSubmissionId } : {}),
      ...(captureId ? { capture_id: captureId } : {}),
      ...(sceneId ? { scene_id: sceneId } : {}),
      ...(buyerRequestId ? { buyer_request_id: buyerRequestId } : {}),
      ...(captureJobId ? { capture_job_id: captureJobId } : {}),
      ...(packageId
        ? {
            package_id: packageId,
            package_run_id: buildPackageRunId({ packageId }),
          }
        : {}),
      ...(hostedReviewRunId ? { hosted_review_run_id: hostedReviewRunId } : {}),
      ...(buyerOutcomeId ? { buyer_outcome_id: buyerOutcomeId } : {}),
      ...(buyerAccountId ? { buyer_account_id: buyerAccountId } : {}),
    },
  };
}

function generateBuyerOutcomeId(input: {
  requestId?: string | null;
  hostedReviewRunId?: string | null;
  outcomeType: string;
  source: string;
}) {
  const stableBase = buildStableId([
    input.requestId,
    input.hostedReviewRunId,
    input.outcomeType,
    input.source,
  ]);
  const digest = crypto.createHash("sha256").update(stableBase).digest("hex").slice(0, 10);
  return buildStableId([normalizeString(input.requestId) || "buyer_outcome", input.outcomeType, digest]);
}

export async function recordBuyerOutcome(input: {
  requestId: string;
  city?: string | null;
  siteSubmissionId?: string | null;
  captureId?: string | null;
  sceneId?: string | null;
  buyerRequestId?: string | null;
  captureJobId?: string | null;
  packageId?: string | null;
  hostedReviewRunId?: string | null;
  buyerAccountId?: string | null;
  outcomeType: string;
  outcomeStatus: string;
  recordedBy: string;
  commercialValueUsd?: number | null;
  confidence?: number | null;
  source: string;
  notes?: string | null;
  proofRefs?: string[];
  originRoute: string;
  sourceDocId?: string | null;
  buyerOutcomeId?: string | null;
}) {
  if (!db) {
    return null;
  }

  const outcomeType = normalizeString(input.outcomeType);
  const outcomeStatus = normalizeString(input.outcomeStatus);
  const source = normalizeString(input.source);
  const recordedBy = normalizeString(input.recordedBy);

  if (!outcomeType || !outcomeStatus || !source || !recordedBy) {
    throw new Error("buyer outcome requires outcomeType, outcomeStatus, source, and recordedBy");
  }

  const cityContext = deriveCityContext({
    city: input.city,
  });
  const packageId = deriveStablePackageId({
    packageId: input.packageId,
    captureId: input.captureId,
    sceneId: input.sceneId,
    siteSubmissionId: input.siteSubmissionId,
    buyerRequestId: input.buyerRequestId,
    requestId: input.requestId,
  });
  const hostedReviewRunId = deriveStableHostedReviewRunId({
    hostedReviewRunId: input.hostedReviewRunId,
    requestId: input.requestId,
    buyerRequestId: input.buyerRequestId,
  });
  const buyerAccountId = deriveStableBuyerAccountId({
    buyerAccountId: input.buyerAccountId,
    buyerRequestId: input.buyerRequestId,
  });
  const buyerOutcomeId =
    normalizeString(input.buyerOutcomeId)
    || generateBuyerOutcomeId({
      requestId: input.requestId,
      hostedReviewRunId,
      outcomeType,
      source,
    });
  const recordedAtIso = new Date().toISOString();
  const proofRefs = Array.isArray(input.proofRefs)
    ? input.proofRefs.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];

  const metadata = buildBuyerOperatingGraphMetadata({
    cityProgramId: cityContext.cityProgramId,
    siteSubmissionId: input.siteSubmissionId,
    captureId: input.captureId,
    sceneId: input.sceneId,
    buyerRequestId: input.buyerRequestId,
    captureJobId: input.captureJobId,
    packageId,
    hostedReviewRunId,
    buyerOutcomeId,
    buyerAccountId,
  });

  const ledgerRow = {
    buyer_outcome_id: buyerOutcomeId,
    city_program_id: cityContext.cityProgramId || null,
    site_submission_id: normalizeString(input.siteSubmissionId) || null,
    capture_id: normalizeString(input.captureId) || null,
    hosted_review_run_id: hostedReviewRunId || null,
    buyer_account_id: buyerAccountId || null,
    outcome_type: outcomeType,
    outcome_status: outcomeStatus,
    recorded_at: recordedAtIso,
    recorded_by: recordedBy,
    commercial_value_usd:
      typeof input.commercialValueUsd === "number" && Number.isFinite(input.commercialValueUsd)
        ? input.commercialValueUsd
        : null,
    confidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? input.confidence
        : null,
    source,
    notes: normalizeString(input.notes) || null,
    proof_refs: proofRefs,
    metadata,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("buyerOutcomes").doc(buyerOutcomeId).set(ledgerRow, { merge: true });

  if (cityContext.city && cityContext.citySlug) {
    await appendOperatingGraphEvent({
      eventKey: `buyer_outcome:${buyerOutcomeId}:${recordedAtIso}`,
      entityType: "buyer_outcome",
      entityId: buildBuyerOutcomeId({
        buyerOutcomeId,
      }),
      city: cityContext.city,
      citySlug: cityContext.citySlug,
      stage: "buyer_outcome_recorded",
      summary: `Buyer outcome recorded: ${outcomeType.replaceAll("_", " ")}.`,
      sourceRepo: "Blueprint-WebApp",
      sourceKind: "buyer_outcome_ledger",
      origin: {
        repo: "Blueprint-WebApp",
        project: "blueprint-webapp",
        sourceCollection: "buyerOutcomes",
        sourceDocId: buyerOutcomeId,
        route: input.originRoute,
      },
      metadata,
      recordedAtIso,
    });
  }

  return {
    buyerOutcomeId,
    hostedReviewRunId,
    packageId,
    buyerAccountId,
    cityProgramId: cityContext.cityProgramId || null,
    recordedAtIso,
  };
}
