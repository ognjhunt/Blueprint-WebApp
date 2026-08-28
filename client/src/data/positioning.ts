/**
 * What Blueprint is, in one place.
 *
 * The whole company reduces to one boundary:
 *
 *     Blueprint owns the site. The robot company owns the robot.
 *
 * Everything a robot company currently does BEFORE its robot ships is site
 * work, it is robot-agnostic, and it is repeated from scratch by every vendor
 * at every site. That is what Blueprint takes. Everything that requires the
 * physical robot, its proprietary stack, or its safety liability stays with
 * the robot company — not as a limitation, but because it genuinely cannot be
 * finished before the hardware is in the building.
 *
 * The pitch that follows from that is not "we replace your deployment
 * engineers" — which asks a robot company to hand over its robot, its
 * software and its customer's production floor. It is: your deployment team
 * starts when the robot arrives, not months before.
 *
 * Every page that describes the company reads from this file, so the boundary
 * cannot drift between surfaces.
 */

/**
 * What Blueprint is, in one sentence, before anything about how it works.
 *
 * The long form: Blueprint finds and qualifies real automation demand, turns
 * each job into a fully specified digital opportunity, and lets the robotics
 * market prove who can solve it. Three beats — find, specify, prove — and the
 * headline keeps two of them because the third is implied by "prove".
 *
 * Deliberately not "deployment-ready": that asserts a readiness state only
 * per-request owner-system proof can support, and it front-runs the very
 * evaluation this company exists to run. Blueprint specifies the job. The
 * market proves whether a robot can do it.
 */
export const identity = {
  headline: "Real jobs, fully specified.",
  subhead: "Robot teams prove who can do them.",
  body:
    "Real demand — a budget, an owner, a bounded task — captured once and evaluated by every robot team against the same test.",
  /** The long form, for places with room for a full sentence. */
  full:
    "Blueprint finds and qualifies real automation demand, turns each job into a fully specified digital opportunity, and lets the robotics market prove who can solve it.",
} as const;

export const promise = {
  headline: "Don’t send engineers to scope a deployment.",
  subhead: "Blueprint does everything before the robot arrives.",
  body:
    "We qualify the customer, capture the workflow, recreate the environment, screen robot fit and write the acceptance test. Your team arrives with the robot.",
  /** The single number the product is accountable for. */
  metric: {
    label: "OEM engineering hours before the robot arrives",
    target: "~0",
    note: "The measurable version of the promise. Everything else follows from it.",
  },
} as const;

/**
 * The pre-shipment questions a robot company answers by hand today, once per
 * site, per vendor. Grouped the way the work actually divides, because a flat
 * list of eighteen bullets reads as noise rather than as a job.
 */
export const preShipmentWork = [
  {
    id: "opportunity",
    label: "Is this worth doing at all?",
    items: [
      "Is this a real customer with budget and an owner",
      "Is this a bounded, repeated task",
      "Do the economics justify automation",
      "Is there authority to buy and a date to deploy",
    ],
  },
  {
    id: "workflow",
    label: "What is the job, exactly?",
    items: [
      "What the workflow is, step by step",
      "What counts as success",
      "Cycle times, volumes and shifts",
      "Which exceptions occur, and how often",
    ],
  },
  {
    id: "physical",
    label: "What does the robot meet?",
    items: [
      "Objects: dimensions, weights, poses",
      "Obstacles, paths, clearances, doors, buttons",
      "Floor, lighting, and pick and place points",
      "Safety and workcell requirements",
    ],
  },
  {
    id: "systems",
    label: "What has to connect?",
    items: [
      "Network, IT and cybersecurity readiness",
      "Which systems need integration",
      "Access rules and clear windows",
      "What should happen the day a robot arrives",
    ],
  },
  {
    id: "feasibility",
    label: "Can a robot actually do it?",
    items: [
      "Recreate the conditions and run against them",
      "Screen which embodiments fit the envelope",
      "Name the gaps that remain",
      "Write the acceptance test both sides sign",
    ],
  },
] as const;

/**
 * The other half of the boundary, stated as plainly as the first. This exists
 * so the site never implies Blueprint touches the robot: some of this work
 * cannot be finalised before the hardware is physically present, and the rest
 * is the robot company's technology and its liability.
 */
