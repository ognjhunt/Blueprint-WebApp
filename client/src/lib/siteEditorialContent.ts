import { siteWorldCards, type SiteWorldCard, type ThumbnailKind } from "@/data/siteWorlds";
import {
  COMMERCIAL_EXEMPLAR_SITE_WORLD_ID,
  PUBLIC_SAMPLE_SITE_WORLD_ID,
  getSiteWorldCatalogPriority,
} from "@/lib/siteWorldCommercialStatus";

const editorialThumbnailByKind: Record<ThumbnailKind, string> = {
  grocery: "/generated/editorial/grocery-fulfillment.png",
  parcel: "/generated/editorial/cross-dock.png",
  lineSide: "/generated/editorial/manufacturing-plant.png",
  laundry: "/generated/editorial/manufacturing-plant.png",
  coldChain: "/generated/editorial/cold-storage.png",
  returns: "/generated/editorial/cross-dock.png",
  microFulfillment: "/generated/editorial/grocery-fulfillment.png",
  pharmacy: "/generated/editorial/retail-store.png",
  battery: "/generated/editorial/manufacturing-plant.png",
  airport: "/generated/editorial/cross-dock.png",
  hospital: "/generated/editorial/retail-store.png",
  electronics: "/generated/editorial/manufacturing-plant.png",
};

export function getEditorialSiteImage(site: SiteWorldCard) {
  return (
    site.worldLabsPreview?.panoUrl
    || site.worldLabsPreview?.thumbnailUrl
    || editorialThumbnailByKind[site.thumbnailKind]
    || site.runtimeReferenceImageUrl
    || site.presentationReferenceImageUrl
    || "/generated/editorial/world-models-hero.png"
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
    src: "/generated/editorial/world-models-hero.png",
    alt: "Hosted evaluation observation frame",
    time: "00:08",
    title: "Observe",
  },
  {
    src: "/generated/editorial/grocery-fulfillment.png",
    alt: "Hosted evaluation replay frame",
    time: "00:22",
    title: "Replay",
  },
  {
    src: "/generated/editorial/cross-dock.png",
    alt: "Warehouse aisle frame",
    time: "00:36",
    title: "Inspect",
  },
  {
    src: "/generated/editorial/manufacturing-plant.png",
    alt: "Warehouse pallet frame",
    time: "00:48",
    title: "Review",
  },
  {
    src: "/generated/editorial/cold-storage.png",
    alt: "Cross-dock frame",
    time: "01:04",
    title: "Export",
  },
];

export const trustFaqItems = [
  {
    question: "What proof is included with every public world-model listing?",
    answer:
      "Blueprint keeps the site identifier, capture timing, proof depth, and public artifact framing visible. Some listings also include runtime stills, sample manifests, or hosted-path disclosure.",
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
      "That depends on operational drift and the workflow in scope. Blueprint surfaces freshness and recapture signals so the buyer can decide whether the current package is still fit for the question at hand.",
  },
];
