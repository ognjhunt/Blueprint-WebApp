import type { ReactNode } from "react";
import { Helmet } from "@/lib/helmet";

import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessButton } from "@/components/blueprint/app/EntitlementAccessTable";
import { ActionLink, Tag } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  entitlementDisplayName,
  entitlementStateLabel,
  formatEntitlementDate,
  runDisplayName,
  runStatusLabel,
  runStatusTone,
  useBuyerAppEntitlements,
  useBuyerAppRuns,
  type BuyerRunRecord,
} from "@/lib/buyerAppData";
import { resolvedCanaryCandidates } from "@/lib/policyCanaryResultPortal";
import {
  useTaskEvaluationResults,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

function resultTitle(result: TaskEvaluationResultSiteRecord) {
  const publication = result.publication;
  if (publication.run_kind === "internal_policy_canary") {
    const names = resolvedCanaryCandidates(result).map((candidate) => candidate.display_name);
    return names.length ? names.join(" vs ") : "Policy test";
  }
  return publication.decision_envelope?.decision_question || publication.task?.label || publication.run_id;
}

/** One stacked row per item, so the status and the next step stay visible on a phone. */
function Row({ title, meta, tag, action }: { title: ReactNode; meta?: ReactNode; tag?: ReactNode; action: ReactNode }) {
  return (
    <article className="ws-task-row">
      <div className="ws-task-copy">
        <h3>{title}</h3>
        {meta ? <p className="ws-muted">{meta}</p> : null}
        {tag ? <p>{tag}</p> : null}
      </div>
      {action}
    </article>
  );
}

function ResultRows({ results }: { results: TaskEvaluationResultSiteRecord[] }) {
  return (
    <div>
      {results.map((result) => {
        const delivery = result.publication.result_delivery;
        return (
          <Row
            key={result.record_id}
            title={resultTitle(result)}
            meta={[
              result.publication.run_kind === "internal_policy_canary" ? "Head-to-head policy test · simulation" : "Task evaluation",
              formatEntitlementDate(result.publication.completed_at_iso || result.updated_at_iso || result.created_at_iso),
              delivery?.status === "blocked" ? "some files unavailable" : null,
            ].filter(Boolean).join(" · ")}
            action={<ActionLink href={`/app/results/${encodeURIComponent(result.record_id)}`}>View results</ActionLink>}
          />
        );
      })}
    </div>
  );
}

function RunRows({ runs }: { runs: BuyerRunRecord[] }) {
  return (
    <div>
      {runs.map((run) => {
        const tone = runStatusTone(run.status);
        return (
          <Row
            key={run.job_id}
            title={runDisplayName(run)}
            meta={<><span className="break-all">{run.job_id}</span> · {formatEntitlementDate(run.created_at_iso)}</>}
            tag={<Tag tone={tone === "proof" ? "green" : tone === "block" ? "red" : "neutral"}>{runStatusLabel(run.status)}</Tag>}
            action={<ActionLink href={`/app/runs/${encodeURIComponent(run.job_id)}`}>View run</ActionLink>}
          />
        );
      })}
    </div>
  );
}

export default function Runs() {
  const { userData } = useAuth();
  const { runs, isLoading: runsLoading, error: runsError } = useBuyerAppRuns();
  const { results, isLoading: resultsLoading, error: resultsError } = useTaskEvaluationResults();
  const { entitlements, isLoading: entitlementsLoading } = useBuyerAppEntitlements();

  const isLoading = runsLoading || entitlementsLoading || resultsLoading;
  const loadError = runsError || resultsError;
  const siteOperator = userData?.buyerType === "site_operator";

  return (
    <AppShell active="runs" breadcrumb="runs">
      <Helmet>
        <title>Runs · Blueprint</title>
        <meta name="description" content="Your evaluation runs and results." />
      </Helmet>

      <header className="ws-heading">
        <div><h1>Runs</h1></div>
      </header>

      {isLoading ? <BuyerAppLoadingState /> : null}
      {!isLoading && loadError ? <BuyerAppErrorState message={loadError.message} /> : null}
      {!isLoading && !loadError ? (
        <>
          {results.length ? (
            <section className="ws-section" aria-label="Results">
              <h2 className="mb-4">Results</h2>
              <ResultRows results={results} />
            </section>
          ) : null}

          {runs.length ? (
            <section className="ws-section" aria-label="Run requests">
              <h2 className="mb-4">Requests</h2>
              <RunRows runs={runs} />
            </section>
          ) : null}

          {!results.length && !runs.length ? (
            <BuyerAppEmptyState
              title="No runs yet"
              body={siteOperator
                ? "Evaluations of your tasks appear on each task's page."
                : "When you evaluate a robot on a task, the run and its results appear here."}
              action={siteOperator
                ? <ActionLink href="/app/tasks" primary>Your tasks</ActionLink>
                : <ActionLink href="/app/opportunities" primary>Find a task</ActionLink>}
            />
          ) : null}

          {entitlements.length ? (
            <section className="ws-section" aria-label="Purchased access">
              <h2 className="mb-4">Purchased access</h2>
              <div>
                {entitlements.map((entitlement) => (
                  <Row
                    key={entitlement.id}
                    title={entitlementDisplayName(entitlement)}
                    meta={`${entitlementStateLabel(entitlement.access_state)} · granted ${formatEntitlementDate(entitlement.granted_at)}`}
                    action={<div className="ml-auto shrink-0"><EntitlementAccessButton entitlement={entitlement} /></div>}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
