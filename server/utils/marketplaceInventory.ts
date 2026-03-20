import type {
  MarketplaceScene,
  SyntheticDataset,
  TrainingDataset,
} from "../../client/src/data/content";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

type InventoryItemType = "scene" | "dataset" | "training";

export type LiveMarketplaceInventoryRecord = {
  id: string;
  sku: string;
  itemType: InventoryItemType;
  item: MarketplaceScene | SyntheticDataset | TrainingDataset;
  searchDoc: string | null;
  embedding: number[] | null;
  status: string | null;
  deliveryMode: string | null;
  fulfillmentStatus: string | null;
  rightsStatus: string | null;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function asEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const embedding = value
    .map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null))
    .filter((item): item is number => item !== null);
  return embedding.length > 0 ? embedding : null;
}

function inferItemType(
  raw: Record<string, unknown>,
  item: Record<string, unknown>,
): InventoryItemType | null {
  const explicit = asString(raw.type) || asString(raw.itemType) || asString(item.type) || asString(item.itemType);
  if (explicit === "scene" || explicit === "dataset" || explicit === "training") {
    return explicit;
  }
  if (item.dataFormat || raw.dataFormat || item.trajectoryLength || raw.trajectoryLength) {
    return "training";
  }
  if (item.sceneCount || raw.sceneCount || item.pricePerScene || raw.pricePerScene) {
    return "dataset";
  }
  if (item.locationType || raw.locationType) {
    return "scene";
  }
  return null;
}

function normalizeScene(
  sku: string,
  raw: Record<string, unknown>,
  item: Record<string, unknown>,
): MarketplaceScene {
  return {
    slug: sku,
    title: asString(raw.title) || asString(item.title) || sku,
    description: asString(raw.description) || asString(item.description) || "",
    thumbnail: asString(raw.thumbnail) || asString(item.thumbnail) || "",
    locationType: asString(raw.locationType) || asString(item.locationType) || "Unknown",
    policySlugs: asStringArray(raw.policySlugs ?? item.policySlugs),
    objectTags: asStringArray(raw.objectTags ?? item.objectTags),
    price: asNumber(raw.price ?? item.price) || 0,
    variationCount: asNumber(raw.variationCount ?? item.variationCount) || undefined,
    episodeCount: asNumber(raw.episodeCount ?? item.episodeCount) || undefined,
    episodesPerVariation: asNumber(raw.episodesPerVariation ?? item.episodesPerVariation) || undefined,
    sceneOnlyPrice: asNumber(raw.sceneOnlyPrice ?? item.sceneOnlyPrice) || undefined,
    episodesOnlyPrice: asNumber(raw.episodesOnlyPrice ?? item.episodesOnlyPrice) || undefined,
    bundlePrice: asNumber(raw.bundlePrice ?? item.bundlePrice) || undefined,
    releaseDate:
      asString(raw.releaseDate) || asString(item.releaseDate) || new Date(0).toISOString(),
    tags: asStringArray(raw.tags ?? item.tags),
    deliverables: asStringArray(raw.deliverables ?? item.deliverables),
    interactions: asStringArray(raw.interactions ?? item.interactions),
    isNew: Boolean(raw.isNew ?? item.isNew),
    isFeatured: Boolean(raw.isFeatured ?? item.isFeatured),
    inStock:
      typeof (raw.inStock ?? item.inStock) === "boolean"
        ? Boolean(raw.inStock ?? item.inStock)
        : true,
  };
}

function normalizeDataset(
  sku: string,
  raw: Record<string, unknown>,
  item: Record<string, unknown>,
): SyntheticDataset {
  return {
    slug: sku,
    title: asString(raw.title) || asString(item.title) || sku,
    description: asString(raw.description) || asString(item.description) || "",
    heroImage: asString(raw.heroImage) || asString(item.heroImage) || "",
    locationType: asString(raw.locationType) || asString(item.locationType) || "Unknown",
    policySlugs: asStringArray(raw.policySlugs ?? item.policySlugs),
    objectTags: asStringArray(raw.objectTags ?? item.objectTags),
    pricePerScene: asNumber(raw.pricePerScene ?? item.pricePerScene) || 0,
    sceneCount: asNumber(raw.sceneCount ?? item.sceneCount) || 1,
    variationCount: asNumber(raw.variationCount ?? item.variationCount) || 1,
    episodeCount: asNumber(raw.episodeCount ?? item.episodeCount) || 0,
    episodesPerVariation: asNumber(raw.episodesPerVariation ?? item.episodesPerVariation) || 0,
    sceneOnlyPrice: asNumber(raw.sceneOnlyPrice ?? item.sceneOnlyPrice) || 0,
    episodesOnlyPrice: asNumber(raw.episodesOnlyPrice ?? item.episodesOnlyPrice) || 0,
    bundlePrice: asNumber(raw.bundlePrice ?? item.bundlePrice) || 0,
    releaseDate:
      asString(raw.releaseDate) || asString(item.releaseDate) || new Date(0).toISOString(),
    tags: asStringArray(raw.tags ?? item.tags),
    randomizerScripts: asStringArray(raw.randomizerScripts ?? item.randomizerScripts),
    deliverables: asStringArray(raw.deliverables ?? item.deliverables),
    isNew: Boolean(raw.isNew ?? item.isNew),
    standardPricePerScene: asNumber(raw.standardPricePerScene ?? item.standardPricePerScene) || undefined,
    isFeatured: Boolean(raw.isFeatured ?? item.isFeatured),
    isTrending: Boolean(raw.isTrending ?? item.isTrending),
  };
}

