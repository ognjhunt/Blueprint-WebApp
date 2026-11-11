/**
 * Site answers for tests and the browser spec. TEST DATA ONLY: every source
 * link points at `example.test`, and no quote or figure here is a real claim.
 */
import { SITE_ANSWER_NOTE, SITE_ANSWER_SCHEMA, type SiteAnswer } from "../../src/lib/siteAnswer";

const DIGEST = `sha256:${"c".repeat(64)}`;

const base = {
  schemaVersion: SITE_ANSWER_SCHEMA,
  note: SITE_ANSWER_NOTE,
  checked: { models: 22, makers: 13, specsRetrievedOn: "2026-11-11" },
  introductionRequestedAtIso: null,
  basisDigest: DIGEST,
} as const;

const palletFacts: SiteAnswer["facts"] = [
  { label: "Weight of each carton", display: "8–11 kg", basis: "video_estimate" },
  { label: "Distance between the two spots", display: "about 1.6 m", basis: "video_estimate" },
  { label: "Height of the pallet stack", display: "up to 1.2 m", basis: "site_stated" },
];

export const readyAnswer: SiteAnswer = {
  ...base,
  state: "ready",
  headline: "Most likely to fit: Universal Robots UR10e.",
  job: { sentence: "Move cartons from the end of the conveyor onto the pallet.", drafted: true, family: "palletizing", familyLabel: "palletizing" },
  facts: palletFacts,
  pick: {
    modelId: "universal_robots_ur10e",
    name: "UR10e",
    manufacturer: "Universal Robots",
    formLabel: "One arm that stays in one place",
    verdict: "fits_on_paper",
    sceneChecked: false,
    checks: [
      { key: "reach", outcome: "pass", estimated: true,
        text: "Reach: your two spots are about 1.6 m apart (estimated from your video), so an arm standing between them needs about 0.9–1.2 m. This arm reaches 1.3 m." },
      { key: "payload", outcome: "pass", estimated: true,
        text: "Weight: each carton is about 8–11 kg (estimated from your video), about 9–12 kg with the gripper. This arm lifts 12.5 kg." },
    ],
    specs: [
      { label: "Reach", display: "1.3 m", sourceUrl: "https://specs.example.test/universal-robots/ur10e#reach" },
      { label: "Rated payload", display: "12.5 kg", sourceUrl: "https://specs.example.test/universal-robots/ur10e#payload" },
    ],
    evidence: [
      { level: "production", scope: "model",
        summary: "A test distributor runs UR10e arms on its end-of-line carton palletizing.",
        quote: "Four UR10e cells now palletize every carton leaving our TEST line, two shifts a day.",
        sourceUrl: "https://news.example.test/case-studies/ur10e-carton-palletizing",
        sourceTitle: "TEST case study: carton palletizing with the UR10e",
        publisher: "Example Test News", publishedOn: "2025-03-01" },
      { level: "offered", scope: "maker",
        summary: "The maker markets its arms for palletizing.",
        quote: "Our TEST palletizing kit pairs with any e-Series arm.",
        sourceUrl: "https://maker.example.test/applications/palletizing",
        sourceTitle: "TEST palletizing application page",
        publisher: "Example Test Maker", publishedOn: null },
    ],
  },
  runnerUp: {
    modelId: "yaskawa_hc20",
    name: "HC20DTP",
    manufacturer: "Yaskawa",
    formLabel: "One arm that stays in one place",
    verdict: "fits_on_paper",
    sceneChecked: false,
    checks: [
      { key: "reach", outcome: "pass", estimated: true,
        text: "Reach: an arm standing between your spots needs about 0.9–1.2 m. This arm reaches 1.7 m." },
      { key: "payload", outcome: "pass", estimated: true,
        text: "Weight: about 9–12 kg with the gripper. This arm lifts 20 kg." },
    ],
    specs: [
      { label: "Reach", display: "1.7 m", sourceUrl: "https://specs.example.test/yaskawa/hc20dtp#reach" },
      { label: "Rated payload", display: "20 kg", sourceUrl: "https://specs.example.test/yaskawa/hc20dtp#payload" },
    ],
    evidence: [
      { level: "pilot", scope: "model",
        summary: "A test integrator piloted the HC20DTP on case palletizing at a named customer.",
        quote: "The TEST pilot ran the HC20DTP on mixed cases for six weeks.",
        sourceUrl: "https://integrator.example.test/blog/hc20-case-palletizing-pilot",
        sourceTitle: "TEST pilot notes: HC20DTP case palletizing",
        publisher: "Example Test Integrator", publishedOn: "2024-09-15" },
    ],
  },
  alsoFit: [
    { name: "UR20", manufacturer: "Universal Robots" },
    { name: "UR30", manufacturer: "Universal Robots" },
    { name: "GoFa CRB 15000-12/1.27", manufacturer: "ABB" },
  ],
  ruledOut: [
    { name: "UR5e", manufacturer: "Universal Robots", estimated: true,
      reason: "Weight: each carton is about 8–11 kg (estimated from your video). This arm lifts 5 kg." },
    { name: "Research 3 (FR3)", manufacturer: "Franka Robotics", estimated: true,
      reason: "Weight: each carton is about 8–11 kg (estimated from your video). This arm lifts 3 kg." },
  ],
  ruledOutMore: 9,
  formNote: null,
  unknowns: [
    "Whether there is floor space for the robot between the two spots.",
    "The gripper the cartons need.",
    "How many different objects the job handles: we also saw shrink-wrapped trays.",
    "Safety around people, which the company that installs the robot assesses at your site.",
  ],
  confidence: {
    level: "fair",
    reasons: [
      "The weight and distances are estimated from your video.",
      "We found documented production use of this robot for palletizing.",
    ],
    raiseIt: ["Tell us the cartons' weight.", "A measured scene of your work area.", "A pilot at your site."],
  },
  nextStep: { kind: "introduction", text: "Ask Blueprint to introduce you to a company that can pilot this at your site." },
  reason: null,
};

