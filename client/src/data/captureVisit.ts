/**
 * The capture visit.
 *
 * This is the only part of the service a partner physically experiences, and
 * the objection it answers is never "is this valuable" — it is "what does this
 * cost me operationally." So the page it feeds is deliberately concrete:
 * a named window, a schedule with times on it, an explicit list of what the
 * site does not have to do, and nothing left behind.
 *
 * On the turnaround target. `12–24h` appears here, on an owner decision made on
 * 2026-08-24, having previously been kept off every public surface. The rule it
 * replaces is recorded in `publicSiteCopy.ts`. It is stated as a design target
 * and never as a service level, because no run-duration telemetry backs it yet;
 * if that changes, promote the wording everywhere at once rather than here
 * alone.
 */

export interface VisitPass {
  id: string;
  name: string;
  detail: string;
}

/**
 * Two passes, and the order matters: the clean-background pass has to come
 * first because the pair is registered against each other, not merely both
 * collected.
 */
export const capturePasses: readonly VisitPass[] = [
  {
    id: "clean",
    name: "Clean-background pass",
    detail: "The cell without your task objects present.",
  },
  {
    id: "object-present",
    name: "Object-present pass",
    detail: "The same cell with the task objects staged as they sit on a normal day.",
  },
];

export const captureScope = {
  claim: "One workcell. Not the facility.",
  detail:
    "The capture scope is the workcell and the approach to it, agreed in writing before anyone arrives. We do not roam the building, and there is no fixed installation — the rig is a 360 camera and a smartphone, and nothing is left behind.",
} as const;

/* ------------------------------------------- how a visit gets scheduled */

/**
 * The gate in front of the visit.
 *
 * The most important correction this page makes to a reader's assumption: a
 * capture is not a thing you book. It is the last step of qualification, and it
 * only happens once a task has a plausible counterparty on the robot side.
 *
 * On why a call is required rather than a form alone. The decision turns on an
 * asymmetry, not on convention. A wasted visit costs a half-day of the only
 * capture capacity that exists, plus travel and the site's access window and
 * goodwill; a required call costs some top-of-funnel conversion. We are
 * capacity-constrained, not lead-constrained, so optimising conversion here
 * would be optimising the wrong number. And the failure a form cannot catch is
 * the common one: a site believes it has a bounded task and does not. The four
 * conditions have to be tested against the actual room by someone who has seen
 * them fail. So the form filters and the call qualifies — two different jobs,
 * in that order.
 *
 * The call sits before the match check on purpose. Screening a task against a
 * robot team spends that team's attention, and it should not be spent on a task
 * nobody has pressure-tested.
 *
 * On the one duration stated here. Thirty minutes is a commitment about a
 * meeting we control and can end, which is categorically different from the
 * wall-clock visit duration removed from this file — that was a claim about how
 * long someone else's site takes, and we had never measured one.
 */
export interface VisitGateStep {
  id: string;
  stage: string;
  what: string;
  outcome: string;
}

export const visitGate: readonly VisitGateStep[] = [
  {
    id: "contact",
    stage: "Contact",
    what:
      "Either direction. A site describes a workflow, a robot team describes what it needs to deploy against, or we reach out because a task looks like a fit. A short intake names the task, the site, the timeline, and the budget the work has to live inside.",
    outcome: "Obvious non-fits end here, cheaply and honestly.",
  },
  {
    id: "scoping-call",
    stage: "Scoping call",
    what:
      "About thirty minutes, and a real gate rather than a courtesy. The four conditions get tested against your actual room, the no-capture list gets started, and whoever owns what success means is identified by name.",
    outcome: "A task specified precisely enough to put in front of a robot team.",
  },
  {
    id: "match",
    stage: "Match",
    what:
      "Our work, not yours. The task is screened against the robot teams we are actually in conversation with — not a catalogue of vendors who might exist somewhere.",
    outcome: "A match, a not-yet with the reason, or an honest no.",
  },
  {
    id: "capture",
    stage: "Capture",
    what:
      "Only on a match. A date, an arrival window, and a named person to meet are confirmed in writing before anyone travels.",
    outcome: "The visit on this page.",
  },
];

