/**
 * Type definitions for advanced analytics modules
 */

// ============================================================================
// SYNTHETIC DATASET LICENSING
// ============================================================================

export interface DatasetConfig {
  datasetId: string;
  name: string;
  description: string;
  dataTypes: ("video" | "trajectory" | "contacts" | "composite")[];
  taskConfigs: string[];
  taskDifficulty: "easy" | "medium" | "hard" | "mixed";
  domainRandomizationParams: Record<string, unknown>;
  samplesPerMonth: number;
  qualityFilters: QualityFilter[];
  stratificationStrategy?: StratificationConfig;
}

export interface QualityFilter {
  name: string;
  threshold: number;
  metricType: "contact_stability" | "sensor_noise" | "trajectory_smoothness" | "physics_validity";
}

export interface StratificationConfig {
  byDifficulty: boolean;
  byObjectType: boolean;
  byTaskVariant: boolean;
  failureMode?: string;
}

export interface SyntheticDatasetLicense {
  licenseId: string;
  customerId: string;
  datasetId: string;
  tier: "single" | "multi-type" | "enterprise";
  monthlyPrice: number;
  startDate: Date;
  endDate?: Date;
  samplesGenerated: number;
  lastGenerated: Date;
  apiKey?: string;
  dataFormats: ("h5" | "zarr" | "parquet" | "tfrecord")[];
}

export interface DatasetMetrics {
  totalSamplesGenerated: number;
  uniqueSceneVariations: number;
  averageQualityScore: number; // 0-100
  labelCoverage: string[];
  domainRandomizationCoverage: Record<string, [min: number, max: number]>;
  lastUpdated: Date;
}

// ============================================================================
// ROBUSTNESS & STRESS TESTING
// ============================================================================

export interface RobustnessTestConfig {
  policyId: string;
  testName: string;
  scenarioCount: number;
  perturbationDimensions: PerturbationDimension[];
  fixedSeeds: boolean;
  seedValues?: number[];
  timeoutPerEpisode: number; // milliseconds
}

export type PerturbationDimension =
  | "physics_friction"
  | "physics_mass"
  | "physics_damping"
  | "physics_gravity"
  | "sensor_camera_calibration"
  | "sensor_depth_noise"
  | "sensor_proprioception_bias"
  | "sensor_force_saturation"
  | "control_latency"
  | "environment_material"
  | "environment_geometry"
  | "environment_lighting"
  | "gripper_wear"
  | "combined_adversarial";

export interface PerturbationScenario {
  scenarioId: string;
  dimension: PerturbationDimension;
  baselineValue: number;
  perturbationMagnitude: number; // percentage from baseline
  description: string;
}

export interface RobustnessTestResult {
  testId: string;
  policyId: string;
  totalScenarios: number;
  successCount: number;
  failureCount: number;
  successRate: number; // 0-100
  results: {
    scenario: PerturbationScenario;
    success: boolean;
    reward: number;
    failureMode?: string;
    confidence95: [lower: number, upper: number];
  }[];
  toleranceCurves: ToleranceCurve[];
  safetyMargins: SafetyMargin[];
  riskStratification: RiskLevel[];
  timestamp: Date;
}

export interface ToleranceCurve {
  dimension: PerturbationDimension;
  xAxisValues: number[]; // perturbation magnitude
  yAxisValues: number[]; // success rate
  criticalThreshold: number;
  confidenceBands: [lower: number[], upper: number[]];
}

export interface SafetyMargin {
  dimension: PerturbationDimension;
  maxSafeDeviation: number;
  failureThreshold: number;
  confidenceLevel: number; // 0-1, typically 0.95
}

export interface RiskLevel {
  scenarioId: string;
  riskCategory: "high" | "medium" | "low";
  deploymentRecommendation: "fail" | "conditional" | "pass";
  mitigationSuggestions: string[];
}

// ============================================================================
// POLICY INTERPRETABILITY
// ============================================================================

export interface InterpretabilityConfig {
  policyId: string;
  techniques: InterpretabilityTechnique[];
  episodeSelectionStrategy: "best" | "worst" | "random" | "diverse";
  episodeCount: number;
  visualizationTypes: ("heatmap" | "attention_map" | "decision_tree" | "activation" | "video_overlay")[];
}

