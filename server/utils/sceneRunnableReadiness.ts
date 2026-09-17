/**
 * A scene existing is not the same as an evaluation being able to run against it.
 *
 * ## The gap this closes
 *
 * `loadRunnableSites` treated a site as runnable supply once a world manifest
 * existed -- `hasBuiltScene`. That proves the scene was *reconstructed*. It does
 * not prove that our evaluation harness can load it, that a collider exists, that
 * spawn poses are valid, or that a simulator has ever successfully stepped it.
 * Those are integration facts, and a manifest does not carry them.
 *
 * Selling a reconstructed-but-unverified scene as runnable means the first team
 * to buy an evaluation against it is the one who discovers whether integration
 * works -- on their dollar, and as a failed or refunded run rather than a
 * result. That is precisely the "scene exists != runnable" hole, and it is also
 * fabricated readiness, which this repo forbids by name.
 *
 * ## What counts as proof, and why the default is closed
 *
 * Runnability is a claim about *our* delivery, not a judgement about the site,
 * so the safe default is the opposite of the one coverage uses. Unmeasured
 * coverage must never be read as "does not cover", because that would drop a
 * site for something it did nothing wrong on. Unmeasured runnability must never
 * be read as "runnable", because that would sell something we have not verified
 * we can deliver. Absent evidence, the honest answer here is no.
 *
 * The evidence is one of two internal verifications the Pipeline records on the
 * request's `evaluation_readiness`:
 *
 * - **Execution proven.** A simulator has actually stepped this scene in our own
 *   preflight -- CPU smoke or owner GPU. This is the strongest signal: we have
 *   already discovered that integration works, so a paying team does not have to.
 * - **Runtime launchable.** The runtime reports the scene as launchable. A
 *   verified property alongside runtime health and registration, not a guess
 *   read off the manifest.
 *
 * Either establishes that the scene runs. On top of that there has to be
 * something to score -- a benchmark task, or an episode spec -- because a scene
 * that opens with no task defined is a viewer, not an evaluation. And an
 * explicit `runtime_launchable === false` vetoes both, because a current
 * negative outranks a stale proof: a scene that used to step and no longer
 * launches is not runnable today.
 *
 * ## Arithmetic, not judgement
 *
 * Every input is a value the Pipeline already reports. This module reads them
 * and applies the rule; it does not infer runnability from anything softer, the
 * same way `evalSelection` sorts rather than guesses.
 */

import type { EvaluationReadinessSummary } from "../types/inbound-request";

export interface SceneRunnableVerdict {
  /** True only when an internal check has established the scene can be run against. */
  runnable: boolean;
  /** Why, in a line a person reading the supply query can follow. */
  reason: string;
}

/**
 * Whether an evaluation can actually run against this scene.
 *
 * Takes the Pipeline's `evaluation_readiness` summary and returns a verdict that
 * fails closed: a summary that is absent, partial, or explicitly negative is not
 * runnable. The reason is carried so a scene held back from supply can say why
 * rather than just disappearing from it.
 */
export function sceneRunnableReadiness(
  summary: EvaluationReadinessSummary | null | undefined,
): SceneRunnableVerdict {
  // A current negative outranks any past proof. If the runtime says it will not
  // launch, it does not matter that a simulator once stepped it.
  if (summary?.runtime_launchable === false) {
    return {
      runnable: false,
      reason: "The runtime reports this scene as not launchable, so an evaluation cannot start.",
    };
  }

  const preflight = summary?.robot_eval_preflight_summary ?? null;

  // Integration works is a thing we prove, not a thing we assume from a scene
  // file existing.
  const executionProven =
    preflight?.simulator_execution_proven === true ||
    preflight?.owner_gpu_simulator_execution_proven === true;
  const runtimeLaunchable = summary?.runtime_launchable === true;

  if (!executionProven && !runtimeLaunchable) {
    return {
      runnable: false,
      reason:
        "Runnability is unverified: no simulator has been shown to step this scene and the " +
        "runtime has not reported it launchable. A world manifest proves reconstruction, not " +
        "that an evaluation can run.",
    };
  }

  // Launching is not enough; there has to be something to score.
  const hasBenchmark =
    summary?.benchmark_coverage_status === "ready" ||
    (typeof summary?.benchmark_task_count === "number" && summary.benchmark_task_count > 0) ||
    (typeof preflight?.episode_count === "number" && preflight.episode_count > 0);

  if (!hasBenchmark) {
    return {
      runnable: false,
      reason:
        "The scene runs but no benchmark task is defined against it, so there is nothing for an " +
        "evaluation to score.",
    };
  }

  return {
    runnable: true,
    reason: executionProven
      ? "Internal preflight proved a simulator steps this scene, and a benchmark task is defined."
      : "The runtime reports this scene launchable, and a benchmark task is defined.",
  };
}
