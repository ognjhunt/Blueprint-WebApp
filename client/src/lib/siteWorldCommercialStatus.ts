import type { PublicSiteWorldRecord } from "@/types/inbound-request";

export const PUBLIC_SAMPLE_SITE_WORLD_ID = "siteworld-f5fd54898cfb";
export const COMMERCIAL_EXEMPLAR_SITE_WORLD_ID = "sw-chi-01";

export type SiteWorldCommercialStatusId =
  | "public_demo_sample"
  | "request_scoped_review"
  | "restriction_review_required"
  | "refresh_review_required";

export type SiteWorldCommercialStatus = {
  id: SiteWorldCommercialStatusId;
  label: string;
  tone: string;
  summary: string;
  buyerNote: string;
};

export function isPublicSampleSiteWorld(site: Pick<PublicSiteWorldRecord, "id">) {
  return site.id === PUBLIC_SAMPLE_SITE_WORLD_ID;
}

export function isCommercialExemplarSiteWorld(site: Pick<PublicSiteWorldRecord, "id">) {
  return site.id === COMMERCIAL_EXEMPLAR_SITE_WORLD_ID;
}

function hasRestrictionSignals(site: PublicSiteWorldRecord) {
  const hasRightsMetadata = Boolean(site.deploymentReadiness?.rights_and_compliance);
  const exportEntitlements = site.deploymentReadiness?.rights_and_compliance?.export_entitlements || [];
  const consentScope = site.deploymentReadiness?.rights_and_compliance?.consent_scope || [];
  const qualificationState = site.deploymentReadiness?.qualification_state;

  return (
    qualificationState === "qualified_risky"
    || qualificationState === "not_ready_yet"
    || consentScope.length > 0
    || (hasRightsMetadata && exportEntitlements.length === 0)
  );
}

function needsRefreshReview(site: PublicSiteWorldRecord) {
  const qualificationState = site.deploymentReadiness?.qualification_state;
  return (
    qualificationState === "needs_refresh"
    || site.deploymentReadiness?.recapture_required === true
    || (site.deploymentReadiness?.missing_evidence || []).length > 0
  );
}

export function getSiteWorldCommercialStatus(
  site: PublicSiteWorldRecord,
): SiteWorldCommercialStatus {
  if (isPublicSampleSiteWorld(site)) {
    return {
      id: "public_demo_sample",
      label: "Public demo sample",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
      summary:
        "This listing is a public proof surface. It shows a real captured sample plus clearly labeled representative artifacts and interface previews.",
      buyerNote:
        "The public demo proves the sample listing exists. It does not imply blanket facility approval or unrestricted commercialization for every future request.",
    };
  }

  if (needsRefreshReview(site)) {
    return {
      id: "refresh_review_required",
      label: "Refresh or evidence review required",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      summary:
        "The listing is inspectable, but freshness, missing evidence, or recapture signals need review before the team relies on it for a commercial decision.",
      buyerNote:
        "Use the public listing to assess fit, then confirm the refresh and evidence path before package access or hosted evaluation moves forward.",
    };
  }

  if (hasRestrictionSignals(site)) {
    return {
      id: "restriction_review_required",
      label: "Restriction review required",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      summary:
        "The site can be reviewed publicly, but rights, consent, privacy, or export boundaries still need explicit review before access is granted.",
      buyerNote:
        "The listing describes the site and workflow truthfully. It does not claim open-ended export or commercialization rights by default.",
    };
  }

  return {
    id: "request_scoped_review",
    label: "Request-scoped commercial review",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    summary:
      "The listing is ready for buyer review with visible proof, export signals, and hosted-path disclosure, but final access still follows the request-specific rights and privacy review.",
    buyerNote:
      "This is a buyer-readable commercial status, not a deployment guarantee and not a blanket approval statement for the underlying facility.",
  };
}

