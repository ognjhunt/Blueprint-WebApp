import { useEffect, useMemo, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { EvaluationRunConfiguration } from "@/components/blueprint/app/EvaluationRunConfiguration";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildEvaluationReadyRunInput,
  createEvaluationReadyRun,
  fetchEvaluationReadySetup,
  type EvaluationReadySetupView,
} from "@/lib/evaluationReadyRuns";

function stableRunId(sourceLaunchId: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${sourceLaunchId.slice(0, 80)}-policy-run-${suffix}`.replace(/[^A-Za-z0-9._:-]/g, "-");
}

export default function EvaluationRunSetup() {
  const { sourceLaunchId = "" } = useParams<{ sourceLaunchId?: string }>();
  const decodedLaunchId = decodeURIComponent(sourceLaunchId);
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const [setup, setSetup] = useState<EvaluationReadySetupView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const runId = useMemo(() => stableRunId(decodedLaunchId), [decodedLaunchId]);

  useEffect(() => {
    if (!currentUser || !decodedLaunchId) return;
    let cancelled = false;
    setError(null);
    void fetchEvaluationReadySetup(currentUser, decodedLaunchId)
      .then((nextSetup) => {
        if (!cancelled) setSetup(nextSetup);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Evaluation setup is unavailable");
      });
    return () => { cancelled = true; };
  }, [currentUser, decodedLaunchId]);

  async function submit(configuration: { presetId: EvaluationReadySetupView["defaultPresetId"] }) {
    if (!currentUser || !setup) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = buildEvaluationReadyRunInput({
        runId,
        offeringDigest: setup.offeringDigest,
        ...configuration,
      });
      const receipt = await createEvaluationReadyRun({
        currentUser,
        sourceLaunchId: setup.sourceLaunchId,
        input,
      });
      navigate(`/app/evaluation-runs/${encodeURIComponent(receipt.run.run_id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evaluation could not be prepared");
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="runs" breadcrumb="testbeds / evaluation setup">
      <Helmet>
        <title>Configure evaluation · Blueprint</title>
        <meta name="description" content="Configure an exact two-candidate Franka Task Evaluation Run." />
      </Helmet>
      <div className="mx-auto flex max-w-[80rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href="/app/packs" className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
          <ArrowLeft className="size-4" aria-hidden="true" />Back to testbeds
        </Link>
        <header className="border-b border-line pb-5">
          <p className="runway-meta text-runway-signal">Evaluation ready</p>
          <h1 className="mt-2 font-display text-[1.65rem] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900">Set up your policy run</h1>
          <p className="mt-2 max-w-2xl text-body-s leading-6 text-ink-500">Choose episode depth, review the exact matrix, and start. Blueprint locks the hardware, policies, controls, evidence rules, team scope, and results notification.</p>
        </header>
        {!setup && !error ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error} /> : null}
        {setup ? <EvaluationRunConfiguration setup={setup} submitting={submitting} onSubmit={(value) => void submit(value)} /> : null}
      </div>
    </AppShell>
  );
}
