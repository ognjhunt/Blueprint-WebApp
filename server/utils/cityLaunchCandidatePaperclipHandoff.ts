import crypto from "node:crypto";
import type { CityLaunchCandidateReviewBatchResult } from "./cityLaunchCandidateReview";
import { slugifyCityName } from "./cityLaunchProfiles";
import type { CityLaunchCandidateSignalRecord } from "./cityLaunchLedgers";
import {
  createPaperclipIssueComment,
  resetPaperclipAgentSession,
  upsertPaperclipIssue,
  wakePaperclipAgent,
} from "./paperclip";

const PAPERCLIP_PROJECT_NAME = "blueprint-webapp";
const PUBLIC_REVIEW_AGENT_KEY = "public-space-review-agent";
const FALLBACK_REVIEW_AGENT_KEY = "city-launch-agent";
const HANDOFF_ORIGIN_KIND = "city_launch_app_candidate_batch";

export type CityLaunchCandidatePaperclipHandoffResult = {
  enabled: boolean;
  attempted: boolean;
  issueId: string | null;
  issueIdentifier: string | null;
  issueCreated: boolean;
  wakeStatus: string | null;
  wakeRunId: string | null;
  error: string | null;
};

function isTruthyFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isFalsyFlag(value: string | undefined) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

function shouldDispatchPaperclipHandoff() {
  const explicit = process.env.BLUEPRINT_CITY_LAUNCH_CANDIDATE_PAPERCLIP_HANDOFF_ENABLED;
  if (isFalsyFlag(explicit)) {
    return false;
  }
  if (isTruthyFlag(explicit)) {
    return true;
  }

  return Boolean(
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID?.trim()
      || process.env.PAPERCLIP_API_URL?.trim()
      || process.env.PAPERCLIP_API_KEY?.trim(),
  );
}

function shortHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function firstCity(candidates: CityLaunchCandidateSignalRecord[], review: CityLaunchCandidateReviewBatchResult) {
  return review.city || candidates.find((candidate) => candidate.city)?.city || "Unknown City";
}

function batchOriginId(candidates: CityLaunchCandidateSignalRecord[], review: CityLaunchCandidateReviewBatchResult) {
  const city = firstCity(candidates, review);
  const citySlug = slugifyCityName(city || "unknown-city");
  const candidateIds = candidates.map((candidate) => candidate.id).sort();
  return `${citySlug}:${shortHash(candidateIds.join("|"))}`;
}

function describeCandidate(candidate: CityLaunchCandidateSignalRecord, review: CityLaunchCandidateReviewBatchResult) {
  const outcome = review.outcomes.find((entry) => entry.candidateId === candidate.id);
  const reasons = outcome?.reasons?.length ? outcome.reasons.join("; ") : "no review reasons recorded";
  const providerPlaceId = candidate.providerPlaceId ? ` / ${candidate.providerPlaceId}` : "";
  return [
    `- ${candidate.name}`,
    `  - id: ${candidate.id}`,
    `  - address: ${candidate.address || "unknown"}`,
    `  - provider: ${candidate.provider || "unknown"}${providerPlaceId}`,
    `  - decision: ${outcome?.decision || "unknown"} (${outcome?.reviewState || candidate.reviewState || "unknown"})`,
    `  - reasons: ${reasons}`,
  ].join("\n");
}

function buildHandoffDescription(input: {
  candidates: CityLaunchCandidateSignalRecord[];
  review: CityLaunchCandidateReviewBatchResult;
  source: string;
  assigneeKey: string;
}) {
  const city = firstCity(input.candidates, input.review);
  const candidateLines = input.candidates
    .slice(0, 25)
    .map((candidate) => describeCandidate(candidate, input.review));
  const omittedCount = Math.max(0, input.candidates.length - candidateLines.length);

  return [
    `# Review app-open nearby candidate batch for ${city}`,
    "",
    "Nearby discovery candidate signals were submitted by the capture app and passed through the deterministic city-launch candidate reviewer.",
    "",
    "Important boundary: these are not approved capture permissions. Do not show them as approved captures until the review process promotes an evidence-backed location into `cityLaunchProspects` with an approved/onboarded/capturing status.",
    "",
    "Current review summary:",
    `- source: ${input.source}`,
    `- assignee_key: ${input.assigneeKey}`,
    `- generated_at: ${input.review.generatedAt}`,
    `- reviewed_by: ${input.review.reviewedBy}`,
    `- reviewed_count: ${input.review.reviewedCount}`,
    `- promoted_count: ${input.review.promotedCount}`,
    `- kept_in_review_count: ${input.review.keptInReviewCount}`,
    `- rejected_count: ${input.review.rejectedCount}`,
    "",
    "Agent task:",
    "- Enrich each kept-in-review candidate with source URLs, public-access posture, indoor/common-access posture, allowed/avoid capture zones, camera-policy evidence, capture-time estimate, and payout basis where available.",
    `- Re-run the deterministic reviewer after evidence is added: \`scripts/city-launch/review-public-candidates.ts --apply --candidate-ids ${input.candidates.map((candidate) => candidate.id).join(",")}\`.`,
    "- Promote only evidence-backed matches. Leave incomplete candidates under review with explicit missing-evidence reasons.",
    "",
    "Candidates:",
    ...candidateLines,
    ...(omittedCount ? [`- ${omittedCount} more candidates omitted from this issue body.`] : []),
  ].join("\n");
}