export const robotCompanyWork = {
  label: "Stays with the robot company",
  reason:
    "Some of it cannot be finished until the hardware is in the building. The rest is their technology and their liability.",
  items: [
    "Uncrate, connect, and bring the robot online",
    "Map the facility through the robot's own sensors",
    "Configure movement and manipulation points",
    "Tune for the quirks that only appear on the real floor",
    "Operator training, safety sign-off, and production integration",
    "Service, uptime and ongoing support",
  ],
} as const;

/**
 * The unit of inventory. Not "sites" — a thousand interested factories is not
 * supply. A workcell counts only when all eight hold, which is why fifty of
 * them are worth more than five thousand leads.
 */
export const qualifiedDeployableWorkcell = {
  name: "Qualified Deployable Workcell",
  short: "QDW",
  lede:
    "The metric is not how many sites signed up. A workcell counts only when every one of these is true.",
  criteria: [
    "A real operator, named and reachable",
    "An actual repeated task, not a category of work",
    "Economics that justify automation",
    "Someone with authority and budget",
    "Intent to deploy inside a defined period",
    "Enough physical and task information captured",
    "At least one current robot category plausibly fits",
    "Agreement to deploy if the acceptance criteria are met",
  ],
  counterpoint:
    "Fifty of these are worth more than five thousand interested sites. Liquidity on paper with no executable transaction underneath is not a market.",
} as const;

/**
 * Why the work is done once rather than once per vendor, and why that is a
 * network effect rather than a services engagement.
 */
export const sharedGroundTruth = {
  title: "Do the work once. Not once per vendor.",
  today:
    "Every vendor scopes the same site from scratch, on its own assumptions. The answers do not compare.",
  instead:
    "Captured once. Every team scored on the same acceptance test.",
  keeps: {
    label: "Robot companies keep everything they care about",
    items: [
      "Proprietary policies and model weights",
      "Robot telemetry and teleoperation data",
      "Training data and robot-specific simulation",
      "Final safety validation and commissioning",
    ],
  },
  blueprintOwns: "The neutral representation of the job and the environment.",
} as const;

/**
 * Sourcing runs backwards from what robot teams say they can do. This is the
 * correction to naive marketplace thinking: capability envelopes are the
 * sourcing specification, not an afterthought.
 */
export const sourcingLoop = [
  {
    step: "01",
    label: "Capability envelopes in",
    detail: "Task archetypes, payload, cycle-time floor, shifts, minimum fleet size.",
  },
  {
    step: "02",
    label: "Hunt against the spec",
    detail: "We source operators that match, rather than waiting for a lead.",
  },
  {
    step: "03",
    label: "Qualify before travelling",
    detail: "Intent, authority and budget, established remotely. No plane for a maybe.",
  },
  {
    step: "04",
    label: "Capture once",
    detail: "One visit produces the canonical site and workcell representation.",
  },
  {
    step: "05",
    label: "Many teams evaluate",
    detail: "Simulated first, on the same twin, scored on the same rubric.",
  },
  {
    step: "06",
    label: "The site chooses",
    detail: "Results, timelines and terms side by side. A comparison, not an auction.",
  },
  {
    step: "07",
    label: "Results come back",
    detail: "What passed, what failed, whether the predicted cycle time held.",
  },
  {
    step: "08",
    label: "The next one is easier",
    detail: "Each result sharpens the next screen. The loop closes here.",
  },
] as const;

/**
 * The moat, stated without overclaiming. Each robot company knows its own
 * robot. Nobody holds the cross-vendor mapping from real jobs to real
 * capability — because until now nobody has run the same job against several
 * robots and then watched what shipped.
 */
export const crossVendorRecord = {
  title: "Blueprint learns what nobody else can see",
  lines: [
    "Agility knows Digit. Figure knows Figure. Apptronik knows Apollo.",
    "Blueprint sees the same job evaluated by several of them, and then sees which prediction survived contact with the floor.",
  ],
  compounding: "Eventually we know whether a site is deployable before the robot company does.",
  honesty: "This record does not exist yet. It is what the model builds.",
} as const;