function normalizeTraining(
  sku: string,
  raw: Record<string, unknown>,
  item: Record<string, unknown>,
): TrainingDataset {
  const price =
    asNumber(raw.price ?? item.price ?? raw.standardPrice ?? item.standardPrice) || 0;
  return {
    slug: sku,
    title: asString(raw.title) || asString(item.title) || sku,
    description: asString(raw.description) || asString(item.description) || "",
    heroImage: asString(raw.heroImage) || asString(item.heroImage) || "",
    locationType: asString(raw.locationType) || asString(item.locationType) || "Unknown",
    policySlugs: asStringArray(raw.policySlugs ?? item.policySlugs),
    objectTags: asStringArray(raw.objectTags ?? item.objectTags),
    qualityScore: asNumber(raw.qualityScore ?? item.qualityScore) || undefined,
    robotModels: asStringArray(raw.robotModels ?? item.robotModels),
    episodeCount: asNumber(raw.episodeCount ?? item.episodeCount) || 0,
    trajectoryLength: asString(raw.trajectoryLength) || asString(item.trajectoryLength) || "Unknown",
    sensorModalities: asStringArray(raw.sensorModalities ?? item.sensorModalities),
    dataFormat: asString(raw.dataFormat) || asString(item.dataFormat) || "Unknown",
    price,
    basicPrice: asNumber(raw.basicPrice ?? item.basicPrice) || undefined,
    standardPrice: asNumber(raw.standardPrice ?? item.standardPrice) || undefined,
    premiumPrice: asNumber(raw.premiumPrice ?? item.premiumPrice) || undefined,
    releaseDate:
      asString(raw.releaseDate) || asString(item.releaseDate) || new Date(0).toISOString(),
    tags: asStringArray(raw.tags ?? item.tags),
    deliverables: asStringArray(raw.deliverables ?? item.deliverables),
    isNew: Boolean(raw.isNew ?? item.isNew),
    isFeatured: Boolean(raw.isFeatured ?? item.isFeatured),
    compatibleWith: asStringArray(raw.compatibleWith ?? item.compatibleWith),
  };
}

function normalizeLiveInventoryRecord(
  id: string,
  raw: Record<string, unknown>,
): LiveMarketplaceInventoryRecord | null {
  const item =
    raw.item && typeof raw.item === "object"
      ? (raw.item as Record<string, unknown>)
      : raw;
  const sku = asString(raw.sku) || asString(item.slug) || id;
  if (!sku) {
    return null;
  }

  const itemType = inferItemType(raw, item);
  if (!itemType) {
    return null;
  }

  const status =
    asString(raw.status) ||
    asString((raw.availability as Record<string, unknown> | undefined)?.status) ||
    "published";
  if (!["published", "active", "available", "ready"].includes(status)) {
    return null;
  }

  const normalizedItem =
    itemType === "scene"
      ? normalizeScene(sku, raw, item)
      : itemType === "dataset"
        ? normalizeDataset(sku, raw, item)
        : normalizeTraining(sku, raw, item);

  return {
    id,
    sku,
    itemType,
    item: normalizedItem,
    searchDoc: asString(raw.searchDoc) || asString(item.searchDoc),
    embedding: asEmbedding(raw.embedding ?? item.embedding),
    status,
    deliveryMode:
      asString(raw.delivery_mode) ||
      asString((raw.fulfillment as Record<string, unknown> | undefined)?.delivery_mode),
    fulfillmentStatus:
      asString(raw.fulfillment_status) ||
      asString((raw.fulfillment as Record<string, unknown> | undefined)?.status),
    rightsStatus:
      asString(raw.rights_status) ||
      asString((raw.rights as Record<string, unknown> | undefined)?.status),
  };
}

export async function loadPublishedMarketplaceInventory(
  limit = 250,
): Promise<LiveMarketplaceInventoryRecord[]> {
  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("marketplace_items")
      .limit(Math.max(1, Math.min(limit, 500)))
      .get();
    return snapshot.docs
      .map((doc) =>
        normalizeLiveInventoryRecord(
          doc.id,
          (doc.data() || {}) as Record<string, unknown>,
        ),
      )
      .filter((record): record is LiveMarketplaceInventoryRecord => Boolean(record));
  } catch {
    return [];
  }
}

export async function findPublishedMarketplaceInventoryBySku(
  sku: string,
): Promise<LiveMarketplaceInventoryRecord | null> {
  const normalizedSku = sku.trim();
  if (!normalizedSku) {
    return null;
  }

  const items = await loadPublishedMarketplaceInventory(250);
  return (
    items.find(
      (item) =>
        item.sku === normalizedSku ||
        normalizedSku.startsWith(`${item.sku}-`),
    ) || null
  );
}
