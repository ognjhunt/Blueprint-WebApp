/**
 * Whether the footage covers the work area, and which views are missing.
 *
 * ## The gap this fills, which I made
 *
 * `EvidenceOnFile` in `siteTaskReadiness.ts` carries `coversScene` and
 * `missingCoverage`, and until now both were *inferred from adjacent facts*
 * rather than measured: a scene exists, therefore coverage was sufficient. That
 * is sound at the two call sites that use it and useless for the case in
 * between — footage uploaded, nothing reconstructed yet, and an operator
 * standing there who could add one more view in thirty seconds if we could tell
 * them which.
 *
 * The capture page now says "we check next whether it covers the work area well
 * enough... including if one more view would finish the job". This is the thing
 * that makes that true rather than a promise with nothing behind it.
 *
 * ## Why it is a separate task from `site_video_evidence`
 *
 * Same file, different question, and the difference is epistemic rather than
 * cosmetic. That task scores what the footage *shows* against what the operator
 * said. This one establishes what the footage **never showed** — and absence is
 * the harder claim: you cannot find it by sampling frames and hoping the
 * missing thing was not in one of the gaps. It needs the whole recording
 * traversed.
 *
 * Which is also why it runs post-hoc on the stored file rather than live during
 * capture. A live coach receives about one frame a second; that is enough to
 * answer a question about what is on screen now and not enough to certify that
 * a pallet position was never in view. Different tool, different job.
 *
 * ## It can withhold a reconstruction and never grant one
 *
 * The same one-way door the rest of the funnel uses. `coversScene: false` with
 * a named list of missing views is actionable and safe. `coversScene: true`
 * does not authorise a reconstruction on its own, because
 * `shouldSpendOnReconstruction` still requires a confirmed brief and every
 * binding gate answered — a model deciding the footage looks lovely cannot
 * move money.
 *
 * ## And it never describes a person
 *
 * Same constraint as `site_video_evidence`, for the same reason: the schema has
 * no field a person could be described in, and the prompt forbids it. Privacy
 * is `capturePrivacyScreen`'s question and this task must not become a second,
 * looser answer to it.
 */

import { z } from "zod";

import { getGeminiVideoModel } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

export interface CaptureCoverageInput {
  /** A short-lived signed read URL for the stored walkthrough. */
  videoUrl: string;
  /** What the operator said the job is, so "the work area" means something. */
  taskSummary: string;
  /**
   * The views we asked for, from the brief's shot list.
   *
   * Passed in so the model reports against the list rather than inventing a
   * standard. A coverage verdict against an imagined ideal capture would fail
   * every real one.
   */
  requestedViews: { id: string; label: string }[];
}

export const captureCoverageOutputSchema = z
  .object({
    /**
     * Whether a reconstruction has enough to work with.
     *
     * Deliberately the model's read on *sufficiency*, not on quality. A shaky
     * dim clip that shows every surface is more useful here than a beautiful
     * one that shows a third of the room.
     */
    covers_scene: z.boolean(),
    /** Per requested view, whether the footage actually contains it. */
    views: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(100),
          /** `seen` needs a timestamp. `not_seen` is the claim that matters. */
          status: z.enum(["seen", "partial", "not_seen"]),
          /** Where in the clip, for anything not `not_seen`. */
          timestamp_seconds: z.number().finite().nonnegative().max(86_400).nullish(),
          /** One line an operator could act on. No jargon. */
          note: z.string().trim().max(300),
        }),
      )
      .max(40),
    /**
     * What to film to finish the job, in the operator's words.
     *
     * The whole point of the task. "Upload a better video" is a message nobody
     * can act on; "a view of where the cartons are placed" is.
     */
    missing_views: z.array(z.string().trim().min(1).max(200)).max(10),
    /**
     * True when one more short clip would finish it, as opposed to a re-shoot.
     *
     * Load-bearing for the copy: we only tell somebody a supplement will do
     * when it will.
     */
    supplement_would_finish: z.boolean(),
    /** Anything that stopped the reading. Empty when the clip was readable. */
    unreadable_reasons: z.array(z.string().trim().max(200)).max(10),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type CaptureCoverageOutput = z.infer<typeof captureCoverageOutputSchema>;

export const captureCoverageTask: StructuredTaskDefinition<
  CaptureCoverageInput,
  CaptureCoverageOutput
> = {
  kind: "capture_coverage",
  // Pinned for the same reason `site_video_evidence` is: this lane is only
  // meaningful on a provider whose API ingests video natively.
  default_provider: "gemini_video",
  model_by_provider: { gemini_video: getGeminiVideoModel() },
  // A fixed sweep of a short walkthrough avoids agentic tool-call exhaustion.
  // The prompt already requires `partial` when a requested view is uncertain.
  video_processing_mode: "STATIC",
  video_sampling_fps: 2,
  output_schema: captureCoverageOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_outcome_contract() {
    return {
      objective:
        "Establish which of the requested views the footage contains, and name what is missing.",
      success_criteria: [
        "Every view marked seen or partial cites a timestamp.",
        "Every missing view is phrased as something an operator could go and film.",
        "No individual person is described.",
      ],
      self_checks: [
        "Could a reviewer scrub to each cited timestamp and see the view claimed?",
        "Is `not_seen` a real absence across the whole clip, or just absent from the parts I looked at closely?",
        "Would the missing_views list make sense to someone standing in the room?",
      ],
      proof_requirements: ["A timestamp for every view not reported as not_seen."],
      pass_threshold: 0.8,
      bounded_scope: "One stored walkthrough and one list of requested views.",
      grader_name: "capture-coverage-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are checking whether a walkthrough of a work area contains enough views to rebuild that area as a 3D scene.

Output JSON only. No markdown.

The job at this site, in the operator's words: this is context for what "the work area" means, not something to verify.

What you are deciding:
- For each requested view, whether the footage contains it: "seen", "partial", or "not_seen".
- "seen" and "partial" must cite a timestamp. A claim nobody can scrub to is not a claim.
- "not_seen" is a statement about the WHOLE recording, not about the parts you looked at closely. Traverse the clip before making it. If you genuinely cannot tell, say "partial" and explain why in the note.

Then:
- covers_scene: true only if a reconstruction has enough to work with. Judge sufficiency, not beauty — a shaky dim clip showing every surface is worth more here than a lovely one showing a third of the room.
- missing_views: what to film to finish, phrased so somebody standing in the room could act on it. "A view of where the cartons are placed" — not "insufficient coverage of the destination zone" and never "a better video".
- supplement_would_finish: true when one more short clip would do it. False when the recording would need doing again. Do not say true to be kind; being wrong here sends somebody out for a clip that will not help.
- unreadable_reasons: only when something stopped you reading the footage at all.

Hard limits:
- Never describe a person. Not their appearance, their role, their clothing, or their number. If people are in the footage, that is a separate review's question and not yours.
- Do not infer what is in the room from the job description. You are reading the footage.
- Do not report a view as seen because it probably happened off camera.`,
      returnShape: {
        covers_scene: true,
        views: [
          {
            id: "",
            status: "seen | partial | not_seen",
            timestamp_seconds: 0,
            note: "",
          },
        ],
        missing_views: [""],
        supplement_would_finish: true,
        unreadable_reasons: [""],
        confidence: 0.0,
      },
      payload: input,
    });
  },
};
