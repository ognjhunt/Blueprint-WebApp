/**
 * How Blueprint handles site data.
 *
 * Written for the operations lead and the counsel who will ask, and held to a
 * harder standard than the rest of the public copy: **every control named here
 * was read in the pipeline source before it was written down.** A trust page is
 * the one surface where an aspirational claim is indistinguishable from a lie,
 * and `claims:guard` cannot see across repositories to catch one.
 *
 * Verified against `BlueprintCapturePipeline` at 526a8de on 2026-08-24. Each
 * entry carries the module that enforces it so the next person can re-check
 * rather than trust this comment. If a control is removed or weakened upstream,
 * the corresponding entry here has to come down in the same change.
 *
 * Two claims were deliberately reworded away from the source draft:
 *
 *   - "contributes zero pixels to any rendered output" became a statement about
 *     the artifact rather than the render. What the pipeline actually proves is
 *     stronger and more checkable: the suppressed rows are absent from the
 *     published artifact, verified byte-exact against the source. A rendering
 *     claim would have been weaker and harder to evidence.
 *   - The takedown claim was strengthened, not softened. The draft said
 *     revocation propagates; the delivery gate additionally re-reads consent
 *     live, so a revocation blocks delivery before propagation has even run.
 *
 * One control the draft did not mention is included because it is genuinely
 * differentiated: generated pixels do not inherit the redaction evidence of the
 * frame that conditioned them.
 */

export interface DataControl {
  id: string;
  /** The promise, in the words a site lead would use. */
  claim: string;
  /** What actually enforces it. */
  mechanism: string;
  /** The pipeline module that implements it, for anyone re-checking. */
  enforcedBy: string;
}

export const dataControls: readonly DataControl[] = [
  {
    id: "consent-fails-closed",
    claim: "A capture without its consent record does not process.",
    mechanism:
      "Consent parsing is monotone toward denial. An allow-flag grants only on an explicit true; any other value is a deny. A status counts as active only when every observed token is in the explicit allow-list — unknown, wrong-typed, or contradictory statuses resolve to blocked, never to active. Our field operator cannot capture now and sort out permissions later, because the data would be unusable to us.",
    enforcedBy: "consent_normalization",
  },
  {
    id: "suppression",
    claim: "What is on your no-capture list is removed, and the removal is provable.",
    mechanism:
      "Camera paths are planned around the list, and anything that still lands in frame is suppressed in processing. Suppression is not a display filter: the suppressed rows are absent from the published artifact, and the pipeline proves the artifact contains exactly the retained source rows and nothing else — byte-exact against the original.",
    enforcedBy: "gaussian_suppression_render, gaussian_splat_decode",
  },
  {
    id: "generated-media",
    claim: "Pixels a model invents do not inherit permission from the frame that conditioned them.",
    mechanism:
      "Redacting a captured frame protects the captured pixels. It cannot protect pixels a generative model produces afterwards, which can reconstruct a face, a badge, or a proprietary fixture and then travel onward carrying the source clip's rights metadata. That inheritance is blocked: generated media is held to its own privacy check rather than the one that belonged to a different pixel array.",
    enforcedBy: "generated_media_privacy",
  },
  {
    id: "hosted-not-downloadable",
    claim: "Site files are hosted, not downloadable — including for robot teams.",
    mechanism:
      "Evaluations run on our infrastructure against your hosted testbed. A counterparty sees results and the anonymized profile you approved, not your files. If you opt into the opportunity network, the listing is anonymized by default and named detail is released only at a shortlist stage you approve.",
    enforcedBy: "Blueprint-WebApp permissioned access tiers",
  },
  {
    id: "revocation",
    claim: "You can revoke after delivery, and it reaches what already shipped.",
    mechanism:
      "Revocation enumerates every downstream artifact whose lineage traces to the capture — including derived-of-derived chains that carry no capture identifiers of their own — and emits a tombstone per artifact. Enumeration is deliberately over-inclusive: for a takedown, listing an extra artifact is safe and missing one is the risk. Separately, the serving gate re-reads consent live rather than trusting a manifest, so a revocation blocks delivery even before propagation has run.",
    enforcedBy: "consent_takedown",
  },
  {
    id: "provenance",
    claim: "We can answer exactly what any artifact was built from, and under which consent.",
    mechanism:
      "Every derived artifact is fingerprint-bound to its sources, so the lineage question has an exact answer rather than an approximate one — which is also what makes the revocation enumeration above possible.",
    enforcedBy: "capture lineage digests",
  },
];

/* ------------------------------------------------------------ what we do not do */

