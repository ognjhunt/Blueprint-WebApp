import { canaryGradedReport } from "@/lib/policyCanaryResultPortal";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { WrapAtUnderscores } from "./PolicyCanaryPrimarySummary";

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function seconds(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} s`;
}

/**
 * How far each policy got through the task, what went wrong on the way, and
 * how smooth and quick it was: detail behind the pass/fail counts, derived
 * from the same recorded episodes. Nothing here changes a score.
 */
export function PolicyCanaryGradedReport({ result }: { result: TaskEvaluationResultSiteRecord }) {
  const candidates = canaryGradedReport(result);
  if (!candidates?.length) return null;
  const wrongObjectMeasured = candidates.some((candidate) => candidate.wrong_object_measured);
  return <section aria-labelledby="canary-graded-title">
    <h2 id="canary-graded-title">How far each policy got</h2>
    <p className="mt-2 max-w-3xl text-ink-600">
      Each episode is broken into the task's steps, in order. A step counts only once every earlier
      step has, so progress shows how far a policy got even when it didn't finish.
    </p>
    <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-8">
      {candidates.map((candidate) => <section
        key={candidate.candidate_id}
        aria-label={`${candidate.display_name} progress`}
        className="min-w-0"
      >
        <h3 className="text-base font-medium [overflow-wrap:anywhere]">
          <WrapAtUnderscores text={candidate.display_name} />
        </h3>
        <p className="mt-1 text-sm text-ink-600">
          Average progress {percent(candidate.mean_progress)} across {candidate.graded_episode_count} of{" "}
          {candidate.episode_count} episode{candidate.episode_count === 1 ? "" : "s"}
        </p>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-ink-500">
              <th scope="col" className="py-1.5 pr-3 font-normal">Step</th>
              <th scope="col" className="py-1.5 text-right font-normal">Episodes that got there</th>
            </tr>
          </thead>
          <tbody>
            {candidate.stages.map((stage) => <tr key={stage.id} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-normal">{stage.label}</th>
              <td className="py-2 text-right tabular-nums">{percent(stage.rate)}</td>
            </tr>)}
          </tbody>
        </table>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-ink-500">Episodes with a drop</dt><dd className="tabular-nums">{candidate.episodes_with_drop}</dd></div>
          <div><dt className="text-ink-500">Episodes with a collision</dt><dd className="tabular-nums">{candidate.episodes_with_collision}</dd></div>
          <div><dt className="text-ink-500">Typical episode length</dt><dd className="tabular-nums">{seconds(candidate.median_duration_s)}</dd></div>
          <div><dt className="text-ink-500">Typical time to finish</dt><dd className="tabular-nums">{seconds(candidate.median_settled_at_s)}</dd></div>
          <div><dt className="text-ink-500">Smoothness (SPARC)</dt><dd className="tabular-nums">{candidate.median_sparc === null ? "—" : candidate.median_sparc.toFixed(2)}</dd></div>
        </dl>
      </section>)}
    </div>
    <ul className="mt-6 flex max-w-3xl flex-col gap-1.5 text-sm text-ink-600">
      <li>Derived from the same recorded episodes as the scores above. It doesn't change a score or pick a winner.</li>
      <li>Time to finish counts only completed episodes. Smoothness is spectral arc length of the gripper's speed; closer to zero is smoother.</li>
      {wrongObjectMeasured ? null : <li>Wrong-object grasps can't happen in a scene with one task object, so they aren't reported.</li>}
    </ul>
  </section>;
}
