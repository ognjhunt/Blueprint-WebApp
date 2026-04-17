import { promises as fs } from "node:fs";
import path from "node:path";
import { slugifyCityName } from "./cityLaunchProfiles";
import {
  CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  CITY_LAUNCH_AGENT_LANE_VALUES,
  CITY_LAUNCH_APPROVAL_LANE_VALUES,
  CITY_LAUNCH_HUMAN_LANE_VALUES,
  CITY_LAUNCH_ISSUE_SEED_PHASE_VALUES,
  CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
  CITY_LAUNCH_METRIC_DEPENDENCY_KIND_VALUES,
  CITY_LAUNCH_METRIC_DEPENDENCY_STATUS_VALUES,
  CITY_LAUNCH_NAMED_CLAIM_TYPE_VALUES,
  CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS,
  CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES,
  CITY_LAUNCH_VALIDATION_BLOCKER_SEVERITY_VALUES,
  type CityLaunchAgentLane,
  type CityLaunchApprovalLane,
  type CityLaunchHumanLane,
  type CityLaunchIssueSeedPhase,
  type CityLaunchLawfulAccessMode,
  type CityLaunchMetricDependencyKind,
  type CityLaunchMetricDependencyStatus,
  type CityLaunchNamedClaimType,
  type CityLaunchRequiredMetricDependencyKey,
  type CityLaunchProofMotionMilestone,
  type CityLaunchValidationBlockerSeverity,
} from "./cityLaunchDoctrine";
import type {
  CityLaunchBudgetCategory,
  CityLaunchBuyerProofPath,
  CityLaunchBuyerTargetStatus,
  CityLaunchProspectStatus,
  CityLaunchResearchProvenance,
  CityLaunchTouchStatus,
  CityLaunchTouchType,
} from "./cityLaunchLedgers";
import {
  CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
  CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
  CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES,
  CITY_LAUNCH_PROSPECT_STATUS_VALUES,
  CITY_LAUNCH_TOUCH_STATUS_VALUES,
  CITY_LAUNCH_TOUCH_TYPE_VALUES,
} from "./cityLaunchResearchContracts";

export const CITY_LAUNCH_RESEARCH_SCHEMA_VERSION = "2026-04-12.city-launch-research.v1";

