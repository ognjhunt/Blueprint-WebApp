import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadAndParseCityLaunchResearchArtifact,
  validateActivationReadyDirectOutreach,
  type CityLaunchResearchParseResult,
  type ParsedCityLaunchBuyerTarget,
  type ParsedCityLaunchCaptureCandidate,
} from "./cityLaunchResearchParser";
import { discoverGovernedExternalContactEvidence } from "./cityLaunchExternalContactDiscovery";

type ContactEvidence = {
  recipientEmail: string;
  source: string;
};

export type CityLaunchContactEnrichmentStatus =
  | "enriched"
  | "no_changes"
  | "failed";

export type CityLaunchContactEnrichmentResult = {
  status: CityLaunchContactEnrichmentStatus;
  city: string;
  citySlug: string;
  sourceArtifactPath: string;
  outputPath: string | null;
  outputMarkdownPath: string | null;
  parsed: CityLaunchResearchParseResult | null;
  recoveredBuyerTargetContacts: number;
  recoveredCaptureCandidateContacts: number;
  unresolvedBuyerTargets: string[];
  unresolvedCaptureCandidates: string[];
  warnings: string[];
  errors: string[];
};

function buildEnrichmentProvenance(input: {
  artifactPath: string;
  sourceKey: string;
  source: string;
}) {
  return {
    sourceType: "city_launch_contact_enrichment" as const,
    artifactPath: path.resolve(input.artifactPath),
    sourceKey: input.sourceKey,
    sourceUrls: [],
    parsedAtIso: new Date().toISOString(),
    explicitFields: ["contact_email"],
    inferredFields: [],
  };
}

function mergeCaptureCandidates(input: {
  outputPath: string;
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
  recipientEvidence: Map<string, ContactEvidence>;
}): {
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
  recovered: number;
  unresolved: string[];
} {
  let recovered = 0;
  const unresolved: string[] = [];

  const captureCandidates: ParsedCityLaunchCaptureCandidate[] = input.captureCandidates.map((entry, index) => {
    if (entry.contactEmail) {
      return entry;
    }

    const evidence = input.recipientEvidence.get(
      entry.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    );
    if (!evidence) {
      unresolved.push(entry.name);
      return entry;
    }

    recovered += 1;
    return {
      ...entry,
      contactEmail: evidence.recipientEmail,
      provenance: buildEnrichmentProvenance({
        artifactPath: input.outputPath,
        sourceKey: `capture_location_candidates[${index}]`,
        source: evidence.source,
      }),
      explicitFields: entry.explicitFields.includes("contact_email")
        ? entry.explicitFields
        : [...entry.explicitFields, "contact_email"],
      priorityNote: [entry.priorityNote, evidence.source].filter(Boolean).join(" | "),
    };
  });

  return {
    captureCandidates,
    recovered,
    unresolved,
  };
}

function mergeBuyerTargets(input: {
  outputPath: string;
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  recipientEvidence: Map<string, ContactEvidence>;
}): {
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  recovered: number;
  unresolved: string[];
} {
  let recovered = 0;
  const unresolved: string[] = [];

  const buyerTargets: ParsedCityLaunchBuyerTarget[] = input.buyerTargets.map((entry, index) => {
    if (entry.contactEmail) {
      return entry;
    }

    const evidence = input.recipientEvidence.get(
      entry.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    );
    if (!evidence) {
      unresolved.push(entry.companyName);
      return entry;
    }

    recovered += 1;
    return {
      ...entry,
      contactEmail: evidence.recipientEmail,
      provenance: buildEnrichmentProvenance({
        artifactPath: input.outputPath,
        sourceKey: `buyer_target_candidates[${index}]`,
        source: evidence.source,
      }),
      explicitFields: entry.explicitFields.includes("contact_email")
        ? entry.explicitFields
        : [...entry.explicitFields, "contact_email"],
      notes: [entry.notes, evidence.source].filter(Boolean).join(" | "),
    };
  });

  return {
    buyerTargets,
    recovered,
    unresolved,
  };
}

