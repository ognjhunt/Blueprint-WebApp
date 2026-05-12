export type CityLaunchRoutineType = "weekly" | "refresh";

export type CityLaunchStoredSelection = {
  city: string;
  citySlug: string;
  artifactRef: string;
  validatedAt: string;
  issueId: string;
};

export type CityLaunchCloseout = {
  commentId: string | null;
  selectedCity: string;
  selectedCitySlug: string;
  artifactRef: string;
  otherCitiesTouched: string;
  outcome: "updated" | "no_change" | null;
  movement: string | null;
  movementKinds: CityLaunchMovementKind[];
  evidence: string | null;
  evidenceDelta: string | null;
  body: string;
};

export type CityLaunchMovementKind =
  | "target"
  | "recipient_contact"
  | "send"
  | "reply"
  | "proof_artifact"
  | "hosted_review"
  | "capture_ask"
  | "structured_intake"
  | "qualified_call";

export type CityLaunchCompletionAssessment = {
  ok: boolean;
  errors: string[];
  closeout: CityLaunchCloseout | null;
  nextSelection: CityLaunchStoredSelection | null;
};

type CommentLike = {
  id?: string | null;
  body: string;
  createdAt?: string | Date | null;
};

const FIELD_PATTERNS = {
  selectedCity: /^selected city:\s*(.+)$/im,
  artifact: /^artifact:\s*(.+)$/im,
  otherCitiesTouched: /^other cities touched:\s*(.+)$/im,
  outcome: /^outcome:\s*(.+)$/im,
  movement: /^movement:\s*(.+)$/im,
  evidence: /^evidence:\s*(.+)$/im,
  evidenceDelta: /^evidence delta:\s*(.+)$/im,
} as const;

function normalizeField(value: string | null | undefined) {
  return value?.trim().replace(/^`|`$/g, "") ?? "";
}

function normalizeNone(value: string | null | undefined) {
  const normalized = normalizeField(value).toLowerCase();
  return normalized === "none" || normalized === "n/a" || normalized === "no" || normalized === "nope";
}

function normalizeOutcome(value: string | null | undefined): "updated" | "no_change" | null {
  const normalized = normalizeField(value).toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized === "updated" || normalized === "refresh" || normalized === "refreshed") return "updated";
  if (normalized === "no_change" || normalized === "no-change" || normalized === "no_op" || normalized === "no-op" || normalized === "noop") {
    return "no_change";
  }
  return null;
}

const MOVEMENT_PATTERNS: Array<[CityLaunchMovementKind, RegExp]> = [
  ["target", /\b(target|prospect|account|site row|candidate)\b/i],
  ["recipient_contact", /\b(recipient[- ]backed|contact|contact_email|email evidence|named recipient)\b/i],
  ["send", /\b(send|sent touch|outreach sent|send ledger|first-send|live send)\b/i],
  ["reply", /\b(reply|response|inbound response|human reply)\b/i],
  ["proof_artifact", /\b(proof|proof artifact|proof pack|proof-ready|site proof|world-model package|package evidence)\b/i],
  ["hosted_review", /\b(hosted review|hosted-review|review start|session start)\b/i],
  ["capture_ask", /\b(capture[- ]ask|capture request|capture target|capture invite|capture applicant)\b/i],
  ["structured_intake", /\b(intake|structured intake|intake route|intake record|intake path)\b/i],
  ["qualified_call", /\b(call|qualified call|call scheduled|call completed|buyer call)\b/i],
];

function parseMovementKinds(value: string | null | undefined): CityLaunchMovementKind[] {
  const normalized = normalizeField(value);
  if (!normalized || normalizeNone(normalized)) return [];
  return MOVEMENT_PATTERNS
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([kind]) => kind);
}

