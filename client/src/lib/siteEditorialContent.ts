import {
  siteWorldCards,
  type SiteWorldCard,
  type ThumbnailKind,
} from "@/data/siteWorlds";
import {
  COMMERCIAL_EXEMPLAR_SITE_WORLD_ID,
  PUBLIC_SAMPLE_SITE_WORLD_ID,
  getSiteWorldCatalogPriority,
} from "@/lib/siteWorldCommercialStatus";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";

const editorialThumbnailByKind: Record<ThumbnailKind, string> = {
  grocery: humanoidReadinessAssets.groceryTask,
  parcel: humanoidReadinessAssets.loadingDock,
  lineSide: humanoidReadinessAssets.manufacturing,
  laundry: humanoidReadinessAssets.manufacturing,
  coldChain: humanoidReadinessAssets.coldStorage,
  returns: humanoidReadinessAssets.loadingDock,
  microFulfillment: humanoidReadinessAssets.groceryTask,
  pharmacy: humanoidReadinessAssets.groceryTask,
  battery: humanoidReadinessAssets.manufacturing,
  airport: humanoidReadinessAssets.loadingDock,
  hospital: humanoidReadinessAssets.groceryTask,
  electronics: humanoidReadinessAssets.manufacturing,
};

export function getEditorialSiteImage(site: SiteWorldCard) {
  return (
    site.worldLabsPreview?.panoUrl ||
    site.worldLabsPreview?.thumbnailUrl ||
    editorialThumbnailByKind[site.thumbnailKind] ||
    site.runtimeReferenceImageUrl ||
    site.presentationReferenceImageUrl ||
    humanoidReadinessAssets.warehouseHero
  );
}

export function getEditorialSiteLocation(site: SiteWorldCard) {
  const segments = site.siteAddress
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    return segments.slice(-2).join(", ");
  }
  return site.siteAddress;
}

function sortCatalog(sites: SiteWorldCard[]) {
  return [...sites].sort((left, right) => {
    const priorityDelta =
      getSiteWorldCatalogPriority(left) - getSiteWorldCatalogPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return left.siteName.localeCompare(right.siteName);
  });
}

export function getEditorialFeaturedSites(
  sites: SiteWorldCard[] = siteWorldCards,
  count = 4,
) {
  const sorted = sortCatalog(sites);
  const preferredIds = [
    PUBLIC_SAMPLE_SITE_WORLD_ID,
    COMMERCIAL_EXEMPLAR_SITE_WORLD_ID,
  ];
  const chosen: SiteWorldCard[] = [];

  preferredIds.forEach((id) => {
    const match = sorted.find((site) => site.id === id);
    if (match) chosen.push(match);
  });

  sorted.forEach((site) => {
    if (chosen.length >= count) return;
    if (!chosen.some((existing) => existing.id === site.id)) {
      chosen.push(site);
    }
  });

  return chosen.slice(0, count);
}

export function getEditorialMoreSites(
  sites: SiteWorldCard[] = siteWorldCards,
  count = 5,
  excludeIds: string[] = [],
) {
  const excluded = new Set(excludeIds);
  return sortCatalog(sites)
    .filter((site) => !excluded.has(site.id))
    .slice(0, count);
}

export const hostedFilmstripFrames = [
  {
    src: humanoidReadinessAssets.warehouseHero,
    alt: "Hosted evaluation observation frame",
    time: "00:08",
    title: "Observe",
  },
  {
    src: humanoidReadinessAssets.groceryTask,
    alt: "Hosted evaluation replay frame",
    time: "00:22",
    title: "Replay",
  },
  {
    src: humanoidReadinessAssets.loadingDock,
    alt: "Warehouse aisle frame",
    time: "00:36",
    title: "Inspect",
  },
  {
    src: humanoidReadinessAssets.manufacturing,
    alt: "Warehouse pallet frame",
    time: "00:48",
    title: "Review",
  },
  {
    src: humanoidReadinessAssets.coldStorage,
    alt: "Cross-dock frame",
    time: "01:04",
    title: "Export",
  },
];

export const trustFaqItems = [
  {
    question: "What proof is included with every public world-model listing?",
    answer:
      "Blueprint keeps the site identifier, capture timing, proof depth, and public proof details visible. Some listings also include hosted stills, sample manifests, or hosted-path disclosure.",
  },
  {
    question: "Who owns the data and the world model?",
    answer:
      "Ownership and export scope stay attached to the site record and any request-specific review. Public listing visibility does not imply blanket transfer of rights.",
  },
  {
    question: "Can we restrict access within our organization?",
    answer:
      "Yes. Hosted access and package release remain entitlement-controlled and can stay limited to the named buyer team and approved collaborators.",
  },
  {
    question: "How often do we recapture a site?",
    answer:
      "That depends on operational drift and the workflow in scope. Blueprint shows freshness and recapture signals so the buyer can decide whether the current package is still fit for the question at hand.",
  },
];
