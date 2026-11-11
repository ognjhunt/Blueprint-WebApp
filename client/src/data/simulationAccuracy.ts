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
  statement: "In one published head-to-head study, a simulation built from a scan of each scene picked the same better policy as tests on the real robot in 8 of 9 scene and task comparisons. With holes or stray specks added to the scan it fell to 7 of 9, and with 30% of the scan's images removed at random, to 6 of 9. In two other studies, simulated success rates tracked real ones with a correlation of about 0.9 on average and 0.81 in the worst scene, and of 0.77 to 0.96 depending on how the scene was rebuilt.",
  conditions: "Those studies tested research robots and research AI policies in carefully scanned scenes. In two of them, printed markers placed in the scene fixed its true size or lined the simulation up with the real one, and in one the simulated robot's movement was tuned to the real robot and the policies were given a little extra training in simulation. Where those conditions do not hold, agreement can be lower, as the first study found when it damaged or thinned out its scans.",
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