export const visitGateNote = {
  claim: "We do not capture speculatively.",
  detail:
    "A cell scanned with no robot team interested in it costs us money and tells you something false about demand. So the visit is the last step of qualification rather than the first step of the engagement — which also means your access window is never spent on a capture that was never going anywhere.",
} as const;

/* ------------------------------------------------- the visit confirmation */

/**
 * The anti-confusion artifact.
 *
 * Field capture fails on logistics far more often than on technique: the
 * operator arrives at the wrong door, the escort is in a meeting, the cell is
 * still running, badging takes an hour, or nobody present can say what the task
 * actually is. Every one of those is a wasted trip and a burned access window.
 *
 * So the fix is a gate rather than a form. One written confirmation, sent
 * before the visit, and the operator does not travel until every line of it is
 * filled. An unanswered line is a reason to move the date, not something to
 * resolve in the lobby.
 */
export interface ConfirmationLine {
  id: string;
  field: string;
  detail: string;
}

export const visitConfirmation: readonly ConfirmationLine[] = [
  {
    id: "when",
    field: "Date and arrival window",
    detail:
      "A confirmed date and a 2–4 hour window with the cell out of production. Not a rough morning.",
  },
  {
    id: "who",
    field: "Named contact, plus a backup",
    detail:
      "Who meets the operator, their mobile number, and a second name for the day the first person is pulled into something.",
  },
  {
    id: "where",
    field: "The exact door",
    detail:
      "Which entrance, dock, or gate; where to park; and where to check in. Sites are large and maps are not.",
  },
  {
    id: "access",
    field: "Badging, PPE, and induction",
    detail:
      "Anything required before the operator can walk the floor, sent ahead so the window is spent in the cell and not in reception.",
  },
  {
    id: "task",
    field: "The workcell and the task",
    detail:
      "One station, one task, and the person who can say what counts as success and what must never happen. A photo of the cell if you have one.",
  },
  {
    id: "boundary",
    field: "The no-capture list, in writing",
    detail:
      "People, products, signage, or equipment that must never appear. Camera paths are planned around it before arrival.",
  },
];

export const visitConfirmationNote = {
  claim: "The operator does not travel until every line is filled.",
  detail:
    "An unanswered line moves the date. That reads strict, and it is the reason a visit runs cleanly: field capture fails on the wrong door and an escort in a meeting far more often than it fails on technique.",
} as const;

/* ---------------------------------------------------------- who captures */

/**
 * The single most misreadable fact on this page.
 *
 * "Handheld rig" is accurate and it is also exactly the phrase a site lead
 * misreads as *you walk your own phone around the cell*. Self-serve capture is
 * the thing this service is not: capture quality is the input to everything
 * downstream, and a site that captures its own cell is a site absorbing the
 * skilled labour we exist to remove. So the operator is stated before the
 * equipment is, everywhere this appears.
 */
export const captureOperator = {
  claim: "We send the operator. Nobody at your site captures anything.",
  detail:
    "A trained Blueprint capture operator travels to you with the rig, runs both passes, and reviews coverage before leaving. The rig is a 360 camera and a smartphone rather than a scanner cart or a survey truck — which means no installation, not that you hold the camera. Your team escorts and stages; the capture itself is never handed to you.",
  contrast: [
    { label: "Blueprint brings", detail: "The operator, the 360 camera and phone rig, the capture plan, and the on-device QA review." },
    { label: "Your site brings", detail: "An escort, the task objects, and the person who owns what success means." },
  ],
} as const;

/* Service area moved to `@/data/serviceArea` — it is a company fact, not a
   capture-visit detail, and four surfaces now state it. */

/* --------------------------------------------------------------- the day */

export interface VisitStep {
  /** Position in the run order. There are deliberately no clock times. */
  step: string;
  what: string;
  involvement: string;
  /** True where the partner has to be in the room. */
  partnerPresent: boolean;
}

