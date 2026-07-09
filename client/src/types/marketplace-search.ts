import type { MarketplaceScene, TrainingDataset } from "../data/content";

export type MarketplaceSearchItemType =
  | "all"
  | "scenes"
  | "training"
  | "task_eval_runs"
  | "data_packages";

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

export type CommissionedMarketplaceOutput = {
  slug: string;
  title: string;
  description: string;
  itemType: "task_eval_run" | "post_training_data_package";
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  tags: string[];
  deliverables: string[];
  releaseDate: string;
  requestPath: "hosted-review" | "data-package";
  requestUrl: string;
  priceLabel: string;
  proofBoundary: string;
};

export type MarketplaceSearchResult = {
  type: "scene" | "training" | "commissioned_output";
  item: MarketplaceScene | TrainingDataset | CommissionedMarketplaceOutput;
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
    backend: "firestore-vector" | "firestore-live" | "static-inmemory";
    embeddingModel: string;
  };
};