export function getSiteWorldProofDepth(site: PublicSiteWorldRecord) {
  if (isPublicSampleSiteWorld(site)) return "Public demo + current public proof assets";
  if (isCommercialExemplarSiteWorld(site)) return "Commercial exemplar with listing proof fields + request-scoped hosted path";
  if (site.worldLabsPreview?.launchUrl) return "Listing + hosted path disclosure + fallback preview";
  if (site.deploymentReadiness?.native_world_model_primary) return "Listing + hosted path disclosure";
  return "Listing only";
}

export function getSiteWorldPublicProofSummary(site: PublicSiteWorldRecord) {
  const proofAssets = [
    site.runtimeReferenceImageUrl ? "runtime still" : null,
    site.presentationReferenceImageUrl ? "presentation still" : null,
    isPublicSampleSiteWorld(site) ? "sample manifest" : null,
    isPublicSampleSiteWorld(site) ? "sample rights sheet" : null,
    isCommercialExemplarSiteWorld(site) ? "buyer memo" : null,
  ].filter(Boolean) as string[];

  if (proofAssets.length === 0) {
    return "Listing metadata only";
  }

  return proofAssets.join(" + ");
}

export function getSiteWorldReadinessDisclosure(site: PublicSiteWorldRecord) {
  const parts = [
    "This public listing proves what Blueprint is ready to show a buyer now.",
    "It is not a deployment guarantee and does not claim site-operator blanket approval or unrestricted rights.",
  ];

  if (site.deploymentReadiness?.export_readiness_status === "ready") {
    parts.unshift("Export surfaces are documented on this listing.");
  }

  return parts.join(" ");
}

export function getSiteWorldCatalogPriority(site: PublicSiteWorldRecord) {
  if (isPublicSampleSiteWorld(site)) return 0;
  if (isCommercialExemplarSiteWorld(site)) return 1;
  return 2;
}

export function getSiteWorldFeaturedTag(site: PublicSiteWorldRecord) {
  if (isPublicSampleSiteWorld(site)) {
    return {
      label: "Best place to start",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  if (isCommercialExemplarSiteWorld(site)) {
    return {
      label: "Commercial exemplar",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return null;
}

export function getSiteWorldPlainEnglishStatus(site: PublicSiteWorldRecord) {
  const status = getSiteWorldCommercialStatus(site);

  if (status.id === "public_demo_sample") {
    return "Strongest public proof surface. Start here if you are new to Blueprint.";
  }

  if (status.id === "refresh_review_required") {
    return "Useful for fit-checking, but confirm freshness before treating it as current.";
  }

  if (status.id === "restriction_review_required") {
    return "Public to inspect, but rights, privacy, or export scope still need confirmation.";
  }

  return "Commercially legible, but access still follows request-specific review.";
}

export function getSiteWorldPlainEnglishProof(site: PublicSiteWorldRecord) {
  if (isPublicSampleSiteWorld(site)) {
    return "This listing includes the strongest public proof set: screenshots, sample artifacts, and hosted-path framing.";
  }

  if (isCommercialExemplarSiteWorld(site)) {
    return "This listing is the commercial exemplar: real pricing, listing proof fields, and a clearer path into hosted evaluation or package access.";
  }

  if (getSiteWorldPublicProofSummary(site) === "Listing metadata only") {
    return "This listing currently shows the site, price, and trust fields, but not listing-specific screenshots or export previews.";
  }

  return "This listing includes some public proof assets, but not the full sample-proof set.";
}

export function getSiteWorldPlainEnglishRestrictions(site: PublicSiteWorldRecord) {
  if (site.deploymentReadiness?.recapture_required) {
    return "Refresh work is still part of the commercial conversation for this site.";
  }

  if (hasRestrictionSignals(site)) {
    return "Expect rights, privacy, or export limits to be confirmed in follow-up before access opens.";
  }

  return "Final access still follows the normal request-specific review, even when the listing looks ready.";
}
