/**
 * The site-task qualifying questions.
 *
 * `qualifyingEnvironments.ts` states the four conditions Blueprint screens on.
 * Until this module existed those conditions were presentation-only: the public
 * matrix argued them, the intake form collected free text, and neither
 * `structuredIntake.ts` nor the `inbound_qualification` prompt referenced
 * fixed-scene, bounded-task, known-objects, or clear-window at all. A screening
 * standard that never touches the screen is a claim, not a mechanism. This file
 * closes that gap by giving each condition a question the intake actually asks.
 *
 * ## Ask about the room, not about our taxonomy
 *
 * The single most important rule here. A site lead asked "is your scene fixed?"
 * answers yes — not dishonestly, but because "fixed" is our word and they have
 * no idea where our line sits. Every question below therefore asks about an
 * observable the operator can answer from memory of last Tuesday, and the
 * mapping from that observable to a condition is ours to make, in code, where
 * it can be audited. `condition` on each field records which gate the answer
 * feeds, so the two never drift apart.
 *
 * ## Verdict per option, not per field
 *
 * Each option carries its own verdict:
 *
 *   - `clear`     — this answer is compatible with a deployment today.
 *   - `marginal`  — plausible, but not decidable from a form. Routes to a call
 *                   rather than to a yes or a no.
 *   - `blocking`  — the condition genuinely does not hold today.
 *
 * A blocking answer is never a permanent no. It is a no *until that condition is
 * engineered into place*, which is itself work someone can decide to fund — so
 * every blocking option carries `unblocks`, the specific change that would flip
 * it. That string is what an honest rejection is made of, and it is the reason
 * the third triage outcome is worth building rather than a polite dead end.
 *
 * ## Two tiers, because form length costs good sites
 *
 * `gateFields` are cheap, few, and decide. `specFields` are the expensive
 * questions that specify a task well enough to put in front of a robot team,
 * and they are only worth a site's patience once the gates have passed. The
 * intake should disclose them progressively rather than showing sixteen
 * dropdowns to someone who is about to be told they are outside the metro.
 */

import type { QualifyingCondition } from "./qualifyingEnvironments";

/** How a single answer bears on whether a deployment is possible today. */
export type OptionVerdict = "clear" | "marginal" | "blocking";

export interface QualifyingOption {
  value: string;
  /** The answer in the operator's own words, not ours. */
  label: string;
  verdict: OptionVerdict;
  /**
   * Required on every `blocking` option: the specific change that would flip
   * this answer. A rejection without one is a dead end rather than a pipeline.
   */
  unblocks?: string;
  /** Why a `marginal` answer cannot be settled from a form. */
  ambiguity?: string;
}

export interface QualifyingField {
  id: string;
  /** The question, phrased as an observable rather than as our criterion. */
  question: string;
  /** Short helper shown under the question where the wording could mislead. */
  hint?: string;
  /** Which of the four conditions this answer feeds, when it feeds one. */
  condition?: QualifyingCondition["id"];
  options: readonly QualifyingOption[];
}

/* ----------------------------------------------------------------- gates */

/**
 * The six questions that can end a submission.
 *
 * Service area is first because it is the cheapest possible no and the one a
 * site would most resent discovering on a call. Four are the qualifying
 * conditions, in the order they are cheapest to answer. The last is timeline,
 * which screens for deployment intent rather than for the room — a site with no
 * target is the speculative capture we do not do, and it is asked of robot
 * teams too.
 *
 * Budget is deliberately NOT here. It is a matching parameter, not a screen: it
 * decides which robot teams we put in front of a site, and almost never decides
 * whether a site is worth capturing. It lives in `specFields`, paired to the
 * robot side's cost band so the comparison is mechanical.
 */
