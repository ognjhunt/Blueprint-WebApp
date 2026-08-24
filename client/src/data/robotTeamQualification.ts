/**
 * The robot-team qualifying questions.
 *
 * The mirror of `siteTaskQualification.ts`, and deliberately not a copy of it.
 * The two intakes screen for different things, and getting that difference
 * wrong would produce a form that asks robot teams to prove their robot is good
 * — which is neither our business nor the actual constraint.
 *
 * ## A site is screened on capability. A robot team is screened on intent.
 *
 * The site side asks "can a robot work here", because a site can genuinely fail
 * — a cell that gets rearranged between shifts defeats the capture regardless
 * of who shows up. A robot team cannot fail in that sense: it either has an
 * envelope that matches a task or it does not, and that is a matching problem
 * rather than a screening one.
 *
 * What a robot team *can* fail is the question that actually costs us
 * something: **would you deploy?** `/for-robot-teams` argues that the scarce
 * resource is engineer-weeks, not robots. That cuts both ways. A task matched to
 * a team with no hardware, no allocated engineers, no timeline, or no
 * willingness to travel to the metro is a match on paper that burns a real
 * capture visit and a real site's access window. So the gates here are
 * deployment readiness, and capability lives in the spec tier where it belongs.
 *
 * ## The spec fields mirror the site's, field for field
 *
 * This is the part worth protecting. Every band below is the *same enum* as its
 * counterpart in `siteTaskQualification.ts` — payload, cycle time, human
 * proximity, duty cycle, success rate, lighting. That makes matching a
 * comparison of enums rather than a comparison of prose, which is the
 * difference between a marketplace that can screen automatically and one that
 * needs a human to read two paragraphs and guess.
 *
 * `siteSpecCounterpart` records the pairing explicitly, and a test fails if a
 * pair ever drifts apart. If you add a spec question to one side, add its
 * counterpart to the other or leave the field unpaired on purpose.
 */

import type { QualifyingField, SpecField } from "./siteTaskQualification";

/* ----------------------------------------------------------------- gates */

/**
 * Four questions about whether a deployment could actually happen.
 *
 * None of them is about how good the robot is. A team with a modest robot and
 * allocated engineers is a far better counterparty than an impressive one with
 * nobody free until next year, and this ordering says so.
 */
export const robotGateFields: readonly QualifyingField[] = [
  {
    id: "hardwareMaturity",
    question: "Where is the hardware today?",
    hint: "We are asking what exists, not what is on the roadmap.",
    options: [
      { value: "deployed", label: "Deployed and running at customer sites", verdict: "clear" },
      { value: "pilots", label: "Running pilots, not yet in production", verdict: "clear" },
      {
        value: "prototype",
        label: "Working prototype, no customer deployments yet",
        verdict: "marginal",
        ambiguity:
          "A prototype can be ready for a bounded task or a year away from one, and the difference is not visible from a form.",
      },
      {
        value: "development",
        label: "Still in development",
        verdict: "blocking",
        unblocks:
          "A system that runs a task end to end. There is nothing for a site to evaluate until then, and we would rather say so than take the meeting.",
      },
    ],
  },
  {
    id: "deploymentGeography",
    question: "Would you deploy in the Austin metro?",
    hint: "Every site we prepare is there today.",
    options: [
      { value: "yes", label: "Yes", verdict: "clear" },
      { value: "right_opportunity", label: "For the right site, yes", verdict: "clear" },
      {
        value: "size_dependent",
        label: "Only above a certain contract size",
        verdict: "marginal",
        ambiguity:
          "Worth ten minutes to find out where that threshold sits, because it decides which tasks we would ever send you.",
      },
      {
        value: "no",
        label: "No — we deploy only in specific regions, and Austin is not one",
        verdict: "blocking",
        unblocks:
          "Blueprint opening a metro you serve. Tell us which ones — where robot-side demand clusters is how we decide what opens next.",
      },
    ],
  },
  {
    id: "engineerCapacity",
    question: "Who commits the deployment engineering?",
    hint: "The scarce resource, on your side as much as ours.",
    options: [
      {
        value: "allocated",
        label: "A named team with capacity set aside",
        verdict: "clear",
      },
      {
        value: "exists_unallocated",
        label: "We have the people; capacity is not allocated yet",
        verdict: "marginal",
        ambiguity:
          "Unallocated capacity is real or it is not, depending on who has to approve it. That is a conversation, not a dropdown.",
      },
      {
        value: "none",
        label: "No deployment engineering capacity right now",
        verdict: "blocking",
        unblocks:
          "Engineer-weeks freed or hired. A match nobody can run is theoretical, and a site pays for the theory with a real access window.",
      },
    ],
  },
  {
    id: "deploymentTimeline",
    question: "When would you want to be running on a site?",
    options: [
      { value: "this_quarter", label: "This quarter", verdict: "clear" },
      { value: "six_months", label: "Within six months", verdict: "clear" },
      {
        value: "next_year",
        label: "Six to twelve months out",
        verdict: "marginal",
        ambiguity:
          "Far enough out that the task we would match you to may not be the one you want by then.",
      },
      {
        value: "exploratory",
        label: "No timeline — we are exploring",
        verdict: "blocking",
        unblocks:
          "A funded deployment target. Exploring is legitimate and it is not a deployment; we will keep you on file until it becomes one.",
      },
    ],
  },
];

