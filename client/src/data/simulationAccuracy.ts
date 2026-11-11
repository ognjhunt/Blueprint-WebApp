/**
 * How well a simulation built from a scan of a real scene agrees with tests on
 * the real robot, as published. Read with the simulation results on a job page.
 *
 * Every figure here is `published` in the sense of `client/src/data/deploymentMarket.ts`:
 * a third party stated it in a named public paper, reproducible by opening the
 * source link. Each source was opened on `retrievedOn`, its exact title read
 * from the page, and the sentence that carries the figure is quoted beside it.
 * Nothing here is a Blueprint estimate, and none of it is a claim about a
 * particular site: the conditions travel with the figures, always.
 *
 * Consequence for anyone editing this file: a figure with no confirmed source
 * does not belong here. Add the source or drop the figure.
 */

export interface SimulationAccuracySource {
  /** The paper's exact title as its page gives it. */
  title: string;
  url: string;
}

export interface SimulationAccuracy {
  statement: string;
  conditions: string;
  sources: SimulationAccuracySource[];
  retrievedOn: string;
}

export const SIMULATION_ACCURACY: SimulationAccuracy = {
  statement: "In published tests on research robots, a simulation built from a scan of the scene picked the better of two policies in 8 of 9 comparisons, and simulated scores tracked real ones closely (a correlation of about 0.9 on average). With a damaged or thinned-out scan, the same test fell to 7 or 6 of 9.",
  conditions: "Those tests used research robots and AI policies in carefully scanned scenes, most with printed markers that fixed the scene's true size, and in one the simulated robot's motion was tuned to match the real one. Where those conditions do not hold, agreement can be lower.",
  sources: [
    // Opened 2026-11-11 (abs and html). Title confirmed. Quotes: "Clean simulation reproduces the observed real policy
    // ranking in 8 of 9 scene–task comparisons (88.9%)." and "Agreement is 7/9 under holes and floaters and 6/9 under
    // Random 30% removal". Setup: "two π0.5-based candidate policies per task across three scenes and three tasks",
    // "a dual Franka FR3 setup" and "a TX-G2 (AgiBot-G2-compatible) platform".
    { title: "YUBI-Real2Sim: 3DGS Scene Verification for Reliable Policy Evaluation", url: "https://arxiv.org/abs/2610.17521" },
    // Opened 2026-11-11 (abs and html). Title confirmed. Quotes: "PolaRiS evaluations match the real-world performance of
    // state-of-the-art generalist policies out of the box with an average Pearson correlation of r = 0.9" and "the
    // worst-case correlation across all six tested environments is r = 0.81". Conditions: "a ChArUco board is placed in
    // the environment" (to resolve "metric scale"); "We collect a small number of demonstrations in simulation and
    // co-finetune policies with this data"; "PolaRiS performs a relatively simplistic identification of system dynamics".
    { title: "PolaRiS: Scalable Real-to-Sim Evaluations for Generalist Robot Policies", url: "https://arxiv.org/abs/2512.16881" },
    // Opened 2026-11-11 (abs and html). Title confirmed. Quote (Table II, three reconstructions): "real-sim Pearson r ↑
    // 0.773 0.850 0.960"; "PGSR-D achieves the highest Pearson correlation (r = 0.960)". Condition: "ArUco markers are
    // used as spatial references to match the robot and task-object configurations between the real and simulated".
    { title: "ReVeal: A Reconstruction-Aware Real-to-Sim Framework for VLA Policy Evaluation", url: "https://arxiv.org/abs/2609.23910" },
  ],
  retrievedOn: "2026-11-11",
};

/**
 * The same published figures and conditions as `SIMULATION_ACCURACY`, in short labelled rows for the job page's
 * "How far to trust it" screen. Each row restates one clause of `statement` or `conditions`; nothing is added.
 */
export const SIMULATION_ACCURACY_ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Picked the better", value: "In published tests on research robots, a simulation built from a scan of the scene picked the better of two policies in 8 of 9 comparisons." },
  { label: "Scores", value: "Simulated scores tracked real ones closely: a correlation of about 0.9 on average." },
  { label: "Poor scan", value: "With a damaged or thinned-out scan, it fell to 7 or 6 of 9." },
  { label: "Those tests used", value: "Research robots and AI policies, carefully scanned scenes, most with printed markers for the true size; one tuned the simulated robot's motion to the real one." },
  { label: "Otherwise", value: "Where those conditions do not hold, agreement can be lower." },
];