function renderContactEnrichmentMarkdown(result: CityLaunchContactEnrichmentResult) {
  return [
    `# ${result.city} Contact Enrichment`,
    "",
    `- status: ${result.status}`,
    `- source_artifact: ${result.sourceArtifactPath}`,
    `- recovered_buyer_target_contacts: ${result.recoveredBuyerTargetContacts}`,
    `- recovered_capture_candidate_contacts: ${result.recoveredCaptureCandidateContacts}`,
    "",
    "## Unresolved Buyer Targets",
    "",
    ...(result.unresolvedBuyerTargets.length > 0
      ? result.unresolvedBuyerTargets.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Unresolved Capture Candidates",
    "",
    ...(result.unresolvedCaptureCandidates.length > 0
      ? result.unresolvedCaptureCandidates.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(result.warnings.length > 0 ? result.warnings.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Errors",
    "",
    ...(result.errors.length > 0 ? result.errors.map((entry) => `- ${entry}`) : ["- none"]),
  ].join("\n");
}

async function maybeWriteArtifacts(result: CityLaunchContactEnrichmentResult) {
  if (!result.outputPath) {
    return;
  }

  const jsonPayload = {
    status: result.status,
    city: result.city,
    city_slug: result.citySlug,
    source_artifact_path: result.sourceArtifactPath,
    recovered_buyer_target_contacts: result.recoveredBuyerTargetContacts,
    recovered_capture_candidate_contacts: result.recoveredCaptureCandidateContacts,
    unresolved_buyer_targets: result.unresolvedBuyerTargets,
    unresolved_capture_candidates: result.unresolvedCaptureCandidates,
    warnings: result.warnings,
    errors: result.errors,
    buyer_target_candidates: result.parsed?.buyerTargets.map((entry) => ({
      company_name: entry.companyName,
      contact_name: entry.contactName,
      contact_email: entry.contactEmail,
      notes: entry.notes,
      source_key: entry.provenance.sourceKey,
      source_type: entry.provenance.sourceType,
    })) || [],
    capture_location_candidates: result.parsed?.captureCandidates.map((entry) => ({
      name: entry.name,
      contact_email: entry.contactEmail,
      priority_note: entry.priorityNote,
      source_key: entry.provenance.sourceKey,
      source_type: entry.provenance.sourceType,
    })) || [],
  };

  await fs.mkdir(path.dirname(result.outputPath), { recursive: true });
  await fs.writeFile(result.outputPath, JSON.stringify(jsonPayload, null, 2), "utf8");

  if (result.outputMarkdownPath) {
    await fs.writeFile(result.outputMarkdownPath, renderContactEnrichmentMarkdown(result), "utf8");
  }
}

export async function runCityLaunchContactEnrichment(input: {
  city: string;
  artifactPath: string;
  resolveRecipientEvidence: (params: { targets: Array<string | null | undefined> }) => Promise<Map<string, ContactEvidence>>;
  outputPath?: string | null;
}) {
  const rawParsed = await loadAndParseCityLaunchResearchArtifact({
    city: input.city,
    artifactPath: input.artifactPath,
    skipActivationReadyDirectOutreachValidation: true,
  });

  if (rawParsed.errors.length > 0) {
    const result: CityLaunchContactEnrichmentResult = {
      status: "failed",
      city: rawParsed.city,
      citySlug: rawParsed.citySlug,
      sourceArtifactPath: path.resolve(input.artifactPath),
      outputPath: input.outputPath ? path.resolve(input.outputPath) : null,
      outputMarkdownPath: input.outputPath
        ? path.resolve(input.outputPath).replace(/\.json$/i, ".md")
        : null,
      parsed: rawParsed,
      recoveredBuyerTargetContacts: 0,
      recoveredCaptureCandidateContacts: 0,
      unresolvedBuyerTargets: rawParsed.buyerTargets
        .filter((entry) => !entry.contactEmail)
        .map((entry) => entry.companyName),
      unresolvedCaptureCandidates: rawParsed.captureCandidates
        .filter((entry) => !entry.contactEmail)
        .map((entry) => entry.name),
      warnings: [...rawParsed.warnings],
      errors: [...rawParsed.errors],
    };
    await maybeWriteArtifacts(result);
    return result;
  }

  const recipientEvidence = await input.resolveRecipientEvidence({
    targets: [
      ...rawParsed.buyerTargets.filter((entry) => !entry.contactEmail).map((entry) => entry.companyName),
      ...rawParsed.captureCandidates.filter((entry) => !entry.contactEmail).map((entry) => entry.name),
    ],
  });

  const effectiveOutputPath = input.outputPath
    ? path.resolve(input.outputPath)
    : path.resolve(input.artifactPath.replace(/\.md$/i, ".contact-enrichment.json"));

  const externalDiscovery = await discoverGovernedExternalContactEvidence({
    buyerTargets: rawParsed.buyerTargets,
    captureCandidates: rawParsed.captureCandidates,
  });
  const combinedEvidence = new Map(recipientEvidence);
  for (const [key, value] of externalDiscovery.matches.entries()) {
    if (!combinedEvidence.has(key)) {
      combinedEvidence.set(key, value);
    }
  }

  const mergedBuyerTargets = mergeBuyerTargets({
    outputPath: effectiveOutputPath,
    buyerTargets: rawParsed.buyerTargets,
    recipientEvidence: combinedEvidence,
  });
  const mergedCaptureCandidates = mergeCaptureCandidates({
    outputPath: effectiveOutputPath,
    captureCandidates: rawParsed.captureCandidates,
    recipientEvidence: combinedEvidence,
  });

  const warnings = [...rawParsed.warnings, ...externalDiscovery.warnings];
  const errors = [...rawParsed.errors];

  validateActivationReadyDirectOutreach({
    city: rawParsed.city,
    activationPayload: rawParsed.activationPayload,
    captureCandidates: mergedCaptureCandidates.captureCandidates,
    buyerTargets: mergedBuyerTargets.buyerTargets,
    warnings,
    errors,
  });

  const parsed: CityLaunchResearchParseResult = {
    ...rawParsed,
    artifactPath: effectiveOutputPath,
    buyerTargets: mergedBuyerTargets.buyerTargets,
    captureCandidates: mergedCaptureCandidates.captureCandidates,
    warnings,
    errors,
  };

  const result: CityLaunchContactEnrichmentResult = {
    status:
      errors.length > 0
        ? "failed"
        : mergedBuyerTargets.recovered > 0 || mergedCaptureCandidates.recovered > 0
          ? "enriched"
          : "no_changes",
    city: rawParsed.city,
    citySlug: rawParsed.citySlug,
    sourceArtifactPath: path.resolve(input.artifactPath),
    outputPath: effectiveOutputPath,
    outputMarkdownPath: effectiveOutputPath.replace(/\.json$/i, ".md"),
    parsed,
    recoveredBuyerTargetContacts: mergedBuyerTargets.recovered,
    recoveredCaptureCandidateContacts: mergedCaptureCandidates.recovered,
    unresolvedBuyerTargets: mergedBuyerTargets.unresolved,
    unresolvedCaptureCandidates: mergedCaptureCandidates.unresolved,
    warnings,
    errors,
  };

  await maybeWriteArtifacts(result);
  return result;
}