async function upsertReviewHandoffIssue(input: {
  city: string;
  originId: string;
  review: CityLaunchCandidateReviewBatchResult;
  candidates: CityLaunchCandidateSignalRecord[];
  source: string;
}) {
  async function upsertForAssignee(assigneeKey: string) {
    return await upsertPaperclipIssue({
      projectName: PAPERCLIP_PROJECT_NAME,
      assigneeKey,
      title: `Review app-open nearby candidates: ${input.city}`,
      description: buildHandoffDescription({
        candidates: input.candidates,
        review: input.review,
        source: input.source,
        assigneeKey,
      }),
      priority: input.review.keptInReviewCount > 0 ? "high" : "medium",
      status: input.review.keptInReviewCount > 0 ? "todo" : "backlog",
      originKind: HANDOFF_ORIGIN_KIND,
      originId: input.originId,
    });
  }

  try {
    return await upsertForAssignee(PUBLIC_REVIEW_AGENT_KEY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(`Paperclip agent not found: ${PUBLIC_REVIEW_AGENT_KEY}`)) {
      throw error;
    }
    return await upsertForAssignee(FALLBACK_REVIEW_AGENT_KEY);
  }
}

function handoffSkipped(enabled: boolean): CityLaunchCandidatePaperclipHandoffResult {
  return {
    enabled,
    attempted: false,
    issueId: null,
    issueIdentifier: null,
    issueCreated: false,
    wakeStatus: null,
    wakeRunId: null,
    error: null,
  };
}

export async function dispatchCityLaunchCandidatePaperclipHandoff(input: {
  candidates: CityLaunchCandidateSignalRecord[];
  review: CityLaunchCandidateReviewBatchResult;
  source?: string;
}): Promise<CityLaunchCandidatePaperclipHandoffResult> {
  const enabled = shouldDispatchPaperclipHandoff();
  if (!enabled || input.candidates.length === 0) {
    return handoffSkipped(enabled);
  }

  try {
    const city = firstCity(input.candidates, input.review);
    const originId = batchOriginId(input.candidates, input.review);
    const source = input.source || "creator_city_launch_candidate_signals";
    const issue = await upsertReviewHandoffIssue({
      city,
      originId,
      review: input.review,
      candidates: input.candidates,
      source,
    });

    await createPaperclipIssueComment(
      issue.issue.id,
      [
        `App-open nearby candidate batch reviewed at ${input.review.generatedAt}.`,
        `Promoted: ${input.review.promotedCount}; kept in review: ${input.review.keptInReviewCount}; rejected: ${input.review.rejectedCount}.`,
        `If evidence confirms a match, update the candidate evidence and rerun \`scripts/city-launch/review-public-candidates.ts --apply --candidate-ids ${input.candidates.map((candidate) => candidate.id).join(",")}\`.`,
      ].join("\n"),
    ).catch(() => undefined);

    let wakeStatus: string | null = null;
    let wakeRunId: string | null = null;
    if (issue.assigneeAgentId) {
      await resetPaperclipAgentSession(issue.assigneeAgentId, issue.issue.id, issue.companyId).catch(() => undefined);
      const wake = await wakePaperclipAgent({
        agentId: issue.assigneeAgentId,
        companyId: issue.companyId,
        reason: "city_launch_app_candidate_batch_review",
        idempotencyKey: `city-launch-app-candidate-batch:${originId}:${input.review.generatedAt}`,
        payload: {
          source,
          issueId: issue.issue.id,
          city,
          candidateIds: input.candidates.map((candidate) => candidate.id),
          promotedCount: input.review.promotedCount,
          keptInReviewCount: input.review.keptInReviewCount,
          rejectedCount: input.review.rejectedCount,
        },
      }).catch((error) => ({
        status: "wakeup_failed",
        runId: null,
        error: error instanceof Error ? error.message : String(error),
      }));
      wakeStatus = wake?.status || null;
      wakeRunId = "runId" in wake && typeof wake.runId === "string" ? wake.runId : null;
    }

    return {
      enabled: true,
      attempted: true,
      issueId: issue.issue.id,
      issueIdentifier: issue.issue.identifier || null,
      issueCreated: issue.created,
      wakeStatus,
      wakeRunId,
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      attempted: true,
      issueId: null,
      issueIdentifier: null,
      issueCreated: false,
      wakeStatus: null,
      wakeRunId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
