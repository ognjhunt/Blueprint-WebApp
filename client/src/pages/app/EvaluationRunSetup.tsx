import { useEffect, useMemo, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useLocation, useParams } from "wouter";

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

import TeamEvaluationSelection from "./TeamEvaluationSelection";

export default function EvaluationRunSetup() {
  return new URLSearchParams(window.location.search).get("select") === "team"
    ? <TeamEvaluationSelection /> : <PreparedEvaluationRunSetup />;
}

function PreparedEvaluationRunSetup() {
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
    <AppShell active="packs" breadcrumb="tasks / set up">
      <Helmet>
        <title>Set up an evaluation · Blueprint</title>
        <meta name="description" content="Choose how many scenarios to run and start an evaluation." />
      </Helmet>
      <Link className="ws-back" href="/app/packs">← Tasks</Link>
      <header className="ws-heading">
        <div>
          <h1>Set up an evaluation</h1>
          {setup ? <p className="mt-2">{setup.sceneLabel} · {setup.taskLabel}</p> : null}
        </div>
      </header>
      {!setup && !error ? <BuyerAppLoadingState /> : null}
      {error ? <BuyerAppErrorState message={error} /> : null}
      {setup ? <EvaluationRunConfiguration setup={setup} submitting={submitting} onSubmit={(value) => void submit(value)} /> : null}
    </AppShell>
  );
}