/**
 * The run order — and specifically *not* a clock.
 *
 * An earlier version of this file carried timestamps (T+0:00 through T+2:30)
 * and a "two and a half hours" headline. Those numbers came from a GTM draft,
 * not from a measured capture: nothing in this repo or in
 * `BlueprintCapturePipeline` records how long a site visit actually takes. They
 * were removed on 2026-08-24 rather than dressed up as an estimate, because a
 * duration in an h1 is a promise a site lead will hold the first visit to.
 *
 * What is stated instead is what we can stand behind: the order of operations,
 * which steps need someone from the site, the access window we ask the site to
 * set aside, and the one hard ceiling that is actually enforced in software
 * (`captureCeiling`).
 *
 * If real visit telemetry ever exists, put the times back here first — with the
 * source — and only then in the page copy.
 */
export const visitSchedule: readonly VisitStep[] = [
  {
    step: "01",
    what: "Walkthrough — confirm scope and the no-capture list against the room",
    involvement: "Escort",
    partnerPresent: true,
  },
  {
    step: "02",
    what: "Clean-background pass",
    involvement: "None — the cell stays clear",
    partnerPresent: false,
  },
  {
    step: "03",
    what: "Stage task objects, confirm normal-day placement",
    involvement: "Task owner",
    partnerPresent: true,
  },
  {
    step: "04",
    what: "Object-present pass",
    involvement: "None",
    partnerPresent: false,
  },
  {
    step: "05",
    what: "On-device QA review — re-shoot any thin coverage immediately",
    involvement: "None",
    partnerPresent: false,
  },
  {
    step: "06",
    what: "Depart. Nothing installed, nothing left running",
    involvement: "Escort sign-out",
    partnerPresent: true,
  },
];

export const visitScheduleNote = {
  headline: "Six steps. Two of them need your team.",
  qaRationale:
    "The on-device QA review is why that step is in the list at all. A re-shoot while the operator is still standing in the cell is minutes of work; discovering thin coverage after everyone has left costs a second visit.",
} as const;

/**
 * The one capture limit that is actually enforced rather than estimated.
 *
 * Source: `BlueprintCapturePipeline` —
 * `docs/BETA_CAPACITY_COST_STORAGE_MODEL_2026-07-08.md`, "Hard Per-Capture
 * Limits". The 45-minute ceiling (2700s) is enforced on the iOS upload path
 * before Firebase Storage transfer, and the 20 GiB payload cap is enforced
 * again by Storage rules. This is a ceiling, not a typical duration — do not
 * let it drift into copy as "a pass takes 45 minutes".
 */
export const captureCeiling = {
  claim: "A pass cannot run longer than 45 minutes.",
  detail:
    "That ceiling is enforced in the capture app before anything uploads, not managed by the operator on the day. It is an upper bound rather than a typical length — most cells need far less — and it is the reason the visit cannot quietly expand into your afternoon.",
  source: "Enforced per capture: 45 minutes, 20 GiB",
} as const;

/* ------------------------------------------------------------ what follows */

export const afterTheVisit = {
  start: "Reconstruction and the testbed build begin the same day.",
  turnaround: "12–24h",
  turnaroundQualifier:
    "a design target we are engineering toward, not a service level we contract to",
  contact:
    "You get a named contact and status at each stage rather than a silent gap.",
} as const;

/* ------------------------------------------- what the partner never has to do */

/**
 * The objection-killer list. Every line here is something a site lead has
 * silently assumed they would be on the hook for.
 */
export const partnerNeverHasTo: readonly string[] = [
  "Do the capture yourself",
  "Learn our tools",
  "Host our hardware",
  "Export your CAD",
  "Clean the cell to a showroom standard",
  "Choose a simulator, world model, or compute provider",
];

export const normalCellNote =
  "A normal working cell is the correct input. The capture is of the site as it actually is — the mess is data, not a problem to fix before we arrive.";