export const gateFields: readonly QualifyingField[] = [
  {
    id: "serviceArea",
    question: "Where is the site?",
    hint: "Capture visits run in the Austin metro today.",
    options: [
      { value: "austin_metro", label: "Austin metro", verdict: "clear" },
      {
        value: "texas_other",
        label: "Elsewhere in Texas",
        verdict: "blocking",
        unblocks: "A second Texas metro opening, which is a scheduling question rather than a technical one.",
      },
      {
        value: "outside_texas",
        label: "Outside Texas",
        verdict: "blocking",
        unblocks: "Expansion beyond Texas. Worth telling us anyway — where demand clusters is how that order gets decided.",
      },
    ],
  },
  {
    id: "sceneStability",
    question: "Between shifts, how much does this work area change?",
    hint: "Think about what a photo from last month would still get right.",
    condition: "fixed-scene",
    options: [
      { value: "stable", label: "Fixtures and stations stay where they are", verdict: "clear" },
      {
        value: "minor_drift",
        label: "Small things move, but the layout holds",
        verdict: "marginal",
        ambiguity: "Whether the drift matters depends on what moves and how close it sits to the robot's path — answerable in the room, not on a form.",
      },
      {
        value: "reconfigured",
        label: "It gets rearranged regularly",
        verdict: "blocking",
        unblocks: "Fixing the cell layout, or narrowing the task to the part of the area that does stay put.",
      },
    ],
  },
  {
    id: "taskShape",
    question: "Is this one repeated job, or a category of jobs?",
    condition: "bounded-task",
    options: [
      { value: "single", label: "One task, done the same way each time", verdict: "clear" },
      {
        value: "few_variants",
        label: "A handful of related variations",
        verdict: "marginal",
        ambiguity: "A few variants can be one task or several depending on whether the motion changes — which the description usually settles.",
      },
      {
        value: "open_category",
        label: "Whatever comes up in this area",
        verdict: "blocking",
        unblocks: "Picking the single highest-volume job in that area and scoping to it. Most sites can, once asked.",
      },
    ],
  },
  {
    id: "objectVariety",
    question: "How many distinct items does this task handle?",
    hint: "Counting item types, not item counts.",
    condition: "known-objects",
    options: [
      { value: "under_10", label: "Fewer than ten", verdict: "clear" },
      { value: "ten_to_fifty", label: "Ten to fifty, and we could list them", verdict: "clear" },
      {
        value: "many_but_listable",
        label: "More than fifty, but there is a list",
        verdict: "marginal",
        ambiguity: "A long list is workable when the items share a shape and grip, and is not when they do not.",
      },
      {
        value: "unbounded",
        label: "It changes constantly — we could not list them",
        verdict: "blocking",
        unblocks: "Scoping to a family of items that can be enumerated, even if the station handles more.",
      },
    ],
  },
  {
    id: "deploymentTimeline",
    question: "When would you want a robot actually running here?",
    hint: "A real target, not a best case.",
    options: [
      { value: "this_quarter", label: "This quarter", verdict: "clear" },
      { value: "six_months", label: "Within six months", verdict: "clear" },
      {
        value: "next_year",
        label: "Six to twelve months out",
        verdict: "marginal",
        ambiguity:
          "Far enough out that the robot teams available then may not be the ones we would match you to now.",
      },
      {
        value: "exploratory",
        label: "No timeline — we are finding out what is possible",
        verdict: "blocking",
        unblocks:
          "A decision to actually deploy something. Exploring is how most good deployments start and it is not one yet, and capturing a site with no target is the speculative capture we do not do.",
      },
    ],
  },
  {
    id: "accessWindow",
    question: "Is there a time this station sits idle and clear of untrained people?",
    hint: "This is both when a robot could run and when we could capture.",
    condition: "clear-window",
    options: [
      { value: "scheduled", label: "Yes — a scheduled window", verdict: "clear" },
      { value: "between_shifts", label: "Between shifts or after hours", verdict: "clear" },
      {
        value: "quiet_periods",
        label: "Quiet periods, but nothing scheduled",
        verdict: "marginal",
        ambiguity: "An unscheduled lull is enough for a capture and may not be enough for a deployment. Worth ten minutes on a call.",
      },
      {
        value: "continuous",
        label: "It runs continuously with people around",
        verdict: "blocking",
        unblocks: "A maintenance window, a changeover slot, or a shift boundary the task could be moved to.",
      },
    ],
  },
];

/* ------------------------------------------------------------- the spec */

/**
 * The questions that specify rather than screen.
 *
 * None of these can block. Their job is to make the task precise enough that a
 * robot team can say yes or no without a discovery call of its own — which is
 * the actual product. They are asked only after the gates pass.
 */
export interface SpecField {
  id: string;
  question: string;
  hint?: string;
  /** Why a robot team needs this specific answer. Shown to the operator. */
  whyAsked: string;
  options: readonly { value: string; label: string }[];
}

