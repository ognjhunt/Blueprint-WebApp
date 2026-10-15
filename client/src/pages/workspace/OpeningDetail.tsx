import { useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  useWorkspace,
  workspaceRequest,
  WorkspaceRequestError,
} from "@/lib/workspace";
import { TaskFacts } from "@/components/site/TaskFacts";
import { opportunityLabels, type TeamEvaluationTerms, type TeamJobOpening } from "@/types/taskBrowse";
import {
  Frame,
  Empty,
  Field,
  Feedback,
  useAction,
} from "@/components/workspace/WorkspaceUI";

/**
 * One job an approved robot team may request an evaluation on.
 *
 * The server answers from the same rule as the job library's "Request a free
 * invited evaluation" link, so a team that follows that link, or the one in
 * its notification email, reaches the job. The team sees only the card the
 * site approved.
 */
export default function OpeningDetail() {
  const query = useWorkspace(),
    action = useAction(query),
    { currentUser, loading } = useAuth(),
    { opportunityId } = useParams<{ opportunityId: string }>(),
    [, navigate] = useLocation(),
    requestId = useRef(`application-${crypto.randomUUID()}`);
  const opening = useQuery({
    queryKey: ["workspace-opening", currentUser?.uid, opportunityId],
    enabled: Boolean(currentUser && !loading && opportunityId),
    queryFn: () =>
      workspaceRequest<{ opening: TeamJobOpening }>(
        currentUser,
        `/openings/${encodeURIComponent(opportunityId)}`,
      ),
    staleTime: 30_000,
    retry: (count, error) =>
      !(error instanceof WorkspaceRequestError && error.status < 500) &&
      count < 1,
  });
  const item = opening.data?.opening ?? null;
  const notOpen =
    opening.error instanceof WorkspaceRequestError &&
    opening.error.status === 404;
  return (
    <Frame
      query={query}
      active="opportunities"
      title={item?.title || "Opening"}
      back={{ href: "/app/library", label: "Task library" }}
    >
      {loading || opening.isLoading ? (
        <p role="status">Loading opening…</p>
      ) : opening.error && !notOpen ? (
        <div role="alert" className="ws-alert">
          {opening.error.message}
        </div>
      ) : !item ? (
        <Empty
          title="Opening unavailable"
          href="/app/library"
          action="Task library"
        >
          This opening is not available to your account, or is no longer
          accepting evaluations.
        </Empty>
      ) : (
        <>
          <div className="ws-detail-header">
            <p>
              {[item.siteType, item.region].filter(Boolean).join(" · ") ||
                "Site job"}{" "}
              · Anonymized site
            </p>
          </div>
          <Feedback error={action.error} notice={action.notice} />
          <div className="ws-detail-grid ws-section">
            <div>
              <h2>The job</h2>
              <p className="ws-section">
                Job type: {item.taskFamily} · {opportunityLabels[item.opportunity]}
              </p>
              <TaskFacts details={item} className="ws-facts" />
              <details className="ws-section">
                <summary>Data access</summary>
                <p>
                  Site-model files are hosted in Blueprint and cannot be
                  downloaded. Footage and the site&rsquo;s contacts stay
                  private.
                </p>
              </details>
              <p className="ws-note">
                Site identity is shared only after approval. Physical
                performance is confirmed in the pilot.
              </p>
              {item.evaluation ? <EvaluationTerms terms={item.evaluation} /> : null}
            </div>
            <form
              method="post"
              className="ws-opening-request"
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                void action.perform(
                  "/evaluations",
                  {
                    id: requestId.current,
                    opportunityId: item.id,
                    setupId: String(values.get("setupId") || ""),
                    notes: String(values.get("notes") || ""),
                    purpose: values.get("purpose") === "scored" ? "scored" : "practice",
                    licenseToRun: values.get("licenseToRun") === "on" ? true : undefined,
                  },
                  () => navigate(`/app/evaluations/${requestId.current}`),
                );
              }}
            >
              <h2>Request an evaluation</h2>
              <div className="ws-section">
                <Field label="Robot & policy">
                  <select name="setupId" required defaultValue="">
                    <option value="" disabled>
                      Choose a saved setup
                    </option>
                    {query.data?.setups.map((setup) => (
                      <option key={setup.id} value={setup.id}>
                        {setup.name} · {setup.policyName} {setup.version}
                      </option>
                    ))}
                  </select>
                </Field>
                <Link
                  className="ws-link"
                  style={{ marginTop: 10 }}
                  href="/settings?tab=robots"
                >
                  Manage setups
                </Link>
              </div>
              {item.evaluation ? (
                <fieldset className="ws-section">
                  <legend>Run</legend>
                  <label className="ws-check">
                    <input type="radio" name="purpose" value="practice" required
                      defaultChecked={item.evaluation.practice.available}
                      disabled={!item.evaluation.practice.available} />
                    <span>
                      Practice: the {item.evaluation.practice.episodes} published cells, with every
                      episode&rsquo;s outcome returned to you. Never shown to the site.
                    </span>
                  </label>
                  <label className="ws-check">
                    <input type="radio" name="purpose" value="scored" required
                      defaultChecked={!item.evaluation.practice.available && item.evaluation.scored.available}
                      disabled={!item.evaluation.scored.available} />
                    <span>
                      Scored: {item.evaluation.scored.episodes} cells you have not seen. The only run a
                      recommendation can rest on.
                      {!item.evaluation.scored.available
                        ? " Not open yet for this job."
                        : ""}
                    </span>
                  </label>
                </fieldset>
              ) : null}
              <div className="ws-section">
                <Field label="Notes (optional)">
                  <textarea
                    name="notes"
                    maxLength={3000}
                    placeholder="Add any relevant notes…"
                  />
                </Field>
              </div>
              <label className="ws-check">
                <input type="checkbox" required />
                <span>
                  I understand the evaluation is free during the beta, and that a
                  physical pilot&rsquo;s dates and terms are agreed directly with the site.
                </span>
              </label>
              <label className="ws-check">
                <input type="checkbox" name="licenseToRun" required />
                <span>
                  I license Blueprint to run this policy for this evaluation only. Blueprint&rsquo;s
                  simulator scores every episode; my service returns actions, never results.
                </span>
              </label>
              <div className="ws-form-actions">
                <button
                  className="ws-primary"
                  disabled={action.pending || !query.data?.setups.length || (item.evaluation
                    ? !item.evaluation.practice.available && !item.evaluation.scored.available : false)}
                >
                  {action.pending ? "Requesting…" : "Request evaluation →"}
                </button>
              </div>
              <p className="ws-note">
                Blueprint reviews compatibility and confirms the run before
                execution.
              </p>
            </form>
          </div>
        </>
      )}
    </Frame>
  );
}

