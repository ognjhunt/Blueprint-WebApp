import type { MarketplaceScene, TrainingDataset } from "../data/content";

export type MarketplaceSearchItemType = "all" | "scenes" | "training";

export type MarketplaceSearchSort =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "scene-desc";

export type MarketplaceSearchManualFilters = {
  itemType?: MarketplaceSearchItemType;
  locationType?: string | null;
  policySlug?: string | null;
  objectTags?: string[];
  sort?: MarketplaceSearchSort;
  page?: number;
};

export type MarketplaceSearchRequest = {
  q: string;
  limit?: number;
  manualFilters?: MarketplaceSearchManualFilters;
  ignoreParsedKeys?: string[];
};

export type MarketplaceSearchChip = {
  key: string;
  label: string;
  value: string;
};

export type MarketplaceSearchResult = {
  type: "scene" | "training";
  item: MarketplaceScene | TrainingDataset;
  score: number;
  distance?: number | null;
  reasons: string[];
};

export type MarketplaceSearchResponse = {
  results: MarketplaceSearchResult[];
  parsed: {
    hard: Record<string, unknown>;
    soft: Record<string, unknown>;
    chips: MarketplaceSearchChip[];
    warnings: string[];
  };
  applied: {
    manual: MarketplaceSearchManualFilters;
    parsed: Record<string, unknown>;
  };
  meta: {
    backend: "firestore-vector" | "static-inmemory";
    embeddingModel: string;
  };
};