export const specFields: readonly SpecField[] = [
  {
    id: "humanProximity",
    question: "Do people work alongside this station while it runs?",
    whyAsked: "Shared space changes the safety case, and with it which robots are even eligible.",
    options: [
      { value: "isolated", label: "No — the area is clear while it runs" },
      { value: "nearby", label: "People pass nearby but do not work in it" },
      { value: "shared", label: "People work in the same space" },
    ],
  },
  {
    id: "payloadWeight",
    question: "What is the heaviest thing this task handles?",
    whyAsked: "Payload eliminates more candidate robots than any other single answer.",
    options: [
      { value: "under_2kg", label: "Under 2 kg" },
      { value: "two_to_ten", label: "2–10 kg" },
      { value: "ten_to_twentyfive", label: "10–25 kg" },
      { value: "over_25kg", label: "Over 25 kg" },
    ],
  },
  {
    id: "cycleTime",
    question: "How long does one cycle take a person today?",
    hint: "A rough number is fine. We are looking for the order of magnitude.",
    whyAsked: "Cycle time sets whether a robot has to match human pace or merely run unattended.",
    options: [
      { value: "under_30s", label: "Under 30 seconds" },
      { value: "thirty_to_two_min", label: "30 seconds to 2 minutes" },
      { value: "two_to_ten_min", label: "2 to 10 minutes" },
      { value: "over_ten_min", label: "Over 10 minutes" },
      { value: "varies", label: "It varies a lot" },
    ],
  },
  {
    id: "volume",
    question: "How many cycles in a typical shift?",
    whyAsked: "Volume is what decides whether the economics work at all.",
    options: [
      { value: "under_50", label: "Fewer than 50" },
      { value: "fifty_to_250", label: "50 to 250" },
      { value: "250_to_1000", label: "250 to 1,000" },
      { value: "over_1000", label: "More than 1,000" },
    ],
  },
  {
    id: "successThreshold",
    question: "What completion rate would make this worth deploying?",
    hint: "The honest number, not the aspirational one.",
    whyAsked: "This is the acceptance criterion an evaluation gets measured against. Without it a result cannot pass or fail.",
    options: [
      { value: "ninety", label: "Around 90% — a person catches the rest" },
      { value: "ninetyfive", label: "95%" },
      { value: "ninetynine", label: "99%" },
      { value: "ninetynine_plus", label: "Better than 99%" },
      { value: "unsure", label: "We have not set one" },
    ],
  },
  {
    id: "budgetBand",
    question: "What could this deployment cost and still be worth doing?",
    hint: "A range is fine. Nothing here is a commitment.",
    whyAsked:
      "Budget is a matching parameter, not a screen. It decides which robot teams we put in front of you — a site with a modest budget and a provider whose deployments start well above it is a match nobody enjoys discovering on a call.",
    options: [
      { value: "under_50k", label: "Under $50K" },
      { value: "fifty_to_250k", label: "$50K–$250K" },
      { value: "250k_to_1m", label: "$250K–$1M" },
      { value: "over_1m", label: "Over $1M" },
      { value: "unsure", label: "We have not scoped a number" },
    ],
  },
  {
    id: "lighting",
    question: "What is the lighting like?",
    whyAsked: "Capture quality and perception both depend on it, and daylight is the awkward case.",
    options: [
      { value: "consistent", label: "Consistent artificial light" },
      { value: "mixed", label: "Mixed artificial and daylight" },
      { value: "daylight", label: "Mostly daylight — it changes through the day" },
      { value: "low", label: "Low light" },
    ],
  },
];

/* --------------------------------------------------------- the prose */

/**
 * The two free-text questions.
 *
 * Structured answers decide; prose is where the value of ambiguity lives. The
 * first is what the triage model reads to judge whether a task is genuinely
 * bounded — a description of three tasks under a "single task" dropdown is the
 * single most useful contradiction the model can catch. The second surfaces the
 * edge cases a site has stopped noticing, which are usually what a deployment
 * actually fails on.
 */
export const proseFields: readonly { id: string; question: string; hint: string }[] = [
  {
    id: "taskDescription",
    question: "Describe the task as if explaining it to someone doing it tomorrow.",
    hint: "Where things start, what happens to them, where they end up, and what a good outcome looks like.",
  },
  {
    id: "whatGoesWrong",
    question: "What goes wrong with this task today?",
    hint: "Jams, misreads, awkward items, the thing everyone works around. Edge cases are the most useful part of this form.",
  },
];

/* ----------------------------------------------------------- task footage */

/**
 * Optional footage of the task, by link rather than by upload.
 *
 * A thirty-second clip settles in one viewing what three paragraphs argue
 * about: whether "one task, done the same way" really is one task, what the
 * cycle actually takes, how close people work, and what the lighting does. It
 * is the highest-information thing a site can give us before a capture, and it
 * is exactly what the narrative review is otherwise trying to infer from prose.
 *
 * ## Why a link and not an upload
 *
 * Because `/governance` promises that consent fails closed, that suppression is
 * provable, and that a capture without its consent record does not process. An
 * upload widget on a public marketing form would take footage of identifiable
 * workers *before any consent record exists*, bypassing the machinery that
 * makes those promises true. Shipping that would make the trust page a lie.
 *
 * A link keeps custody with the site: they decide who can view it, and they
 * revoke by unsharing rather than by asking us to delete something. That is
 * genuinely stronger for them and costs us nothing.
 *
 * Once an engagement exists and consent is recorded, footage belongs in the
 * consented capture-upload path, not here.
 *
 * ## "Film the work, not the worker"
 *
 * Both the privacy-safe instruction and the better footage. Hands and objects
 * are what a robot team needs to see; faces and badges are what create a
 * consent problem. Saying so plainly gets us more usable video, not less.
 */
export const taskVideoField = {
  id: "taskVideoUrl",
  question: "Have a short video of the task being done?",
  optional: "Optional, and the single most useful thing you can send.",
  hint: "Paste a link — Drive, Dropbox, an unlisted upload, anything you can share and unshare. Thirty seconds of the actual cycle beats any description.",
  privacy:
    "Film the work, not the worker. Hands and objects are what a robot team needs to see. Do not send footage of identifiable people without their agreement — and because this is a link rather than an upload, you keep custody and can revoke access at any time.",
} as const;

export const qualifyingIntakeNote = {
  claim: "These questions are the screen, not a survey.",
  detail:
    "Six of them can end a submission, and we would rather end it here than on a call. What you answer maps to the four conditions on the site-operator page — we ask about your room and do the mapping ourselves, because our words for these things are not yours.",
} as const;