type StructuredCaptureCandidate = {
  name: string;
  contactEmail: string | null;
  sourceBucket: string;
  channel: string;
  status: CityLaunchProspectStatus;
  siteAddress: string | null;
  locationSummary: string | null;
  lat: number | null;
  lng: number | null;
  siteCategory: string | null;
  workflowFit: string | null;
  priorityNote: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredBuyerTarget = {
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  status: CityLaunchBuyerTargetStatus;
  workflowFit: string | null;
  proofPath: CityLaunchBuyerProofPath | null;
  notes: string | null;
  sourceBucket: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredFirstTouch = {
  referenceType: "prospect" | "buyer_target" | "general";
  referenceName: string | null;
  channel: string;
  touchType: CityLaunchTouchType;
  status: CityLaunchTouchStatus;
  campaignId: string | null;
  issueId: string | null;
  notes: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredBudgetRecommendation = {
  category: CityLaunchBudgetCategory;
  amountUsd: number;
  note: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

export type ParsedCityLaunchCaptureCandidate = StructuredCaptureCandidate & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchBuyerTarget = StructuredBuyerTarget & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchFirstTouch = StructuredFirstTouch & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchBudgetRecommendation = StructuredBudgetRecommendation & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchActivationRightsPath = {
  summary: string;
  privateControlledInteriorsRequireAuthorization: boolean;
  validationRequired: boolean;
  sourceUrls: string[];
};

export type ParsedCityLaunchValidationBlocker = {
  key: string;
  summary: string;
  severity: CityLaunchValidationBlockerSeverity;
  ownerLane: CityLaunchAgentLane | CityLaunchHumanLane | null;
  validationRequired: boolean;
  sourceUrls: string[];
};

export type ParsedCityLaunchApprovalRequirement = {
  lane: CityLaunchApprovalLane;
  reason: string;
};

export type ParsedCityLaunchIssueSeed = {
  key: string;
  title: string;
  phase: CityLaunchIssueSeedPhase;
  ownerLane: CityLaunchAgentLane;
  humanLane: CityLaunchHumanLane | null;
  summary: string;
  dependencyKeys: string[];
  successCriteria: string[];
  metricsDependencies: Array<
    CityLaunchRequiredMetricDependencyKey | CityLaunchProofMotionMilestone
  >;
  validationRequired: boolean;
};

export type ParsedCityLaunchMetricDependency = {
  key: CityLaunchRequiredMetricDependencyKey | CityLaunchProofMotionMilestone;
  kind: CityLaunchMetricDependencyKind;
  status: CityLaunchMetricDependencyStatus;
  ownerLane: CityLaunchAgentLane | CityLaunchHumanLane | null;
  notes: string | null;
};

export type ParsedCityLaunchNamedClaim = {
  subject: string;
  claimType: CityLaunchNamedClaimType;
  claim: string;
  validationRequired: boolean;
  sourceUrls: string[];
};

export type ParsedCityLaunchActivationPayload = {
  schemaVersion: string;
  machinePolicyVersion: string;
  city: string;
  citySlug: string;
  cityThesis: string;
  primarySiteLane: string;
  primaryWorkflowLane: string;
  primaryBuyerProofPath: CityLaunchBuyerProofPath;
  lawfulAccessModes: CityLaunchLawfulAccessMode[];
  preferredLawfulAccessMode: CityLaunchLawfulAccessMode | null;
  rightsPath: ParsedCityLaunchActivationRightsPath;
  validationBlockers: ParsedCityLaunchValidationBlocker[];
  requiredApprovals: ParsedCityLaunchApprovalRequirement[];
  ownerLanes: CityLaunchAgentLane[];
  issueSeeds: ParsedCityLaunchIssueSeed[];
  metricsDependencies: ParsedCityLaunchMetricDependency[];
  namedClaims: ParsedCityLaunchNamedClaim[];
};

export type CityLaunchResearchParseResult = {
  city: string;
  citySlug: string;
  artifactPath: string;
  schemaVersion: string;
  generatedAtIso: string | null;
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  firstTouches: ParsedCityLaunchFirstTouch[];
  budgetRecommendations: ParsedCityLaunchBudgetRecommendation[];
  activationPayload: ParsedCityLaunchActivationPayload | null;
  warnings: string[];
  errors: string[];
};

export function validateActivationReadyDirectOutreach(input: {
  city: string;
  activationPayload: ParsedCityLaunchActivationPayload | null;
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  warnings: string[];
  errors: string[];
}) {
  if (!input.activationPayload) {
    return;
  }

  const buyerTargetsWithEmail = input.buyerTargets.filter((entry) => Boolean(entry.contactEmail));
  const captureCandidatesWithEmail = input.captureCandidates.filter((entry) => Boolean(entry.contactEmail));
  const totalRecipientBackedContacts = buyerTargetsWithEmail.length + captureCandidatesWithEmail.length;

  if (totalRecipientBackedContacts === 0) {
    input.errors.push(
      "Activation-ready direct outreach requires 1-3 recipient-backed first-wave contacts with explicit contact_email evidence.",
    );
  }

  if (input.buyerTargets.length > 0 && buyerTargetsWithEmail.length === 0) {
    input.warnings.push(
      `Activation-ready buyer direct-outreach lanes for ${input.city} have named targets but no explicit contact_email evidence.`,
    );
  }

  if (input.captureCandidates.length > 0 && captureCandidatesWithEmail.length === 0) {
    input.warnings.push(
      `Activation-ready capturer direct-outreach lanes for ${input.city} have named targets but no explicit contact_email evidence.`,
    );
  }

  if (totalRecipientBackedContacts > 3) {
    input.warnings.push(
      `Activation-ready first-wave direct outreach for ${input.city} includes ${totalRecipientBackedContacts} recipient-backed contacts. Keep the launch-ready first wave capped to the clearest 1-3 recipients.`,
    );
  }
}

type StructuredArtifactShape = {
  schema_version?: unknown;
  generated_at?: unknown;
  capture_location_candidates?: unknown;
  buyer_target_candidates?: unknown;
  first_touch_candidates?: unknown;
  budget_recommendations?: unknown;
};

type StructuredActivationPayloadShape = {
  schema_version?: unknown;
  machine_policy_version?: unknown;
  city?: unknown;
  city_slug?: unknown;
  city_thesis?: unknown;
  primary_site_lane?: unknown;
  primary_workflow_lane?: unknown;
  primary_buyer_proof_path?: unknown;
  lawful_access_modes?: unknown;
  preferred_lawful_access_mode?: unknown;
  rights_path?: unknown;
  validation_blockers?: unknown;
  required_approvals?: unknown;
  owner_lanes?: unknown;
  issue_seeds?: unknown;
  metrics_dependencies?: unknown;
  named_claims?: unknown;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const normalized = asString(value);
  return normalized || null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown) {
  return asArray(value)
    .map((entry) => asString(entry))
    .filter(Boolean);
}

function describeAllowedValues(values: readonly string[]) {
  return values.map((value) => `"${value}"`).join(", ");
}

function parseEnumValue<T extends string>(input: {
  value: unknown;
  allowed: readonly T[];
  fieldName: string;
  sourceKey: string;
  errors: string[];
  allowNull?: boolean;
}): T | null {
  const normalized = asString(input.value);
  if (!normalized) {
    if (input.allowNull) {
      return null;
    }
    input.errors.push(
      `${input.sourceKey} is missing required field "${input.fieldName}". Allowed values: ${describeAllowedValues(input.allowed)}.`,
    );
    return null;
  }

  if (input.allowed.includes(normalized as T)) {
    return normalized as T;
  }

  input.errors.push(
    `${input.sourceKey} uses unsupported "${input.fieldName}" value "${normalized}". Allowed values: ${describeAllowedValues(input.allowed)}.`,
  );
  return null;
}

function normalizeStableToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStableKey(prefix: string, parts: Array<string | null | undefined>) {
  const normalized = parts
    .map((part) => normalizeStableToken(part))
    .filter(Boolean)
    .join("-");
  return `${prefix}_${normalized || "unknown"}`;
}

function buildProvenance(input: {
  artifactPath: string;
  sourceKey: string;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
}) {
  return {
    sourceType: "deep_research_playbook",
    artifactPath: path.resolve(input.artifactPath),
    sourceKey: input.sourceKey,
    sourceUrls: input.sourceUrls,
    parsedAtIso: new Date().toISOString(),
    explicitFields: input.explicitFields,
    inferredFields: input.inferredFields,
  } satisfies CityLaunchResearchProvenance;
}

function extractStructuredJsonBlock<T>(input: {
  markdown: string;
  fenceLabels: string[];
  schemaVersion: string;
}) {
  const fencePattern = input.fenceLabels.map((label) => escapeRegExp(label)).join("|");
  const codeFencePattern = new RegExp(
    "```(?:"
      + `${fencePattern}|json`
      + ")\\s*([\\s\\S]*?)```",
    "gi",
  );
  const matches = [...input.markdown.matchAll(codeFencePattern)];
  let foundSchemaMismatch = false;
  let foundInvalidJson = false;

  for (const match of matches.reverse()) {
    const candidate = match[1]?.trim();
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as {
        schema_version?: unknown;
      } & T;
      const schemaVersion = asString(parsed.schema_version);
      if (schemaVersion === input.schemaVersion) {
        return { parsed, foundSchemaMismatch, foundInvalidJson };
      }
      foundSchemaMismatch = true;
    } catch {
      foundInvalidJson = true;
      continue;
    }
  }

  return { parsed: null, foundSchemaMismatch, foundInvalidJson };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateFieldClassification(input: {
  sourceKey: string;
  explicitFields: string[];
  inferredFields: string[];
  warnings: string[];
  errors: string[];
}) {
  const overlap = input.explicitFields.filter((field) => input.inferredFields.includes(field));
  if (overlap.length > 0) {
    input.errors.push(
      `${input.sourceKey} lists the same fields as both explicit and inferred: ${overlap.join(", ")}.`,
    );
  }
  if (input.explicitFields.length === 0 && input.inferredFields.length === 0) {
    input.warnings.push(
      `${input.sourceKey} does not label any explicit_fields or inferred_fields. Preserve evidence versus inference explicitly in future runs.`,
    );
  }
}

function parseCaptureCandidates(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
  warnings: string[],
  errors: string[],
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const name = asString(record.name || record.site_name || record.company_name);
      const sourceBucket = asString(record.source_bucket);
      const channel = asString(record.channel);
      if (!name || !sourceBucket || !channel) {
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const sourceKey = `capture_location_candidates[${index}]`;
      validateFieldClassification({
        sourceKey,
        explicitFields,
        inferredFields,
        warnings,
        errors,
      });
      const status = parseEnumValue({
        value: record.status,
        allowed: CITY_LAUNCH_PROSPECT_STATUS_VALUES,
        fieldName: "status",
        sourceKey,
        errors,
      });
      if (!status) {
        return null;
      }
      const stableKey = buildStableKey(`prospect_${citySlug}`, [
        sourceBucket,
        name,
        asOptionalString(record.site_address) || asOptionalString(record.location_summary) || asOptionalString(record.workflow_fit),
      ]);

      return {
        stableKey,
        name,
        contactEmail: asOptionalString(record.contact_email || record.email),
        sourceBucket,
        channel,
        status,
        siteAddress: asOptionalString(record.site_address),
        locationSummary: asOptionalString(record.location_summary),
        lat: asNumber(record.lat),
        lng: asNumber(record.lng),
        siteCategory: asOptionalString(record.site_category),
        workflowFit: asOptionalString(record.workflow_fit),
        priorityNote: asOptionalString(record.priority_note || record.why_now),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchCaptureCandidate;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function parseBuyerTargets(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
  warnings: string[],
  errors: string[],
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const companyName = asString(record.company_name);
      if (!companyName) {
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const sourceKey = `buyer_target_candidates[${index}]`;
      validateFieldClassification({
        sourceKey,
        explicitFields,
        inferredFields,
        warnings,
        errors,
      });
      const status = parseEnumValue({
        value: record.status,
        allowed: CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES,
        fieldName: "status",
        sourceKey,
        errors,
      });
      if (!status) {
        return null;
      }
      const proofPath = parseEnumValue({
        value: record.proof_path,
        allowed: CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
        fieldName: "proof_path",
        sourceKey,
        errors,
        allowNull: true,
      });
      if (asOptionalString(record.proof_path) && !proofPath) {
        return null;
      }
      const stableKey = buildStableKey(`buyer_target_${citySlug}`, [
        companyName,
        asOptionalString(record.workflow_fit),
      ]);

      return {
        stableKey,
        companyName,
        contactName: asOptionalString(record.contact_name),
        contactEmail: asOptionalString(record.contact_email || record.email),
        status,
        workflowFit: asOptionalString(record.workflow_fit),
        proofPath,
        notes: asOptionalString(record.notes || record.why_now),
        sourceBucket: asOptionalString(record.source_bucket),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchBuyerTarget;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function parseFirstTouches(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
  warnings: string[],
  errors: string[],
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const channel = asString(record.channel);
      if (!channel) {
        return null;
      }
      const referenceName = asOptionalString(record.reference_name);
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const sourceKey = `first_touch_candidates[${index}]`;
      validateFieldClassification({
        sourceKey,
        explicitFields,
        inferredFields,
        warnings,
        errors,
      });
      const referenceType = parseEnumValue({
        value: record.reference_type,
        allowed: ["prospect", "buyer_target", "general"] as const,
        fieldName: "reference_type",
        sourceKey,
        errors,
      });
      const touchType = parseEnumValue({
        value: record.touch_type,
        allowed: CITY_LAUNCH_TOUCH_TYPE_VALUES,
        fieldName: "touch_type",
        sourceKey,
        errors,
      });
      const status = parseEnumValue({
        value: record.status,
        allowed: CITY_LAUNCH_TOUCH_STATUS_VALUES,
        fieldName: "status",
        sourceKey,
        errors,
      });
      if (!referenceType || !touchType || !status) {
        return null;
      }
      if (referenceType !== "general" && !referenceName) {
        errors.push(`${sourceKey} requires "reference_name" when reference_type is "${referenceType}".`);
        return null;
      }
      const stableKey = buildStableKey(`touch_${citySlug}`, [
        referenceType,
        referenceName,
        channel,
        touchType,
      ]);

      return {
        stableKey,
        referenceType,
        referenceName,
        channel,
        touchType,
        status,
        campaignId: asOptionalString(record.campaign_id),
        issueId: asOptionalString(record.issue_id),
        notes: asOptionalString(record.notes),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchFirstTouch;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function parseBudgetRecommendations(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
  warnings: string[],
  errors: string[],
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const amountUsd = asNumber(record.amount_usd);
      const sourceKey = `budget_recommendations[${index}]`;
      const category = parseEnumValue({
        value: record.category,
        allowed: CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
        fieldName: "category",
        sourceKey,
        errors,
      });
      if (amountUsd === null) {
        return null;
      }
      if (!category) {
        return null;
      }
      if (amountUsd < 0) {
        errors.push(`${sourceKey} uses a negative amount_usd value "${amountUsd}".`);
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      validateFieldClassification({
        sourceKey,
        explicitFields,
        inferredFields,
        warnings,
        errors,
      });
      const stableKey = buildStableKey(`budget_${citySlug}`, [
        category,
        String(amountUsd),
        asOptionalString(record.note),
      ]);

      return {
        stableKey,
        category,
        amountUsd,
        note: asOptionalString(record.note),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchBudgetRecommendation;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function parseActivationPayload(
  city: string,
  citySlug: string,
  raw: StructuredActivationPayloadShape | null,
  warnings: string[],
  errors: string[],
) {
  if (!raw) {
    warnings.push(
      "No machine-readable city-launch activation payload was found. Refresh the deep-research playbook with the current harness prompt before activation.",
    );
    return null;
  }

  const schemaVersion = asString(raw.schema_version);
  if (schemaVersion !== CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION) {
    errors.push(
      `Activation payload schema_version must be "${CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION}".`,
    );
    return null;
  }

  const machinePolicyVersion = asString(raw.machine_policy_version);
  if (machinePolicyVersion !== CITY_LAUNCH_MACHINE_POLICY_VERSION) {
    errors.push(
      `Activation payload machine_policy_version must be "${CITY_LAUNCH_MACHINE_POLICY_VERSION}".`,
    );
  }

  const payloadCity = asString(raw.city) || city;
  const payloadCitySlug = asString(raw.city_slug) || citySlug;
  if (payloadCity !== city) {
    errors.push(`Activation payload city "${payloadCity}" does not match requested city "${city}".`);
  }
  if (payloadCitySlug !== citySlug) {
    errors.push(
      `Activation payload city_slug "${payloadCitySlug}" does not match requested city_slug "${citySlug}".`,
    );
  }

  const cityThesis = asString(raw.city_thesis);
  const primarySiteLane = asString(raw.primary_site_lane);
  const primaryWorkflowLane = asString(raw.primary_workflow_lane);
  if (!cityThesis) {
    errors.push('activation_payload is missing required field "city_thesis".');
  }
  if (!primarySiteLane) {
    errors.push('activation_payload is missing required field "primary_site_lane".');
  }
  if (!primaryWorkflowLane) {
    errors.push('activation_payload is missing required field "primary_workflow_lane".');
  }

  const primaryBuyerProofPath = parseEnumValue({
    value: raw.primary_buyer_proof_path,
    allowed: CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
    fieldName: "primary_buyer_proof_path",
    sourceKey: "activation_payload",
    errors,
  });

  const lawfulAccessModes = asArray(raw.lawful_access_modes)
    .map((value, index) =>
      parseEnumValue({
        value,
        allowed: CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES,
        fieldName: `lawful_access_modes[${index}]`,
        sourceKey: "activation_payload",
        errors,
      }),
    )
    .filter((value): value is CityLaunchLawfulAccessMode => Boolean(value));

  if (lawfulAccessModes.length === 0) {
    errors.push("activation_payload must include at least one lawful_access_modes entry.");
  }

  const preferredLawfulAccessMode = parseEnumValue({
    value: raw.preferred_lawful_access_mode,
    allowed: CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES,
    fieldName: "preferred_lawful_access_mode",
    sourceKey: "activation_payload",
    errors,
    allowNull: true,
  });

  if (
    preferredLawfulAccessMode
    && lawfulAccessModes.length > 0
    && !lawfulAccessModes.includes(preferredLawfulAccessMode)
  ) {
    errors.push(
      `activation_payload preferred_lawful_access_mode "${preferredLawfulAccessMode}" must also appear in lawful_access_modes.`,
    );
  }

  const rightsPathRecord = asRecord(raw.rights_path);
  const rightsSummary = asString(rightsPathRecord?.summary);
  const rightsPrivateControlled = asBoolean(
    rightsPathRecord?.private_controlled_interiors_require_authorization,
  );
  const rightsValidationRequired = asBoolean(rightsPathRecord?.validation_required);
  const rightsSourceUrls = asStringArray(rightsPathRecord?.source_urls);
  if (!rightsSummary) {
    errors.push('activation_payload.rights_path is missing required field "summary".');
  }
  if (rightsPrivateControlled === null) {
    errors.push(
      'activation_payload.rights_path is missing required field "private_controlled_interiors_require_authorization".',
    );
  }
  if (rightsValidationRequired === null) {
    errors.push(
      'activation_payload.rights_path is missing required field "validation_required".',
    );
  }
  if ((rightsSourceUrls.length === 0) && rightsValidationRequired === false) {
    errors.push(
      "activation_payload.rights_path must include source_urls or set validation_required=true.",
    );
  }

  const validationBlockers = asArray(raw.validation_blockers)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const sourceKey = `activation_payload.validation_blockers[${index}]`;
      const key = asString(record.key);
      const summary = asString(record.summary);
      const severity = parseEnumValue({
        value: record.severity,
        allowed: CITY_LAUNCH_VALIDATION_BLOCKER_SEVERITY_VALUES,
        fieldName: "severity",
        sourceKey,
        errors,
      });
      const ownerLane = asOptionalString(record.owner_lane);
      const validationRequired = asBoolean(record.validation_required);
      const sourceUrls = asStringArray(record.source_urls);
      if (!key) {
        errors.push(`${sourceKey} is missing required field "key".`);
      }
      if (!summary) {
        errors.push(`${sourceKey} is missing required field "summary".`);
      }
      if (validationRequired === null) {
        errors.push(`${sourceKey} is missing required field "validation_required".`);
      }
      if (
        ownerLane
        && !CITY_LAUNCH_AGENT_LANE_VALUES.includes(ownerLane as CityLaunchAgentLane)
        && !CITY_LAUNCH_HUMAN_LANE_VALUES.includes(ownerLane as CityLaunchHumanLane)
      ) {
        errors.push(
          `${sourceKey} uses unsupported "owner_lane" value "${ownerLane}".`,
        );
      }
      if (sourceUrls.length === 0 && validationRequired === false) {
        errors.push(`${sourceKey} must include source_urls or set validation_required=true.`);
      }
      if (!severity || !key || !summary || validationRequired === null) {
        return null;
      }
      return {
        key,
        summary,
        severity,
        ownerLane:
          (ownerLane as CityLaunchAgentLane | CityLaunchHumanLane | null) || null,
        validationRequired,
        sourceUrls,
      } satisfies ParsedCityLaunchValidationBlocker;
    })
    .filter((entry): entry is ParsedCityLaunchValidationBlocker => Boolean(entry));

  const requiredApprovals = asArray(raw.required_approvals)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const sourceKey = `activation_payload.required_approvals[${index}]`;
      const lane = parseEnumValue({
        value: record.lane,
        allowed: CITY_LAUNCH_APPROVAL_LANE_VALUES,
        fieldName: "lane",
        sourceKey,
        errors,
      });
      const reason = asString(record.reason);
      if (!reason) {
        errors.push(`${sourceKey} is missing required field "reason".`);
      }
      if (!lane || !reason) {
        return null;
      }
      return { lane, reason } satisfies ParsedCityLaunchApprovalRequirement;
    })
    .filter((entry): entry is ParsedCityLaunchApprovalRequirement => Boolean(entry));

  const ownerLanes = asArray(raw.owner_lanes)
    .map((entry, index) =>
      parseEnumValue({
        value: entry,
        allowed: CITY_LAUNCH_AGENT_LANE_VALUES,
        fieldName: `owner_lanes[${index}]`,
        sourceKey: "activation_payload",
        errors,
      }),
    )
    .filter((entry): entry is CityLaunchAgentLane => Boolean(entry));
  if (ownerLanes.length === 0) {
    errors.push("activation_payload.owner_lanes must include at least one named agent lane.");
  }

  const metricsDependencies = asArray(raw.metrics_dependencies)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const sourceKey = `activation_payload.metrics_dependencies[${index}]`;
      const key = asString(record.key);
      const kind = parseEnumValue({
        value: record.kind,
        allowed: CITY_LAUNCH_METRIC_DEPENDENCY_KIND_VALUES,
        fieldName: "kind",
        sourceKey,
        errors,
      });
      const status = parseEnumValue({
        value: record.status,
        allowed: CITY_LAUNCH_METRIC_DEPENDENCY_STATUS_VALUES,
        fieldName: "status",
        sourceKey,
        errors,
      });
      const ownerLane = asOptionalString(record.owner_lane);
      if (
        key
        && !CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS.includes(
          key as CityLaunchRequiredMetricDependencyKey,
        )
        && !CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES.includes(
          key as CityLaunchProofMotionMilestone,
        )
      ) {
        errors.push(`${sourceKey} uses unsupported "key" value "${key}".`);
      }
      if (
        ownerLane
        && !CITY_LAUNCH_AGENT_LANE_VALUES.includes(ownerLane as CityLaunchAgentLane)
        && !CITY_LAUNCH_HUMAN_LANE_VALUES.includes(ownerLane as CityLaunchHumanLane)
      ) {
        errors.push(
          `${sourceKey} uses unsupported "owner_lane" value "${ownerLane}".`,
        );
      }
      if (!key || !kind || !status) {
        return null;
      }
      return {
        key: key as CityLaunchRequiredMetricDependencyKey | CityLaunchProofMotionMilestone,
        kind,
        status,
        ownerLane:
          (ownerLane as CityLaunchAgentLane | CityLaunchHumanLane | null) || null,
        notes: asOptionalString(record.notes),
      } satisfies ParsedCityLaunchMetricDependency;
    })
    .filter((entry): entry is ParsedCityLaunchMetricDependency => Boolean(entry));

  for (const requiredKey of CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS) {
    if (!metricsDependencies.some((entry) => entry.key === requiredKey)) {
      errors.push(
        `activation_payload.metrics_dependencies must include required metric "${requiredKey}".`,
      );
    }
  }

  const namedClaims = asArray(raw.named_claims)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const sourceKey = `activation_payload.named_claims[${index}]`;
      const subject = asString(record.subject);
      const claimType = parseEnumValue({
        value: record.claim_type,
        allowed: CITY_LAUNCH_NAMED_CLAIM_TYPE_VALUES,
        fieldName: "claim_type",
        sourceKey,
        errors,
      });
      const claim = asString(record.claim);
      const validationRequired = asBoolean(record.validation_required);
      const sourceUrls = asStringArray(record.source_urls);
      if (!subject) {
        errors.push(`${sourceKey} is missing required field "subject".`);
      }
      if (!claim) {
        errors.push(`${sourceKey} is missing required field "claim".`);
      }
      if (validationRequired === null) {
        errors.push(`${sourceKey} is missing required field "validation_required".`);
      }
      if (sourceUrls.length === 0 && validationRequired === false) {
        errors.push(`${sourceKey} must include source_urls or set validation_required=true.`);
      }
      if (!subject || !claimType || !claim || validationRequired === null) {
        return null;
      }
      return {
        subject,
        claimType,
        claim,
        validationRequired,
        sourceUrls,
      } satisfies ParsedCityLaunchNamedClaim;
    })
    .filter((entry): entry is ParsedCityLaunchNamedClaim => Boolean(entry));

  if (namedClaims.length === 0) {
    errors.push("activation_payload.named_claims must include at least one named claim.");
  }

  const issueSeeds = asArray(raw.issue_seeds)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const sourceKey = `activation_payload.issue_seeds[${index}]`;
      const key = asString(record.key);
      const title = asString(record.title);
      const phase = parseEnumValue({
        value: record.phase,
        allowed: CITY_LAUNCH_ISSUE_SEED_PHASE_VALUES,
        fieldName: "phase",
        sourceKey,
        errors,
      });
      const ownerLane = parseEnumValue({
        value: record.owner_lane,
        allowed: CITY_LAUNCH_AGENT_LANE_VALUES,
        fieldName: "owner_lane",
        sourceKey,
        errors,
      });
      const humanLane = parseEnumValue({
        value: record.human_lane,
        allowed: CITY_LAUNCH_HUMAN_LANE_VALUES,
        fieldName: "human_lane",
        sourceKey,
        errors,
        allowNull: true,
      });
      const summary = asString(record.summary);
      const dependencyKeys = asStringArray(record.dependency_keys);
      const successCriteria = asArray(record.success_criteria)
        .map((value) => asString(value))
        .filter(Boolean);
      const metricsDependencies = asArray(record.metrics_dependencies)
        .map((value) => asString(value))
        .filter(Boolean)
        .filter((value) => {
          if (
            CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS.includes(
              value as CityLaunchRequiredMetricDependencyKey,
            )
            || CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES.includes(
              value as CityLaunchProofMotionMilestone,
            )
          ) {
            return true;
          }
          errors.push(
            `${sourceKey} uses unsupported metrics_dependencies value "${value}".`,
          );
          return false;
        }) as Array<
          CityLaunchRequiredMetricDependencyKey | CityLaunchProofMotionMilestone
        >;
      const validationRequired = asBoolean(record.validation_required);

      if (!key) {
        errors.push(`${sourceKey} is missing required field "key".`);
      }
      if (!title) {
        errors.push(`${sourceKey} is missing required field "title".`);
      }
      if (!summary) {
        errors.push(`${sourceKey} is missing required field "summary".`);
      }
      if (successCriteria.length === 0) {
        errors.push(`${sourceKey} must include at least one success_criteria item.`);
      }
      if (validationRequired === null) {
        errors.push(`${sourceKey} is missing required field "validation_required".`);
      }
      if (!key || !title || !phase || !ownerLane || !summary || validationRequired === null) {
        return null;
      }

      return {
        key,
        title,
        phase,
        ownerLane,
        humanLane,
        summary,
        dependencyKeys,
        successCriteria,
        metricsDependencies,
        validationRequired,
      } satisfies ParsedCityLaunchIssueSeed;
    })
    .filter((entry): entry is ParsedCityLaunchIssueSeed => Boolean(entry));

  if (issueSeeds.length === 0) {
    errors.push("activation_payload.issue_seeds must include at least one issue seed.");
  }

  for (const issueSeed of issueSeeds) {
    if (!ownerLanes.includes(issueSeed.ownerLane)) {
      errors.push(
        `activation_payload.issue_seeds entry "${issueSeed.key}" uses owner_lane "${issueSeed.ownerLane}" that is not listed in owner_lanes.`,
      );
    }
  }

  return {
    schemaVersion,
    machinePolicyVersion: machinePolicyVersion || CITY_LAUNCH_MACHINE_POLICY_VERSION,
    city: payloadCity,
    citySlug: payloadCitySlug,
    cityThesis,
    primarySiteLane,
    primaryWorkflowLane,
    primaryBuyerProofPath: primaryBuyerProofPath || "exact_site",
    lawfulAccessModes,
    preferredLawfulAccessMode,
    rightsPath: {
      summary: rightsSummary,
      privateControlledInteriorsRequireAuthorization: rightsPrivateControlled ?? true,
      validationRequired: rightsValidationRequired ?? true,
      sourceUrls: rightsSourceUrls,
    },
    validationBlockers,
    requiredApprovals,
    ownerLanes,
    issueSeeds,
    metricsDependencies,
    namedClaims,
  } satisfies ParsedCityLaunchActivationPayload;
}

export function parseCityLaunchResearchArtifact(input: {
  city: string;
  artifactPath: string;
  markdown: string;
  skipActivationReadyDirectOutreachValidation?: boolean;
}) {
  const city = input.city.trim();
  const citySlug = slugifyCityName(city);
  const researchExtraction = extractStructuredJsonBlock<StructuredArtifactShape>({
    markdown: input.markdown,
    fenceLabels: ["city-launch-records"],
    schemaVersion: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
  });
  const structured = researchExtraction.parsed;
  const activationExtraction = extractStructuredJsonBlock<StructuredActivationPayloadShape>({
    markdown: input.markdown,
    fenceLabels: ["city-launch-activation-payload"],
    schemaVersion: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  });
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!structured) {
    if (researchExtraction.foundSchemaMismatch) {
      warnings.push(
        `Structured city-launch appendix found, but schema_version did not match "${CITY_LAUNCH_RESEARCH_SCHEMA_VERSION}".`,
      );
    }
    if (researchExtraction.foundInvalidJson) {
      warnings.push(
        "Structured city-launch appendix was present but could not be parsed as valid JSON.",
      );
    }
    warnings.push(
      "No structured city-launch research appendix was found. Refresh the deep-research playbook with the current harness prompt before materializing.",
    );
    return {
      city,
      citySlug,
      artifactPath: path.resolve(input.artifactPath),
      schemaVersion: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
      generatedAtIso: null,
      captureCandidates: [],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
      activationPayload: null,
      warnings,
      errors,
    } satisfies CityLaunchResearchParseResult;
  }

  if (activationExtraction.foundSchemaMismatch) {
    warnings.push(
      `Machine-readable city-launch activation payload found, but schema_version did not match "${CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION}".`,
    );
  }
  if (activationExtraction.foundInvalidJson) {
    warnings.push(
      "Machine-readable city-launch activation payload was present but could not be parsed as valid JSON.",
    );
  }

  const activationPayload = parseActivationPayload(
    city,
    citySlug,
    activationExtraction.parsed,
    warnings,
    errors,
  );
  const captureCandidates = parseCaptureCandidates(
    citySlug,
    input.artifactPath,
    structured.capture_location_candidates,
    warnings,
    errors,
  );
  const buyerTargets = parseBuyerTargets(
    citySlug,
    input.artifactPath,
    structured.buyer_target_candidates,
    warnings,
    errors,
  );
  const firstTouches = parseFirstTouches(
    citySlug,
    input.artifactPath,
    structured.first_touch_candidates,
    warnings,
    errors,
  );
  const budgetRecommendations = parseBudgetRecommendations(
    citySlug,
    input.artifactPath,
    structured.budget_recommendations,
    warnings,
    errors,
  );

  if (!input.skipActivationReadyDirectOutreachValidation) {
    validateActivationReadyDirectOutreach({
      city,
      activationPayload,
      captureCandidates,
      buyerTargets,
      warnings,
      errors,
    });
  }

  return {
    city,
    citySlug,
    artifactPath: path.resolve(input.artifactPath),
    schemaVersion: asString(structured.schema_version) || CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
    generatedAtIso: asOptionalString(structured.generated_at),
    captureCandidates,
    buyerTargets,
    firstTouches,
    budgetRecommendations,
    activationPayload,
    warnings,
    errors,
  } satisfies CityLaunchResearchParseResult;
}

export async function loadAndParseCityLaunchResearchArtifact(input: {
  city: string;
  artifactPath: string;
  skipActivationReadyDirectOutreachValidation?: boolean;
}) {
  const markdown = await fs.readFile(input.artifactPath, "utf8");
  return parseCityLaunchResearchArtifact({
    city: input.city,
    artifactPath: input.artifactPath,
    markdown,
    skipActivationReadyDirectOutreachValidation: input.skipActivationReadyDirectOutreachValidation,
  });
}
