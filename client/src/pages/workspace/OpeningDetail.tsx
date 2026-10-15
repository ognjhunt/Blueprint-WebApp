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
import { opportunityLabels, type TeamJobOpening } from "@/types/taskBrowse";
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
                  I understand the evaluation is free during the beta, and that a
                  physical pilot&rsquo;s dates and terms are agreed directly with the site.
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
