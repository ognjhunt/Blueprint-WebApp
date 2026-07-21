import type { EvaluationReadinessSummary } from "../types/inbound-request";
import type {
  ArtifactExplorerSummary,
  RobotProfile,
  RuntimeManifestSummary,
  ScenarioCatalogEntry,
  StartStateCatalogEntry,
  TaskCatalogEntry,
} from "@/types/hostedSession";

/**
 * Shared site-world API types.
 *
 * Public inventory must come from the Pipeline/Firestore owner records. This
 * module intentionally contains no sample sites, addresses, prices, readiness
 * labels, or fallback catalog: keeping those beside runtime types previously
 * made fabricated supply easy to ship by accident.
 */
export type SiteCategory =
  | "All"
  | "Retail"
  | "Logistics"
  | "Manufacturing"
  | "Service"
  | "Cold Chain"
  | "Healthcare";

export type ThumbnailKind =
  | "grocery"
  | "parcel"
  | "lineSide"
  | "laundry"
  | "coldChain"
  | "returns"
  | "microFulfillment"
  | "pharmacy"
  | "battery"
  | "airport"
  | "hospital"
  | "electronics";

export type SiteWorldPackageName = "Site Package" | "Policy Evaluation Set";

export type SiteWorldPackage = {
  name: SiteWorldPackageName;
  summary: string;
  priceLabel: string;
  payerLabel: string;
  actionLabel: string;
  actionHref: string;
  deliverables: string[];
  emphasis?: "default" | "recommended";
};

export type SiteWorldAgentCommerce = {
  packageSku: string;
  hostedSessionSku: string;
  quoteHref: string;
  dryRunCheckoutHref: string;
  entitlementReadinessHref: string;
  truthLabels: Array<"dry_run_order" | "request_gated" | "protected_robot_team">;
};

export type SiteWorldCard = {
  id: string;
  siteCode: string;
  siteName: string;
  siteAddress: string;
  sceneId: string;
  captureId: string;
  siteSubmissionId: string;
  pipelinePrefix: string;
  category: Exclude<SiteCategory, "All">;
  industry: string;
  taskLane: string;
  tone: string;
  accent: string;
  thumbnailKind: ThumbnailKind;
  summary: string;
  bestFor: string;
  startStates: string[];
  runtime: string;
  defaultRuntimeBackend: string;
  availableRuntimeBackends: string[];
  sampleRobot: string;
  sampleRobotProfile: RobotProfile;
  sampleTask: string;
  samplePolicy: string;
  scenarioVariants: string[];
  exportArtifacts: string[];
  runtimeManifest: RuntimeManifestSummary;
  taskCatalog: TaskCatalogEntry[];
  scenarioCatalog: ScenarioCatalogEntry[];
  startStateCatalog: StartStateCatalogEntry[];
  robotProfiles: RobotProfile[];
  exportModes: string[];
  packages: [SiteWorldPackage, SiteWorldPackage];
  agentCommerce?: SiteWorldAgentCommerce;
  dataSource?: "pipeline";
  evaluationReadiness?: EvaluationReadinessSummary;
  presentationDemoReadiness?: {
    launchable: boolean;
    blockers: string[];
    presentationWorldManifestUri?: string | null;
    runtimeDemoManifestUri?: string | null;
    status?:
      | "artifact_explorer_ready"
      | "presentation_ui_unconfigured"
      | "presentation_ui_live"
      | "presentation_assets_missing";
    uiBaseUrl?: string | null;
  };
  worldLabsPreview?: {
    status: "not_requested" | "queued" | "processing" | "ready" | "failed";
    model?: string | null;
    operationId?: string | null;
    worldId?: string | null;
    launchUrl?: string | null;
    thumbnailUrl?: string | null;
    panoUrl?: string | null;
    caption?: string | null;
    spzUrls?: string[];
    colliderMeshUrl?: string | null;
    worldManifestUri?: string | null;
    operationManifestUri?: string | null;
    requestManifestUri?: string | null;
    lastUpdatedAt?: string | null;
    failureReason?: string | null;
    generationSourceType?: string | null;
  };
  artifactExplorer?: ArtifactExplorerSummary | null;
  runtimeReferenceImageUrl?: string | null;
  presentationReferenceImageUrl?: string | null;
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  siteWorldSpecUri?: string | null;
  siteWorldRegistrationUri?: string | null;
  siteWorldHealthUri?: string | null;
  hostedSessionOverride?: {
    allowBlockedSiteWorld?: boolean;
    qualificationState?:
      | "qualified_ready"
      | "qualified_risky"
      | "needs_refresh"
      | "not_ready_yet";
  };
};
