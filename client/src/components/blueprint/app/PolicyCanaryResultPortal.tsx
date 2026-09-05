import { controlsVerified } from "@/lib/policyCanaryControls";
import { PolicyCanaryControls } from "./PolicyCanaryControls";
import type { ReactNode } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Check, ShieldAlert, X } from "lucide-react";

import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  applyPolicyCanaryEpisodeInterpretation,
  applyPolicyCanaryScoreCorrection,
  pairedCanaryComparison,
} from "@/lib/policyCanaryResultPortal";
import { findPublishedTaskSuccessContract } from "@/lib/rigidTaskSuccessContract";
import { PolicyCanaryEvidenceInventory } from "./PolicyCanaryEvidenceInventory";
import { PolicyCanaryEpisodeExplorer } from "./PolicyCanaryEpisodeExplorer";
import { PolicyCanaryPrimarySummary } from "./PolicyCanaryPrimarySummary";
import { PolicyCanaryReportOverview } from "./PolicyCanaryReportOverview";
import { TaskSuccessContractPanel } from "./TaskSuccessContractPanel";

function ReadingPoint({ tone, children }: { tone: "proof" | "block"; children: ReactNode }) {
  const Icon = tone === "proof" ? Check : X;
  return <li className="flex gap-2 text-body-s text-ink-700">
    <Icon
      className={`mt-0.5 size-4 shrink-0 ${tone === "proof" ? "text-runway-green" : "text-runway-red"}`}
      strokeWidth={2}
      aria-hidden="true"
    />
    <span className="min-w-0">{children}</span>
  </li>;
}

function HowToReadCanary({ result }: { result: TaskEvaluationResultSiteRecord }) {
  const comparison = pairedCanaryComparison(result);
  const matched = comparison?.comparablePairs ?? 0;
  const correction = result.score_correction;
  const interpretation = result.episode_interpretation;
  const controls = result.publication.policy_canary_result || result.publication.result_delivery || {};
  const verifiedControls = controlsVerified({ ...controls, scene_controls_status: result.publication.scene_controls_status });
  const visibility = result.access_visibility === "unlisted_public"
    ? "Anyone with this unlisted link can view this result and its published evidence."
    : result.access_visibility === "organization_members"
      ? "This result is scoped to your verified team and is not published across teams."
      : "This result is scoped to the run owner and is not published across teams.";

  return <section className="runway-panel p-5" aria-labelledby="how-to-read-canary">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-runway-signal" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="runway-meta text-runway-signal">Read before deciding</p>
          <h2 id="how-to-read-canary" className="mt-1 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">
            How to read this canary
          </h2>
        </div>
      </div>
      <StatusChip tone="warn" square>Diagnostic · unqualified simulation</StatusChip>
    </div>

    <div className="mt-5 grid gap-x-8 gap-y-5 border-t border-line pt-5 md:grid-cols-2">
      <div>
        <p className="runway-meta mb-2">What this establishes</p>
        <ul className="flex flex-col gap-2">
          <ReadingPoint tone="proof">Each policy&rsquo;s observed success rate on this one captured scene{matched ? `, across ${matched} matched scenario cells` : ""}.</ReadingPoint>
          <ReadingPoint tone="proof">Which policy led on this sample, and whether that gap is statistically distinguishable.</ReadingPoint>
          <ReadingPoint tone="proof">A digest-bound, re-downloadable evidence trail for every episode.</ReadingPoint>
        </ul>
      </div>
      <div>
        <p className="runway-meta mb-2">What it does not establish</p>
        <ul className="flex flex-col gap-2">
          <ReadingPoint tone="block">Physical-world success. This is simulation, and a sim ranking can invert on real hardware.</ReadingPoint>
          <ReadingPoint tone="block">A deployment or safety approval of either policy.</ReadingPoint>
          <ReadingPoint tone="block">An official ranking or scene promotion. {verifiedControls ? "The controls are verified for this simulation matrix; the result remains development-only." : "Control evidence has not been verified for this matrix."}</ReadingPoint>
        </ul>
      </div>
    </div>

    <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-caption text-ink-500">
      <p>{visibility}</p>
      <p>
        <span className="font-semibold text-ink-700">To advance this pair to physical trials,</span>{" "}
        the decision still needs an approved prospective protocol and physical outcome adjudication.
        Simulation controls do not provide physical evidence.
      </p>
      {correction || interpretation ? <details className="mt-1">
        <summary className="cursor-pointer font-semibold text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
          Post-publication adjustments applied
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {correction ? <p>
            Scoring was corrected after publication (a scoring-logic fix, not a re-run). It was applied
            identically to both policies, the original score receipts are preserved, and no winner is declared.
          </p> : null}
          {interpretation ? <p>
            An independent, learned interpretation was added for each episode after publication. It never
            changes the deterministic score, the ranking, or the promotion state, and remains bound to this
            exact run.
          </p> : null}
        </div>
      </details> : null}
    </div>
  </section>;
}

export function PolicyCanaryResultPortal({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const projectedResult = applyPolicyCanaryEpisodeInterpretation(
    applyPolicyCanaryScoreCorrection(result),
  );
  const successContract = findPublishedTaskSuccessContract(
    projectedResult.publication,
  );
  return <div className="flex flex-col gap-6">
    <PolicyCanaryPrimarySummary result={projectedResult} user={user} />
    <HowToReadCanary result={projectedResult} />
    {successContract ? <TaskSuccessContractPanel
      contract={successContract}
      title="Success criteria used for this result"
    /> : <ProofBoundary level="block" title="Success criteria not verified">
      The immutable pass/fail contract the scorer used was not delivered with this result, so the success
      rates above cannot yet serve as an acceptance test. Do not reinterpret completion from the review
      video alone — the deterministic criteria are the authority.
    </ProofBoundary>}
    <PolicyCanaryControls result={projectedResult} user={user} />
    <PolicyCanaryEpisodeExplorer result={projectedResult} user={user} />
    <PolicyCanaryReportOverview result={projectedResult} />
    <PolicyCanaryEvidenceInventory result={projectedResult} user={user} />
  </div>;
}