const FAMILY_LABELS: Record<string, string> = {
  canonical_anchor: "Nominal scene",
  placement_approach: "Object placement and yaw",
  illumination: "Lighting",
  camera_sensor: "Camera position",
  bounded_physics: "Surface friction",
  pairwise_stress: "Two variations at once",
  held_out_composition: "Every variation at once",
};

function EvaluationTerms({ terms }: { terms: TeamEvaluationTerms }) {
  return (
    <section className="ws-section" aria-labelledby="evaluation-terms">
      <h2 id="evaluation-terms">How your evaluation runs</h2>
      <p>Instruction your policy receives: &ldquo;{terms.instruction}&rdquo;</p>
      <p>
        Blueprint&rsquo;s simulator decides every episode from the task object&rsquo;s state
        against the job&rsquo;s success contract. Results are a bounded simulation estimate;
        they never certify physical performance or safety.
      </p>
      <details className="ws-section">
        <summary>Practice: {terms.practice.episodes} published cells</summary>
        <ul>
          {terms.practice.cells.map((cell) => (
            <li key={cell.cellId}>
              {FAMILY_LABELS[cell.family] ?? cell.family}
              {Object.keys(cell.parameters).length
                ? `: ${Object.entries(cell.parameters).map(([name, value]) => `${name} ${value}`).join(", ")}`
                : ""}
            </li>
          ))}
        </ul>
      </details>
      <details className="ws-section">
        <summary>Scored: {terms.scored.episodes} hidden cells</summary>
        <p>Drawn from these variations, the same for every team on this job:</p>
        <ul>
          {terms.scored.families.map((family) => (
            <li key={family}>{FAMILY_LABELS[family] ?? family}</li>
          ))}
        </ul>
        <ul>
          {Object.entries(terms.scored.parameterBounds).map(([name, [low, high]]) => (
            <li key={name}>{name}: {low} to {high}</li>
          ))}
        </ul>
      </details>
      <details className="ws-section">
        <summary>Policy interfaces</summary>
        <ul>
          {terms.policyInterfaces.map((row) => (
            <li key={row.policyInterfaceId}>
              <code>{row.policyInterfaceId}</code>: {row.summary}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