export const noPickAnswer: SiteAnswer = {
  ...base,
  state: "ready",
  headline: "None of the 22 robots we checked fits this job on the numbers we have.",
  job: { sentence: "Lift engine blocks from the cart onto the test stand.", drafted: false, family: "pick_place", familyLabel: "pick and place" },
  facts: [
    { label: "Weight of each block", display: "about 180 kg", basis: "site_stated" },
    { label: "Distance between the two spots", display: "about 2.4 m", basis: "video_estimate" },
  ],
  pick: null,
  runnerUp: null,
  alsoFit: [],
  ruledOut: [
    { name: "UR30", manufacturer: "Universal Robots", estimated: false, reason: "Weight: each block is about 180 kg (you told us). This arm lifts 30 kg." },
  ],
  ruledOutMore: 21,
  formNote: "This job needs a robot that moves between the two spots.",
  unknowns: ["Whether there is floor space for the robot between the two spots."],
  confidence: { level: "low", reasons: ["The block is heavier than any robot we checked can lift."], raiseIt: [] },
  nextStep: { kind: "none", text: "" },
  reason: "Every robot we checked is rated for less than the weight you gave us.",
};

export const cannotAssessAnswer: SiteAnswer = {
  ...base,
  state: "cannot_assess",
  headline: "We can't check robots against this job yet.",
  job: { sentence: null, drafted: false, family: null, familyLabel: null },
  facts: [],
  pick: null,
  runnerUp: null,
  alsoFit: [],
  ruledOut: [],
  ruledOutMore: 0,
  formNote: null,
  unknowns: [],
  confidence: { level: "low", reasons: [], raiseIt: [] },
  nextStep: { kind: "none", text: "" },
  reason: "The video did not show the job clearly enough for us to size it.",
};

export const readingAnswer: SiteAnswer = {
  ...cannotAssessAnswer,
  state: "reading",
  headline: "We are reading your video. Your answer will appear here.",
  reason: null,
};
