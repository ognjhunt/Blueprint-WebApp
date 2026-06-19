import type {
  DatasheetInfo,
  ExclusivityOption,
  ExclusivityType,
  LicenseTier,
  LicenseTierConfig,
} from "./types";

// License tier configurations
export const licenseTiers: LicenseTierConfig[] = [
  {
    tier: 'research',
    name: 'Research License',
    shortName: 'Research',
    description: 'For academic research, internal R&D, and non-commercial evaluation',
    priceMultiplier: 0.6,
    features: [
      'Full dataset access',
      'Academic publication rights',
      'Internal evaluation and benchmarking',
      'Integration with research pipelines',
    ],
    restrictions: [
      'Non-commercial use only',
      'No deployment in production systems',
      'Attribution required in publications',
      'Cannot sublicense or redistribute',
    ],
    supportLevel: 'Community + documentation',
    deploymentRights: 'Internal R&D only',
  },
  {
    tier: 'commercial',
    name: 'Commercial License',
    shortName: 'Commercial',
    description: 'For product development, internal deployment, and commercial applications',
    priceMultiplier: 1.0,
    features: [
      'Full dataset access',
      'Commercial product development',
      'Internal deployment rights',
      'Model training and fine-tuning',
      'Priority support (email)',
    ],
    restrictions: [
      'Single organization use',
      'Cannot sublicense or redistribute',
      'Standard indemnification',
    ],
    supportLevel: 'Priority email support',
    deploymentRights: 'Internal commercial deployment',
  },
  {
    tier: 'enterprise',
    name: 'Enterprise License',
    shortName: 'Enterprise',
    description: 'For large-scale deployment, custom terms, and enhanced support',
    priceMultiplier: 2.5,
    features: [
      'Full dataset access',
      'Unlimited internal deployment',
      'Custom integration support',
      'Dedicated account manager',
      'SLA guarantees',
      'On-premise delivery option',
      'Custom data format conversion',
      'Priority feature requests',
    ],
    restrictions: [
      'Custom terms negotiable',
      'Extended indemnification available',
    ],
    supportLevel: 'Dedicated Slack channel + account manager',
    deploymentRights: 'Unlimited internal + negotiable external',
  },
];

// Exclusivity options configuration
export const exclusivityOptions: ExclusivityOption[] = [
  {
    type: 'non-exclusive',
    name: 'Non-Exclusive (Standard)',
    shortName: 'Standard',
    description: 'Dataset available to all buyers. Best value for most use cases.',
    priceMultiplier: 1.0,
  },
  {
    type: 'time-limited',
    name: '90-Day Head Start',
    shortName: '90-Day Exclusive',
    description: 'Exclusive access for 90 days before public availability.',
    priceMultiplier: 2.0,
    duration: '90 days',
  },
  {
    type: 'category',
    name: 'Category Exclusivity',
    shortName: 'Category Lock',
    description: 'Exclusive within your industry vertical (e.g., warehouse AMR, home assistive).',
    priceMultiplier: 3.0,
    scope: 'Industry vertical',
  },
  {
    type: 'semi-exclusive',
    name: 'Limited Availability',
    shortName: 'Limited (3 seats)',
    description: 'Maximum 3 total licenses sold for this dataset.',
    priceMultiplier: 1.75,
    maxLicenses: 3,
  },
  {
    type: 'full-exclusive',
    name: 'Full Exclusivity',
    shortName: 'Exclusive',
    description: 'You are the only licensee. Dataset removed from marketplace.',
    priceMultiplier: 10.0,
  },
];

// Default datasheet template for scenes
export const defaultSceneDatasheet: Partial<DatasheetInfo> = {
  simulationPlatform: 'NVIDIA Isaac Sim 4.x / 5.x',
  physicsEngine: 'PhysX 5.x',
  renderingPipeline: 'RTX Path Tracing',
  physicsAccuracy: 'Sub-cm collision accuracy, validated articulation limits',
  visualFidelity: 'PBR materials, 4K textures, HDR lighting',
  semanticCompleteness: 'Full semantic labels for all manipulable objects',
  licenseTerms: 'Standard Blueprint License Agreement',
  attributionRequired: false,
  redistributionAllowed: false,
};

// Default datasheet template for training datasets
export const defaultDatasetDatasheet: Partial<DatasheetInfo> = {
  simulationPlatform: 'NVIDIA Isaac Sim 4.x / Genie Sim 3.0',
  physicsEngine: 'PhysX 5.x',
  renderingPipeline: 'RTX Path Tracing',
  physicsAccuracy: 'Compared against supplied capture/reference data',
  visualFidelity: 'Multi-view RGB-D, consistent camera calibration',
  semanticCompleteness: 'Full action annotations, language descriptions',
  licenseTerms: 'Standard Blueprint License Agreement',
  attributionRequired: false,
  redistributionAllowed: false,
};

// Helper function to calculate license price
export function calculateLicensePrice(basePrice: number, licenseTier: LicenseTier): number {
  const tier = licenseTiers.find(t => t.tier === licenseTier);
  return Math.round(basePrice * (tier?.priceMultiplier || 1.0));
}

// Helper function to calculate exclusivity price
export function calculateExclusivityPrice(basePrice: number, exclusivityType: ExclusivityType): number {
  const option = exclusivityOptions.find(o => o.type === exclusivityType);
  return Math.round(basePrice * (option?.priceMultiplier || 1.0));
}

// Helper function to calculate total price with license and exclusivity
export function calculateTotalPrice(
  basePrice: number,
  licenseTier: LicenseTier,
  exclusivityType: ExclusivityType = 'non-exclusive'
): number {
  const licensePrice = calculateLicensePrice(basePrice, licenseTier);
  return calculateExclusivityPrice(licensePrice, exclusivityType);
}
