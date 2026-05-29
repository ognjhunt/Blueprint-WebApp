export type InteractionType =
  | "revolute"
  | "prismatic"
  | "pickable"
  | "button"
  | "knob"
  | "switch";

export interface Interaction {
  component: string;
  type: InteractionType;
  axis: string;
  limits: string;
  notes?: string;
}

export interface Scene {
  title: string;
  slug: string;
  thumb: string;
  gallery: string[];
  categories: string[];
  tags: string[];
  usdVersion: string;
  units: string;
  materials: string;
  interactions: Interaction[];
  colliders: string;
  replicator?: string;
  testedWith: string;
  leadTime: string;
  download?: string;
  ctaText: string;
  seo: string;
  highlights: string[];
}

export interface EnvironmentCategory {
  title: string;
  slug: string;
  heroImage: string;
  summary: string;
  tags: string[];
  scenes: string[];
}

export interface EnvironmentPolicy {
  slug: string;
  title: string;
  focus: string;
  cadence: string;
  summary: string;
  coverage: string[];
  metric?: string;
  environments: string[];
}

export interface SyntheticDataset {
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  pricePerScene: number;
  sceneCount: number;
  variationCount: number;
  // Episode data - AI-generated trajectories for each variation
  episodeCount: number;
  episodesPerVariation: number;
  // Pricing options
  sceneOnlyPrice: number; // Price for just scene + variations (no episodes)
  episodesOnlyPrice: number; // Price for just episodes (requires owning scene)
  bundlePrice: number; // Discounted price for scene + episodes together
  releaseDate: string;
  tags: string[];
  randomizerScripts: string[];
  deliverables: string[];
  isNew?: boolean;
  standardPricePerScene?: number; // For showing discount
  isFeatured?: boolean;
  isTrending?: boolean;
}

// Individual scene product for marketplace
export interface MarketplaceScene {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  price: number; // Individual scene price (legacy, use sceneOnlyPrice for new pricing)
  variationCount?: number;
  // Episode data - AI-generated trajectories for each variation
  episodeCount?: number;
  episodesPerVariation?: number;
  // Pricing options
  sceneOnlyPrice?: number; // Price for just scene + variations (no episodes)
  episodesOnlyPrice?: number; // Price for just episodes (requires owning scene)
  bundlePrice?: number; // Discounted price for scene + episodes together
  releaseDate: string;
  tags: string[];
  deliverables: string[];
  interactions?: string[]; // e.g., ["Revolute doors", "Prismatic drawers"]
  isNew?: boolean;
  isFeatured?: boolean;
  inStock?: boolean;
}

// Union type for marketplace items
export type MarketplaceItem =
  | (SyntheticDataset & { itemType: 'dataset' })
  | (MarketplaceScene & { itemType: 'scene' });

// Training dataset packs - pre-generated episode trajectories for offline training
export interface TrainingDataset {
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  // Quality & compatibility metadata (used for semantic search + filtering)
  qualityScore?: number; // 0.0 - 1.0
  robotModels?: string[]; // e.g., ["Franka", "UR5"]
  // Episode counts
  episodeCount: number;
  trajectoryLength: string; // e.g., "50-200 steps"
  // Data format details
  sensorModalities: string[];
  dataFormat: string; // e.g., "LeRobot", "HDF5", etc.
  // Pricing - 3-tier system
  price: number; // Base/standard price (kept for backward compatibility)
  basicPrice?: number; // Tier 1: Core data + basic analytics
  standardPrice?: number; // Tier 2: Full dataset + all default analytics
  premiumPrice?: number; // Tier 3: Full dataset + all analytics + extended support
  releaseDate: string;
  tags: string[];
  deliverables: string[];
  isNew?: boolean;
  isFeatured?: boolean;
  // Compatibility
  compatibleWith: string[]; // VLA models this works with
}

export interface SceneRecipe {
  slug: string;
  title: string;
  description: string;
  locationType: string;
  policySlugs: string[];
  requiredPacks: string[];
  usdLayers: string[];
  domainRandomization: string[];
  deliverables: string[];
  heroImage: string;
  tags: string[];
  priceRange: string;
}

export interface CaseStudy {
  title: string;
  slug: string;
  summary: string;
  hero: string;
  body: string;
  outcomes: string[];
  cta: string;
}

export interface Job {
  title: string;
  type: string;
  location: string;
  summary: string;
  description: string;
  applyEmail: string;
}

// ============================================================================
// HYBRID MARKETPLACE MODEL - License Tiers, Exclusivity, and Trust Artifacts
// ============================================================================

// License tier types for marketplace products
export type LicenseTier = 'research' | 'commercial' | 'enterprise';

export interface LicenseTierConfig {
  tier: LicenseTier;
  name: string;
  shortName: string;
  description: string;
  priceMultiplier: number; // 1.0 = base price, 1.5 = 50% more, etc.
  features: string[];
  restrictions: string[];
  supportLevel: string;
  deploymentRights: string;
}

// Exclusivity options for datasets
export type ExclusivityType = 'non-exclusive' | 'time-limited' | 'category' | 'semi-exclusive' | 'full-exclusive';

export interface ExclusivityOption {
  type: ExclusivityType;
  name: string;
  shortName: string;
  description: string;
  priceMultiplier: number;
  duration?: string; // For time-limited
  scope?: string; // For category exclusivity
  maxLicenses?: number; // For semi-exclusive
}

// Provenance and trust artifact types
export interface DatasetProvenance {
  version: string;
  releaseDate: string;
  lastUpdated: string;
  changelog?: string[];
  dataSource: 'synthetic' | 'real-world' | 'hybrid';
  generationMethod: string;
  qualityValidation: string[];
  knownLimitations: string[];
  recommendedUseCases: string[];
  notRecommendedFor?: string[];
}

export interface DatasheetInfo {
  // What's inside
  totalAssets: number;
  assetTypes: string[];
  fileFormats: string[];
  totalSizeGB?: number;

  // Generation details
  simulationPlatform: string;
  physicsEngine: string;
  renderingPipeline: string;

  // Quality metrics
  physicsAccuracy: string;
  visualFidelity: string;
  semanticCompleteness: string;

  // Compatibility
  testedPlatforms: string[];
  knownIssues?: string[];

  // Rights and provenance
  provenance: DatasetProvenance;
  licenseTerms: string;
  attributionRequired: boolean;
  redistributionAllowed: boolean;
}