/* ------------------------------------------------------- capability envelope */

/**
 * A spec field that pairs with one on the site side.
 *
 * `siteSpecCounterpart` is the whole mechanism. When it is set, the option
 * values on both sides must be identical, so a match is `robot.payloadCapacity
 * >= site.payloadWeight` rather than two humans reading two paragraphs.
 */
export interface RobotSpecField extends SpecField {
  /** The `specFields` id on the site side whose enum this mirrors, if any. */
  siteSpecCounterpart?: string;
}

export const robotSpecFields: readonly RobotSpecField[] = [
  {
    id: "payloadCapacity",
    question: "What is the heaviest payload the system handles?",
    whyAsked: "Matched directly against what a site's task actually lifts.",
    siteSpecCounterpart: "payloadWeight",
    options: [
      { value: "under_2kg", label: "Under 2 kg" },
      { value: "two_to_ten", label: "2–10 kg" },
      { value: "ten_to_twentyfive", label: "10–25 kg" },
      { value: "over_25kg", label: "Over 25 kg" },
    ],
  },
  {
    id: "humanProximity",
    question: "What human proximity is the system rated for?",
    whyAsked: "A site that shares floor space with people rules out anything not rated for it.",
    siteSpecCounterpart: "humanProximity",
    options: [
      { value: "isolated", label: "Isolated operation only" },
      { value: "nearby", label: "People may pass nearby" },
      { value: "shared", label: "Rated to work in shared space" },
    ],
  },
  {
    id: "cycleTime",
    question: "What cycle time can it hold on a task like this?",
    hint: "Sustained, not best case.",
    whyAsked: "Compared against how long the same job takes a person at the site today.",
    siteSpecCounterpart: "cycleTime",
    options: [
      { value: "under_30s", label: "Under 30 seconds" },
      { value: "thirty_to_two_min", label: "30 seconds to 2 minutes" },
      { value: "two_to_ten_min", label: "2 to 10 minutes" },
      { value: "over_ten_min", label: "Over 10 minutes" },
      { value: "varies", label: "It varies a lot" },
    ],
  },
  {
    id: "dutyCycle",
    question: "How many cycles can it sustain in a shift?",
    whyAsked: "Matched against the site's actual volume, which is what decides the economics.",
    siteSpecCounterpart: "volume",
    options: [
      { value: "under_50", label: "Fewer than 50" },
      { value: "fifty_to_250", label: "50 to 250" },
      { value: "250_to_1000", label: "250 to 1,000" },
      { value: "over_1000", label: "More than 1,000" },
    ],
  },
  {
    id: "demonstratedSuccessRate",
    question: "What completion rate have you actually demonstrated?",
    hint: "Measured, not targeted. We would rather have the real number.",
    whyAsked: "Compared against the site's acceptance threshold. A gap here is the most common reason a promising match fails.",
    siteSpecCounterpart: "successThreshold",
    options: [
      { value: "ninety", label: "Around 90%" },
      { value: "ninetyfive", label: "95%" },
      { value: "ninetynine", label: "99%" },
      { value: "ninetynine_plus", label: "Better than 99%" },
      { value: "unsure", label: "Not measured on a task like this" },
    ],
  },
  {
    id: "lighting",
    question: "What is the hardest lighting it handles reliably?",
    whyAsked: "Daylight is the awkward case on both sides, and it is worth knowing before a capture.",
    siteSpecCounterpart: "lighting",
    options: [
      { value: "consistent", label: "Consistent artificial light only" },
      { value: "mixed", label: "Mixed artificial and daylight" },
      { value: "daylight", label: "Changing daylight" },
      { value: "low", label: "Low light" },
    ],
  },
  {
    id: "budgetBand",
    question: "What does a deployment like this typically cost a customer?",
    hint: "All-in for a first deployment. A range is fine.",
    whyAsked:
      "Matched against what a site says it could spend. Discovering a 5x gap on a call wastes both sides, and this is the cheapest possible place to catch it.",
    siteSpecCounterpart: "budgetBand",
    options: [
      { value: "under_50k", label: "Under $50K" },
      { value: "fifty_to_250k", label: "$50K–$250K" },
      { value: "250k_to_1m", label: "$250K–$1M" },
      { value: "over_1m", label: "Over $1M" },
      { value: "unsure", label: "It varies too much to band" },
    ],
  },
  {
    id: "objectHandling",
    question: "How much does the system need to know about an object in advance?",
    whyAsked:
      "This decides how much of a site's object list has to be enumerated before you could run — and therefore what a data package has to contain.",
    options: [
      { value: "novel", label: "It handles objects it has not seen" },
      { value: "few_examples", label: "A few examples per object class" },
      { value: "per_object", label: "Per-object training or setup" },
    ],
  },
  {
    id: "taskFamily",
    question: "Which task family is the best fit?",
    whyAsked: "The coarsest filter, applied before any of the bands above.",
    options: [
      { value: "pick_place", label: "Pick and place" },
      { value: "machine_tending", label: "Machine tending" },
      { value: "transport", label: "Transport and movement" },
      { value: "palletizing", label: "Palletizing and depalletizing" },
      { value: "inspection", label: "Inspection and scanning" },
      { value: "other", label: "Something else" },
    ],
  },
];

/* ----------------------------------------------------------------- prose */

/**
 * Two free-text questions, and the second is the most valuable thing on either
 * form.
 *
 * "What would you need to see before committing an engineer-week" is a direct
 * specification of what a Blueprint data package has to contain. Every answer
 * is a robot team telling us what our product should be, in their words, before
 * we have built the wrong thing.
 */
export const robotProseFields: readonly { id: string; question: string; hint: string }[] = [
  {
    id: "capabilityDescription",
    question: "What does your system do, in the words you would use with a customer?",
    hint: "The task it does well, and where it stops being the right tool.",
  },
  {
    id: "evidenceBar",
    question: "What would you need to see about a site before committing an engineer-week?",
    hint: "Be specific and be demanding. This is what we build our data packages to answer, and a vague answer here gets you a vague package.",
  },
];

export const robotIntakeNote = {
  claim: "We are not screening your robot.",
  detail:
    "These four questions are about whether a deployment could actually happen — hardware that exists, engineers who are free, a timeline, and willingness to work in the metro we prepare sites in. What your system can do belongs in the envelope below, where it gets matched rather than judged.",
} as const;
