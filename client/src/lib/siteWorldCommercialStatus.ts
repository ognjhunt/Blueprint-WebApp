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

export type SiteWorldStatusBadge = {
  id: string;
  label: string;
  summary: string;
  tone: string;
};

export type SiteWorldHostedAccessDisclosure = {
  label: string;
  summary: string;
  launchVerified: boolean;
};

export const siteWorldStatusLegend: SiteWorldStatusBadge[] = [
  {
    id: "public_demo",
    label: "Public demo",
    summary: "A public sample listing you can inspect without treating it as a customer claim.",
    tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  {
    id: "commercial_exemplar",
    label: "Commercial exemplar",
    summary: "A commercial listing with clear pricing, proof fields, and request-scoped follow-up.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    id: "listing_metadata",
    label: "Listing metadata only",
    summary: "The public page shows site and pricing metadata, but not listing-specific exports.",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    id: "request_scoped_proof",
    label: "Request-scoped proof",
    summary: "More proof can open after rights, privacy, and buyer context are reviewed.",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    id: "hosted_request_gated",
    label: "Hosted request-gated",
    summary:
      "The hosted path is a commercial next step, but live launch still depends on entitlement, account type, and runtime readiness.",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
  },
  {
    id: "package_request_gated",
    label: "Package request-gated",
    summary: "Package access follows the normal request-specific rights and export review.",
    tone: "border-stone-200 bg-stone-100 text-stone-700",
  },
];

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
        "This listing shows a real captured sample, example files, and hosted-review request previews.",
      buyerNote:
        "The public demo lets you inspect the sample listing. It does not grant blanket facility approval or unrestricted commercial use for future requests.",
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
      "The listing is ready for buyer review with visible proof, export signals, and hosted-request disclosure, but final access still follows the request-specific rights and privacy review.",
    buyerNote:
      "This is a commercial review status, not a deployment guarantee or blanket approval statement for the underlying facility.",
  };
}

export function getSiteWorldProofDepth(site: PublicSiteWorldRecord) {
  if (isPublicSampleSiteWorld(site)) return "Public demo + current public proof assets";
  if (isCommercialExemplarSiteWorld(site)) return "Commercial exemplar with listing proof fields + request-scoped hosted request path";
  if (site.worldLabsPreview?.launchUrl) return "Listing + hosted request path disclosure + fallback preview";
  if (site.deploymentReadiness?.native_world_model_primary) return "Listing + hosted request path disclosure";
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

export function getSiteWorldStatusBadges(site: PublicSiteWorldRecord): SiteWorldStatusBadge[] {
  const badges: SiteWorldStatusBadge[] = [];
  if (isPublicSampleSiteWorld(site)) {
    badges.push(siteWorldStatusLegend[0] as SiteWorldStatusBadge);
  } else if (isCommercialExemplarSiteWorld(site)) {
    badges.push(siteWorldStatusLegend[1] as SiteWorldStatusBadge);
  }

  if (getSiteWorldPublicProofSummary(site) === "Listing metadata only") {
    badges.push(siteWorldStatusLegend[2] as SiteWorldStatusBadge);
  } else {
    badges.push(siteWorldStatusLegend[3] as SiteWorldStatusBadge);
  }

  badges.push(
    siteWorldStatusLegend[4] as SiteWorldStatusBadge,
    siteWorldStatusLegend[5] as SiteWorldStatusBadge,
  );
  return badges.filter(Boolean);
}

export function getSiteWorldReadinessDisclosure(site: PublicSiteWorldRecord) {
  const parts = [
    "This public listing proves what Blueprint is ready to show a buyer now.",
    "It is not a deployment guarantee and does not claim site-operator blanket approval or unrestricted rights.",
    "Hosted launch is checked separately against entitlement, account type, runtime readiness, and production configuration.",
  ];

  if (site.deploymentReadiness?.export_readiness_status === "ready") {
    parts.unshift("Exports are documented on this listing.");
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
    return "Best public sample to start with if you are new to Blueprint.";
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
    return "This listing includes screenshots, sample files, and a hosted-review request path.";
  }

  if (isCommercialExemplarSiteWorld(site)) {
    return "This listing is the commercial exemplar: real pricing, listing proof fields, and a clearer path into hosted evaluation request or package access.";
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

export function getSiteWorldHostedAccessDisclosure(
  site: PublicSiteWorldRecord,
): SiteWorldHostedAccessDisclosure {
  if (
    site.presentationDemoReadiness?.launchable
    && site.presentationDemoReadiness.status === "presentation_ui_live"
  ) {
    return {
      label: "Hosted demo verified",
      summary:
        "The public listing has a launchable presentation demo, while runtime sessions still check entitlement and backend readiness at setup.",
      launchVerified: true,
    };
  }

  if (site.worldLabsPreview?.launchUrl) {
    return {
      label: "Interactive preview ready",
      summary:
        "An optional provider preview is ready. The hosted evaluation still starts through the protected setup and readiness check.",
      launchVerified: false,
    };
  }

  if (site.deploymentReadiness?.native_world_model_primary) {
    return {
      label: "Hosted request path",
      summary:
        "The listing can support a hosted evaluation request, but the setup page must verify account access and runtime readiness before launch.",
      launchVerified: false,
    };
  }

  return {
    label: "Hosted request-gated",
    summary:
      "Hosted evaluation is request-gated until site-world artifacts, entitlement, and runtime readiness are verified.",
    launchVerified: false,
  };
}
