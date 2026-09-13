import { useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useWorkspace, money, dateLabel } from "@/lib/workspace";
import { usePilotOpportunities } from "@/lib/pilotOpportunities";
import {
  Frame,
  Empty,
  Field,
  Feedback,
  useAction,
} from "@/components/workspace/WorkspaceUI";
export default function OpeningDetail() {
  const query = useWorkspace(),
    feed = usePilotOpportunities(),
    action = useAction(query),
    { opportunityId } = useParams<{ opportunityId: string }>(),
    [, navigate] = useLocation(),
    requestId = useRef(`application-${crypto.randomUUID()}`),
    item = feed.opportunities.find(
      (item) => item.opportunity_id === opportunityId,
    );
  return (
    <Frame
      query={query}
      active="opportunities"
      title={item?.workflow || "Opening"}
      back={{ href: "/app/opportunities", label: "Openings" }}
    >
      {feed.isLoading ? (
        <p role="status">Loading opening…</p>
      ) : feed.error ? (
        <div role="alert" className="ws-alert">
          {feed.error.message}
        </div>
      ) : !item ? (
        <Empty
          title="Opening unavailable"
          href="/app/opportunities"
          action="Browse openings"
        >
          This opening is not available to your account, or is no longer
          accepting evaluations.
        </Empty>
      ) : (
        <>
          <div className="ws-detail-header">
            <p>
              {item.site_type} ·{" "}
              {item.access_level === "anonymized"
                ? "Anonymized site"
                : item.site_name}
            </p>
          </div>
          <Feedback error={action.error} notice={action.notice} />
          <div className="ws-detail-grid ws-section">
            <div>
              <h2>The task</h2>
              <p className="ws-section">
                {item.anonymized_summary || item.workflow}
              </p>
              <h2 className="ws-section">Success criteria</h2>
              <dl className="ws-facts">
                <div>
                  <dt>Successful cycles</dt>
                  <dd>
                    {item.task_targets?.successRate != null
                      ? `At least ${item.task_targets.successRate}%`
                      : "See benchmark brief"}
                  </dd>
                </div>
                <div>
                  <dt>Cycle time</dt>
                  <dd>
                    {item.task_targets?.cycleTimeSeconds != null
                      ? `${item.task_targets.cycleTimeSeconds} seconds or less`
                      : "See benchmark brief"}
                  </dd>
                </div>
              </dl>
              <h2 className="ws-section">Pilot & deployment</h2>
              <dl className="ws-facts">
                <div>
                  <dt>Pilot budget</dt>
                  <dd>{money(item.pilot_budget_usd ?? null)}</dd>
                </div>
                <div>
                  <dt>Deployment budget</dt>
                  <dd>{money(item.deployment_budget_usd ?? null)}</dd>
                </div>
                <div>
                  <dt>Timing</dt>
                  <dd>{dateLabel(item.target_date ?? null)}</dd>
                </div>
              </dl>
              <details className="ws-section">
                <summary>Task details</summary>
                <p>{item.benchmark_profile}</p>
                {[
                  item.object_profile,
                  item.operational_profile,
                  item.integration_environment,
                  item.rollout_readiness,
                ]
                  .filter(Boolean)
                  .map((text, index) => (
                    <p key={index} className="ws-note">
                      {text}
                    </p>
                  ))}
              </details>
              <details>
                <summary>Data access & permissions</summary>
                <p>
                  Site-model files are hosted in Blueprint and cannot be
                  downloaded.
                </p>
                <dl className="ws-facts">
                  {[
                    ["Evaluate existing policy", "Granted"],
                    [
                      "Adapt for this site",
                      item.data_use_permissions.siteSpecificAdaptation,
                    ],
                    [
                      "Retain improvements",
                      item.data_use_permissions.retainImprovements,
                    ],
                    [
                      "General model training",
                      item.data_use_permissions.generalModelTraining,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value.replaceAll("_", " ")}</dd>
                    </div>
                  ))}
                </dl>
                <p className="ws-note">{item.compute_responsibility}</p>
              </details>
              <p className="ws-note">
                {item.access_level === "anonymized"
                  ? "Site identity is shared only after approval. "
                  : ""}
                Physical performance is confirmed in the pilot.
              </p>
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
                    opportunityId: item.opportunity_id,
                    setupId: String(values.get("setupId") || ""),
                    notes: String(values.get("notes") || ""),
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
                  I understand compute and pilot costs are agreed before work
                  starts.
                </span>
              </label>
              <div className="ws-form-actions">
                <button
                  className="ws-primary"
                  disabled={action.pending || !query.data?.setups.length}
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
