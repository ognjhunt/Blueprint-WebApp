/**
 * Reading what the operator sent into the brief, instead of echoing it.
 *
 * ## The echo this replaces
 *
 * `draftBrief` assembles a brief from proposals it is handed, and at submit it
 * was handed the task statement and nothing else. So the "brief we draft from
 * your job description" was the job description, followed by every gate as an
 * open question -- the same dropdowns the old screen asked, moved behind a
 * disclosure. This module is what actually reads the evidence.
 *
 * ## Two readers, one rule
 *
 * A model reads the description; the footage reader watches the walkthrough.
 * Neither writes an answer. Each produces proposals that carry what they rest
 * on, and the operator confirms or corrects them -- the same attestation the
 * brief always required. What changed is that the operator now corrects our
 * reading rather than filling in a form.
 *
 * Nothing invented, stated as code rather than as intent:
 *
 * - A `description` proposal must quote the operator's own words, or it is
 *   downgraded to an `assumption`, which the brief shows as a question.
 * - A footage proposal must clear the same confidence floor a contradiction
 *   has to clear before it can cost someone a call.
 * - A value that is not one of the gate's options is nobody's answer.
 * - A gate that does not bind under the capture mode is not asked at all.
 */

import { runAgentTask } from "../agents/runtime";
import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";
import type {
  SiteTaskBriefReadingInput,
  SiteTaskBriefReadingOutput,
} from "../agents/tasks/site-task-brief-reading";
import { isSiteTaskBriefReadingEnabled } from "../config/env";
import { logger } from "../logger";
import {
  defaultCaptureMode,
  isCaptureMode,
  type CaptureMode,
  type QualifyingField,
} from "../../client/src/data/siteTaskQualification";
import { VIDEO_CONTRADICTION_CONFIDENCE_FLOOR } from "../../client/src/lib/gateTriage";
import { bindingGates } from "../../client/src/lib/siteTaskReadiness";
import { getBrief, mergeBriefProposals, type ProposedGateAnswer } from "./siteTaskBrief";

/**
 * How sure the model has to be before "you said so" is offered as a reading.
 * Below it the proposal is still shown, as a question rather than an answer.
 */
export const READING_CONFIDENCE_FLOOR = 0.6;

function normalizeMode(value: unknown): CaptureMode {
  return isCaptureMode(value) ? value : defaultCaptureMode;
}

function optionOf(field: QualifyingField, value: string) {
  return field.options.find((option) => option.value === value) ?? null;
}

function clockLabel(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/**
 * The model's reading of the description, as proposals the brief can carry.
 *
 * Pure. Validation is the whole job: the model may only speak in the gate's
 * own vocabulary, and may only call something a description when it can quote
 * the words it read it in.
 */
export function proposalsFromReading(
  output: Pick<SiteTaskBriefReadingOutput, "proposals">,
  captureMode: CaptureMode,
  sources: { taskStatement: string; whatGoesWrong?: string | null },
): ProposedGateAnswer[] {
  const binding = bindingGates(captureMode);
  const proposals: ProposedGateAnswer[] = [];
  const sourceText = [sources.taskStatement, sources.whatGoesWrong]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

  for (const proposal of output.proposals) {
    const field = binding.find((candidate) => candidate.id === proposal.field_id);
    if (!field) continue;
    if (!optionOf(field, proposal.value)) continue;

    const quote = proposal.quote?.trim() || null;
    const stated =
      proposal.basis === "description" &&
      Boolean(quote) &&
      sourceText.some((source) => source.includes(quote!)) &&
      proposal.confidence >= READING_CONFIDENCE_FLOOR;

    proposals.push({
      fieldId: field.id,
      value: proposal.value,
      basis: stated ? "description" : "assumption",
      reading: stated ? `You wrote "${quote}". ${proposal.reading}`.trim() : proposal.reading,
    });
  }

  return proposals;
}

/**
 * What the footage showed, as proposals the brief can carry.
 *
 * Only an observation that names one of the gate's options, at or above the
 * contradiction floor, becomes a proposal. The moment is carried in the reading
 * so the operator can scrub to it and disagree.
 */
export function proposalsFromFootage(
  evidence: Pick<SiteVideoEvidenceOutput, "observations">,
  captureMode: CaptureMode,
): ProposedGateAnswer[] {
  const binding = bindingGates(captureMode);
  const proposals: ProposedGateAnswer[] = [];

  for (const observation of evidence.observations) {
    if (observation.stance === "not_visible") continue;
    const value = observation.implied_value?.trim();
    if (!value) continue;
    if (observation.confidence < VIDEO_CONTRADICTION_CONFIDENCE_FLOOR) continue;
    const field = binding.find((candidate) => candidate.id === observation.field_id);
    if (!field || !optionOf(field, value)) continue;

    const moment = observation.moments[0];
    proposals.push({
      fieldId: field.id,
      value,
      basis: "observation",
      reading: moment
        ? `${observation.observation} (at ${clockLabel(moment.at_seconds)})`
        : observation.observation,
    });
  }

  return proposals;
}

/** The gates the model is allowed to speak about, in the words it needs. */
function gatesForReading(captureMode: CaptureMode): SiteTaskBriefReadingInput["gates"] {
  return bindingGates(captureMode).map((field) => ({
    id: field.id,
    question: field.question,
    options: field.options.map((option) => ({ value: option.value, label: option.label })),
  }));
}

/**
 * Read the description and fold what it states into the brief.
 *
 * Fire-and-forget from the submit path: the operator has their link before
 * this runs, and the brief they open a minute later is better for it. Off
 * unless the lane is on, and every failure is a logged no-op -- the brief they
 * already have is the fallback.
 */
export async function readBriefFromDescription(params: {
  requestId: string;
  taskStatement: string;
  whatGoesWrong?: string | null;
  captureMode?: string | null;
}): Promise<void> {
  if (!isSiteTaskBriefReadingEnabled()) return;
  const taskStatement = params.taskStatement.trim();
  if (!taskStatement) return;
  const captureMode = normalizeMode(params.captureMode);

  const result = await runAgentTask<SiteTaskBriefReadingInput, SiteTaskBriefReadingOutput>({
    kind: "site_task_brief_reading",
    input: {
      requestId: params.requestId,
      taskStatement,
      whatGoesWrong: params.whatGoesWrong?.trim() || null,
      gates: gatesForReading(captureMode),
    },
    session_key: `brief_reading:${params.requestId}`,
  });

  if (result.status !== "completed" || !result.output) {
    logger.warn(
      { requestId: params.requestId, error: result.error },
      "Brief reading did not complete; the drafted brief stands",
    );
    return;
  }

  await mergeBriefProposals({
    requestId: params.requestId,
    proposals: proposalsFromReading(result.output, captureMode, {
      taskStatement,
      whatGoesWrong: params.whatGoesWrong,
    }),
  });
}

/**
 * Fold what the footage showed into the brief.
 *
 * Called once a capture has cleared the privacy screen, with the reading that
 * screen already produced -- no second look at the video. A capture that was
 * held derives nothing, which is the screen's rule and not repeated here.
 */
export async function mergeFootageIntoBrief(params: {
  requestId: string;
  evidence: SiteVideoEvidenceOutput;
}): Promise<void> {
  const brief = await getBrief(params.requestId);
  if (!brief) return;
  const proposals = proposalsFromFootage(params.evidence, brief.captureMode);
  if (!proposals.length) return;
  await mergeBriefProposals({ requestId: params.requestId, proposals });
}