export type InterpretabilityTechnique =
  | "shapley_values"
  | "activation_maps"
  | "decision_trees"
  | "reward_attribution"
  | "attention_maps"
  | "counterfactual"
  | "learning_dynamics"
  | "failure_analysis";

export interface InterpretabilityResult {
  resultId: string;
  policyId: string;
  techniques: {
    technique: InterpretabilityTechnique;
    data: FeatureImportance | ActivationMap | DecisionTree | RewardAttribution | AttentionMap | CounterfactualAnalysis | LearningDynamics | FailureAnalysis;
  }[];
  overallExplainability: {
    score: number; // 0-100
    topFactors: string[];
    keyInsights: string[];
  };
  reportUrl: string;
  timestamp: Date;
}

export interface FeatureImportance {
  type: "shapley";
  globalImportance: Record<string, number>; // feature name -> importance score
  perTimestepImportance: {
    timestep: number;
    importance: Record<string, number>;
  }[];
  interactions: { feature1: string; feature2: string; strength: number }[];
}

export interface ActivationMap {
  type: "activation";
  layerActivations: {
    layerName: string;
    neuronActivations: number[][];
    importantNeurons: { neuronId: number; importance: number }[];
  }[];
  taskPhaseSpecific: {
    phase: string;
    activationPattern: number[];
  }[];
}

export interface DecisionTree {
  type: "decision_tree";
  treeDepth: number;
  nodeCount: number;
  rules: {
    condition: string;
    action: string;
    frequency: number;
  }[];
  ruleExportFormat: "python" | "pseudocode" | "json";
}

export interface RewardAttribution {
  type: "reward_attribution";
  rewardComponents: {
    component: string;
    weight: number;
    contribution: number;
  }[];
  temporalAttribution: {
    timestep: number;
    componentContributions: Record<string, number>;
  }[];
}

export interface AttentionMap {
  type: "attention";
  spatialAttention: {
    timestep: number;
    attentionMap: number[][];
    focusRegions: { x: number; y: number; size: number }[];
  }[];
  temporalAttention: {
    targetTimestep: number;
    attentionToHistoryTimesteps: Record<number, number>;
  }[];
}

export interface CounterfactualAnalysis {
  type: "counterfactual";
  interventions: {
    observation: string;
    baselineValue: number;
    counterfactualValue: number;
    actionChange: number;
    sensitivity: number;
  }[];
  wouldHaveChanged: {
    intervention: string;
    probability: number;
  }[];
}

export interface LearningDynamics {
  type: "learning_dynamics";
  epochProgression: {
    epoch: number;
    policyChangeMagnitude: number;
    featureImportanceShift: Record<string, number>;
    strategyChange: string;
  }[];
  convergenceAnalysis: {
    converged: boolean;
    convergenceEpoch?: number;
    stabilityScore: number;
  };
}

export interface FailureAnalysis {
  type: "failure_analysis";
  failureClusters: {
    clusterId: number;
    failureMode: string;
    frequency: number;
    rootCauses: string[];
  }[];
  failurePaths: {
    failureMode: string;
    decisionSequence: string[];
    wrongDecisionPoint: number;
  }[];
}

// ============================================================================
// REAL-TO-SIM CALIBRATION
// ============================================================================

export interface CalibrationJob {
  jobId: string;
  robotId: string;
  robotModel: string;
  startDate: Date;
  estimatedEndDate: Date;
  status: "pending" | "in_progress" | "completed" | "failed";
  testSequencesRun: number;
  testSequencesTotal: number;
}