export const dataNeverDone: readonly string[] = [
  "Train foundation models on your site data without a separate, explicit, written agreement. Evaluation is the product, not data harvesting.",
  "Resell your data, aggregate it into public datasets, or carve out an “anonymized analytics” exception that quietly means otherwise.",
  "Publish anything — including the fact that we work together — without your signoff. A joint case study is an option you hold, not a default we assume.",
];

/* --------------------------------------------------------------- honest edges */

/**
 * The section that makes the rest credible. A trust page with no limits stated
 * is a trust page nobody in a procurement seat believes.
 */
export const honestEdges: readonly { id: string; limit: string; detail: string }[] = [
  {
    id: "certification",
    limit: "We do not hold SOC 2.",
    detail:
      "It is on the roadmap and is not claimed today. What exists instead is mechanically enforced consent, suppression, and takedown — controls that block our own runs when a record is missing, which is the point of them. We will walk your counsel through the receipts on a live example.",
  },
  {
    id: "infrastructure",
    limit: "Hosted infrastructure means cloud providers process your data.",
    detail:
      "Encrypted stores and rendered jobs run on third-party infrastructure. Artifacts are fingerprint-bound so provenance survives the infrastructure, and we will name the providers on request.",
  },
  {
    id: "scope",
    limit: "These controls cover the capture and what derives from it.",
    detail:
      "They are not a general security posture for your facility, your network, or your other vendors. What we can speak to is the data we hold and what we built from it.",
  },
];

export const verificationNote = {
  claim: "Every control on this page is enforced in the pipeline, not in a policy binder.",
  detail:
    "Several of them block our own runs when a record is missing or malformed. That is the design: a control that only fails for other people is not a control.",
} as const;

export const closingNote =
  "Questions this page did not answer are exactly what the scoping call is for.";

/* ---------------------------------------------- permission granularity */

/**
 * Four separate permissions, retained from the previous version of this page.
 *
 * Draft 4's controls answer "what happens to my data." These answer a different
 * and equally load-bearing question: what a robot team is allowed to *do* with
 * an evaluation. They are four independent toggles, and the reason to keep them
 * separate is the whole point — a provider may be allowed to test an existing
 * policy without being allowed to train on your videos, objects, layouts, or
 * process behaviour.
 */
export const evaluationPermissions: readonly { permission: string; question: string }[] = [
  { permission: "Evaluate only", question: "Can this existing robot or policy perform the task?" },
  { permission: "Adapt for this site", question: "May the provider tune the system for this deployment?" },
  { permission: "Retain improvements", question: "May the provider keep the site-specific learning?" },
  { permission: "General model training", question: "May site data improve a model used for other customers?" },
];

export const permissionsNote =
  "Evaluation is not training. A provider may be allowed to test an existing policy without being allowed to train on site videos, objects, layouts, or process behaviour — these are four choices, not one.";

/* --------------------------------------------------------------- egress */

/** What stays with Blueprint, and what a robot team actually receives. */
export const dataEgress = {
  inside: {
    title: "Inside Blueprint",
    detail:
      "Raw capture, detailed layouts, restricted zones, source media, hosted testbed files, and approved robot submissions.",
  },
  returned: {
    title: "Returned to each team",
    detail:
      "Completion rate, cycle-time estimate, reach or collision failures, fleet and charging assumptions, edge cases, and integration burden — within the permissions granted.",
  },
} as const;

/* ------------------------------------------------ progressive access */

/**
 * The access ladder, retained from the previous version of this page.
 *
 * The `hosted-not-downloadable` control above states the principle; this states
 * the granularity, which is what an operations lead actually asks about. Detail
 * is released tier by tier and each step is a decision the site makes, not a
 * threshold a counterparty crosses by being interested. Tier 03 is the load-
 * bearing one: approved code runs against the hosted model, and raw files do
 * not leave Blueprint.
 */
export const accessLadder: readonly { tier: string; title: string; detail: string }[] = [
  {
    tier: "01",
    title: "Anonymous",
    detail: "Task type, broad region, operating window, and expected volume.",
  },
  {
    tier: "02",
    title: "Benchmark",
    detail: "Object ranges, task metrics, environment class, and acceptance criteria.",
  },
  {
    tier: "03",
    title: "Controlled test",
    detail:
      "Approved code runs against the hosted model; raw files do not leave Blueprint.",
  },
  {
    tier: "04",
    title: "Shortlist",
    detail: "Detailed layouts and integrations go only to teams the site approves.",
  },
  {
    tier: "05",
    title: "Training rights",
    detail:
      "Adaptation, retention, and general model training are negotiated separately.",
  },
];

export const accessLadderNote =
  "Each step up is a decision the site makes, not a threshold a counterparty crosses by being interested.";