export function slugifyCityName(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function expectedCityLaunchArtifactPath(city: string) {
  return `ops/paperclip/playbooks/city-launch-${slugifyCityName(city)}.md`;
}

function extractField(body: string, pattern: RegExp) {
  const match = body.match(pattern);
  return normalizeField(match?.[1]);
}

export function parseCityLaunchCloseoutComment(comment: CommentLike): CityLaunchCloseout | null {
  const selectedCity = extractField(comment.body, FIELD_PATTERNS.selectedCity);
  const artifactRef = extractField(comment.body, FIELD_PATTERNS.artifact);
  const movement = extractField(comment.body, FIELD_PATTERNS.movement) || null;
  if (!selectedCity || !artifactRef) return null;

  return {
    commentId: comment.id ?? null,
    selectedCity,
    selectedCitySlug: slugifyCityName(selectedCity),
    artifactRef,
    otherCitiesTouched: extractField(comment.body, FIELD_PATTERNS.otherCitiesTouched),
    outcome: normalizeOutcome(extractField(comment.body, FIELD_PATTERNS.outcome)),
    movement,
    movementKinds: parseMovementKinds(movement),
    evidence: extractField(comment.body, FIELD_PATTERNS.evidence) || null,
    evidenceDelta: extractField(comment.body, FIELD_PATTERNS.evidenceDelta) || null,
    body: comment.body,
  };
}

function toComparableTimestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function findLatestCityLaunchCloseout(comments: CommentLike[]) {
  const sorted = [...comments].sort((left, right) => toComparableTimestamp(right.createdAt) - toComparableTimestamp(left.createdAt));
  for (const comment of sorted) {
    const parsed = parseCityLaunchCloseoutComment(comment);
    if (parsed) return parsed;
  }
  return null;
}

function isIssueDocumentArtifact(artifactRef: string, documentKeys: string[]) {
  const normalized = normalizeField(artifactRef);
  const match = normalized.match(/^(?:issue-?document|document)\s*:\s*([a-z0-9._-]+)$/i);
  if (!match) return false;
  return documentKeys.includes(match[1]);
}

function isRepoArtifactForCity(artifactRef: string, city: string, artifactExists: boolean) {
  const normalized = normalizeField(artifactRef).replace(/^\/+/, "");
  return normalized === expectedCityLaunchArtifactPath(city) && artifactExists;
}

export function assessCityLaunchCompletion(input: {
  routineType: CityLaunchRoutineType;
  comments: CommentLike[];
  documentKeys: string[];
  artifactExists: boolean;
  currentSelection: CityLaunchStoredSelection | null;
  issueId: string;
  nowIso: string;
}): CityLaunchCompletionAssessment {
  const closeout = findLatestCityLaunchCloseout(input.comments);
  if (!closeout) {
    return {
      ok: false,
      errors: [
        "Missing closeout comment with Selected city and Artifact fields.",
      ],
      closeout: null,
      nextSelection: null,
    };
  }

  const errors: string[] = [];
  if (!normalizeNone(closeout.otherCitiesTouched)) {
    errors.push("Other cities touched must be 'none' for city-launch routine completion.");
  }

  const artifactMatchesCity =
    isRepoArtifactForCity(closeout.artifactRef, closeout.selectedCity, input.artifactExists)
    || isIssueDocumentArtifact(closeout.artifactRef, input.documentKeys);
  if (!artifactMatchesCity) {
    errors.push(
      `Artifact must be the selected city's playbook path (${expectedCityLaunchArtifactPath(closeout.selectedCity)}) or an existing issue document reference.`,
    );
  }

  if (input.routineType === "weekly") {
    if (!closeout.evidence || normalizeNone(closeout.evidence)) {
      errors.push("Weekly completion requires an Evidence line that explains why this city was chosen now.");
    }
    if (closeout.movementKinds.length === 0) {
      errors.push(
        "Weekly completion requires a Movement line naming real target/contact/send/reply/proof/hosted-review/capture-ask/intake/call movement.",
      );
    }
  } else {
    if (!input.currentSelection) {
      errors.push("Refresh completion requires a previously validated weekly city selection.");
    } else if (input.currentSelection.citySlug !== closeout.selectedCitySlug) {
      errors.push(
        `Refresh completion must stay on the weekly city (${input.currentSelection.city}), not ${closeout.selectedCity}.`,
      );
    }

    if (!closeout.outcome) {
      errors.push("Refresh completion requires Outcome: updated or Outcome: no_change.");
    }

    if (!closeout.evidenceDelta) {
      errors.push("Refresh completion requires an Evidence delta line.");
    }
    if (closeout.outcome === "updated" && (!closeout.evidenceDelta || normalizeNone(closeout.evidenceDelta))) {
      errors.push("Refresh completion marked updated must include a non-empty Evidence delta line.");
    }
    if (closeout.outcome === "updated" && closeout.movementKinds.length === 0) {
      errors.push(
        "Refresh completion marked updated requires a Movement line naming real target/contact/send/reply/proof/hosted-review/capture-ask/intake/call movement.",
      );
    }
    if (closeout.outcome === "no_change" && !closeout.movement) {
      errors.push("Refresh completion marked no_change requires a Movement line set to none.");
    }
    if (closeout.outcome === "no_change" && closeout.movement && !normalizeNone(closeout.movement)) {
      errors.push("Refresh completion marked no_change requires Movement: none.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    closeout,
    nextSelection: errors.length === 0
      ? {
        city: closeout.selectedCity,
        citySlug: closeout.selectedCitySlug,
        artifactRef: closeout.artifactRef,
        validatedAt: input.nowIso,
        issueId: input.issueId,
      }
      : null,
  };
}
