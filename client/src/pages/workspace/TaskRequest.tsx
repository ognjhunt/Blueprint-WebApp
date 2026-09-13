import { useRef } from "react";
import { Link, useLocation } from "wouter";
import { useWorkspace } from "@/lib/workspace";
import {
  Frame,
  Field,
  Feedback,
  Empty,
  useAction,
} from "@/components/workspace/WorkspaceUI";
export default function TaskRequest() {
  const query = useWorkspace(),
    action = useAction(query),
    [, navigate] = useLocation(),
    requestId = useRef(`task-${crypto.randomUUID()}`);
  return (
    <Frame
      query={query}
      active="tasks"
      title="Request a task"
      back={{ href: "/app/tasks", label: "Your tasks" }}
    >
      {query.data?.role !== "site_operator" ? (
        <Empty
          title="This is your robot-team workspace"
          href="/app/opportunities"
          action="Browse openings"
        >
          Choose an opening to request an evaluation.
        </Empty>
      ) : (
        <>
          <Feedback error={action.error} notice={action.notice} />
          <form
            method="post"
            className="ws-form"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget),
                value = (name: string) => String(values.get(name) || "").trim(),
                numeric = (name: string) =>
                  value(name) ? Number(value(name)) : null;
              void action.perform(
                "/tasks",
                {
                  id: requestId.current,
                  title: value("title"),
                  siteName: value("siteName"),
                  location: value("location"),
                  siteType: value("siteType"),
                  notes: value("notes"),
                  visibility: values.get("share") ? "anonymized" : "private",
                  terms: {
                    successRate: numeric("successRate"),
                    cycleTimeSeconds: numeric("cycleTimeSeconds"),
                    pilotBudgetUsd: numeric("pilotBudgetUsd"),
                    deploymentBudgetUsd: numeric("deploymentBudgetUsd"),
                    targetDate: value("targetDate")
                      ? new Date(
                          `${value("targetDate")}T12:00:00Z`,
                        ).toISOString()
                      : null,
                    successDefinition: value("successDefinition"),
                  },
                },
                () => navigate(`/app/tasks/${requestId.current}`),
              );
            }}
          >
            <div className="ws-fields">
              <Field label="Task name" wide>
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="e.g. Pack cartons into totes"
                />
              </Field>
              <Field label="Site name">
                <input
                  name="siteName"
                  required
                  maxLength={160}
                  placeholder="e.g. Austin packing line"
                />
              </Field>
              <Field label="Site address">
                <input
                  name="location"
                  required
                  maxLength={160}
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Site type">
                <select name="siteType" required defaultValue="">
                  <option value="" disabled>
                    Choose a site type
                  </option>
                  <option>Fulfillment</option>
                  <option>Manufacturing</option>
                  <option>Distribution</option>
                  <option>Retail</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Target start date (optional)">
                <input name="targetDate" type="date" />
              </Field>
            </div>
            <h2>What does success look like?</h2>
            <div className="ws-fields">
              <Field label="Success definition" wide>
                <textarea
                  name="successDefinition"
                  required
                  maxLength={3000}
                  placeholder="Describe the completed task and unacceptable failures"
                />
              </Field>
              <Field label="Success rate target (%)" hint="Optional">
                <input
                  name="successRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="95"
                />
              </Field>
              <Field label="Cycle time target (seconds)" hint="Optional">
                <input
                  name="cycleTimeSeconds"
                  type="number"
                  min="0.01"
                  max="86400"
                  step="0.01"
                  placeholder="30"
                />
              </Field>
            </div>
            <details className="ws-section">
              <summary>Pilot budget, deployment budget & notes</summary>
              <div className="ws-fields">
                <Field label="Pilot budget (USD)">
                  <input
                    name="pilotBudgetUsd"
                    type="number"
                    min="0"
                    max="1000000000"
                  />
                </Field>
                <Field label="Deployment budget (USD)">
                  <input
                    name="deploymentBudgetUsd"
                    type="number"
                    min="0"
                    max="1000000000"
                  />
                </Field>
                <Field label="Anything else we should know?" wide>
                  <textarea name="notes" maxLength={3000} />
                </Field>
              </div>
            </details>
            <label className="ws-check">
              <input name="share" type="checkbox" />
              <span>
                Share an anonymized opening after Blueprint reviews this task.
                <small
                  className="ws-note"
                  style={{ display: "block", marginTop: 3 }}
                >
                  Your site remains private until the review is complete.
                </small>
              </span>
            </label>
            <div className="ws-form-actions">
              <button
                className="ws-primary"
                type="submit"
                disabled={action.pending}
              >
                {action.pending ? "Requesting…" : "Request task →"}
              </button>
              <Link className="ws-link" href="/app/tasks">
                Cancel
              </Link>
            </div>
          </form>
        </>
      )}
    </Frame>
  );
}