export interface CalibrationParameters {
  kinematics: {
    jointRanges: { joint: string; min: number; max: number; actualMin?: number; actualMax?: number }[];
    friction: Record<string, { static: number; kinetic: number }>;
    stiction: Record<string, number>;
    backlash: Record<string, number>;
  };
  dynamics: {
    linkMasses: Record<string, number>;
    centerOfMass: Record<string, [x: number, y: number, z: number]>;
    inertias: Record<string, [[number, number, number], [number, number, number], [number, number, number]]>;
  };
  endEffector: {
    toolMass: number;
    toolCenterOfGravity: [x: number, y: number, z: number];
    gripperForceProfile: { command: number; actualForce: number }[];
    gripperSpeedProfile: { speed: number }[];
    contactCompliance: number;
  };
  sensors: {
    cameraIntrinsics?: {
      fx: number;
      fy: number;
      cx: number;
      cy: number;
      k1?: number;
      k2?: number;
    };
    depthNoise: { mean: number; stdDev: number };
    imuBias: { accelBias: [number, number, number]; gyroBias: [number, number, number] };
    jointEncoderOffsets: Record<string, number>;
  };
  contact: {
    frictionCoefficients: Record<string, number>;
    compliance: number;
    damping: number;
    restitution: number;
  };
  control: {
    motorTorqueCurrent: { current: number; torque: number }[];
    motorResponseTime: number; // milliseconds
    controlLoopLatency: number; // milliseconds
    positionControlPID: { kp: number; ki: number; kd: number };
  };
}

export interface CalibrationValidation {
  accuracy: number; // 0-100, percentage match to real robot
  validationTests: {
    testName: string;
    simValue: number;
    realValue: number;
    error: number;
    percentError: number;
  }[];
  qualityScore: number; // 0-100
  deviationsFromCAD: {
    parameter: string;
    cadValue: number;
    measuredValue: number;
    percentDifference: number;
  }[];
  recommendations: string[];
}

export interface CalibrationReport {
  reportId: string;
  jobId: string;
  parameters: CalibrationParameters;
  validation: CalibrationValidation;
  generatedFiles: {
    urdfPath: string;
    parameterJsonPath: string;
    reportPdfPath: string;
  };
  timestamp: Date;
}

// ============================================================================
// MULTI-POLICY COMPARISON
// ============================================================================

export interface PolicyComparisonConfig {
  comparisonId: string;
  policyIds: string[];
  comparisonTypes: ComparisonType[];
  testScenarios: string[]; // fixed seeds
  computeTimePerPolicy: number; // hours
  statisticalSignificanceLevel: number; // 0.05 for 95%
}

export type ComparisonType =
  | "algorithm"
  | "hyperparameter_sensitivity"
  | "ablation_study"
  | "architecture"
  | "cross_embodiment"
  | "sim_to_real_gap";

export interface ComparisonResult {
  comparisonId: string;
  policyComparisons: {
    policyPair: [string, string];
    successRateDifference: number;
    confidenceInterval: [lower: number, upper: number];
    pValue: number;
    significantDifference: boolean;
  }[];
  performanceMetrics: {
    policyId: string;
    successRate: number;
    episodeReturn: number;
    learningEfficiency: number;
    taskVariantScores: Record<string, number>;
  }[];
  sensitivityAnalysis?: {
    parameterName: string;
    rangeTestedValues: number[];
    performanceCurve: number[];
    optimalValue: number;
    sensitivityScore: number; // how much this parameter affects performance
  }[];
  ablationStudy?: {
    componentName: string;
    performanceWithComponent: number;
    performanceWithoutComponent: number;
    contribution: number;
    essential: boolean;
  }[];
  recommendations: {
    winningPolicy: string;
    marginOfVictory: number;
    criticalDifferences: string[];
    deploymentRecommendation: string;
  };
  timestamp: Date;
}

export interface StatisticalAnalysis {
  methodUsed: "t_test" | "bootstrap" | "bayesian";
  confidenceLevel: number; // 0.95 for 95%
  sampleSizePerPolicy: number;
  effectSize: number; // Cohen's d or similar
  powerAnalysis: {
    power: number;
    minimumSampleSize: number;
  };
}

// ============================================================================
// SHARED/COMMON TYPES
// ============================================================================

export interface AnalyticsModule {
  moduleId: string;
  name: string;
  type: "data_validation" | "dataset_licensing" | "robustness" | "explainability" | "calibration" | "benchmarking";
  status: "available" | "processing" | "completed" | "error";
  blueprintId: string;
  createdAt: Date;
  updatedAt: Date;
  results?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AnalyticsSubscription {
  subscriptionId: string;
  customerId: string;
  moduleTypes: AnalyticsModule["type"][];
  tier: "professional" | "enterprise";
  startDate: Date;
  renewalDate: Date;
  autoRenew: boolean;
  monthlyPrice: number;
  activeAddOns: string[]; // e.g., "robustness-testing", "policy-interpretability"
}
