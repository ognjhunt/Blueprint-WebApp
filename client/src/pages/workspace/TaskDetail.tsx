import { NextTaskUpdate } from "@/components/site/NextTaskUpdate";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { useWorkspace, dateLabel, money, statusLabel } from "@/lib/workspace";
import {
  Frame,
  Empty,
  Tag,
  Field,
  Modal,
  Feedback,
  Score,
  useAction,
} from "@/components/workspace/WorkspaceUI";
import type { WorkspaceTask, WorkspaceResult } from "@/types/workspace";
function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="ws-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export default function TaskDetail() {
  const query = useWorkspace(),
    action = useAction(query),
    { taskId } = useParams<{ taskId: string }>(),
    task = query.data?.tasks.find((item) => item.id === taskId);
  const [tab, setTab] = useState(
      new URLSearchParams(window.location.search).get("tab") || "results",
    ),
    [captureAction, setCaptureAction] = useState<
      "request" | "reschedule" | "cancel" | null
    >(null),
    [pilotAction, setPilotAction] = useState<string | null>(null),
    [selection, setSelection] = useState<WorkspaceResult | null>(null),
    [details, setDetails] = useState<WorkspaceResult | null>(null),
    [editing, setEditing] = useState(false);
  const endpoint = `/tasks/${encodeURIComponent(taskId || "")}`;
  return (
    <Frame
      query={query}
      active="tasks"
      title={task?.title || "Task"}
      back={{ href: "/app/tasks", label: "Your tasks" }}
      action={
        task && !task.archived ? (
          <button className="ws-link" onClick={() => setEditing(true)}>
            Request an edit
          </button>
        ) : undefined
      }
    >
      {!task ? (
        <Empty title="Task not found" href="/app/tasks" action="Your tasks">
          This task is unavailable in your account.
        </Empty>
      ) : (
        <>
          <div className="ws-detail-header">
            <p>
              {task.siteName} · {task.location}
            </p>
            <p>
              <Tag tone={task.published ? "green" : "neutral"}>
                {task.status}
              </Tag>
            </p>
          </div>

          {/* Where the task stands, dominant, from the shared projection the
              account-free capture page uses too -- so a signed-in operator and
              one on a link cannot be told different things about one task. The
              `ws-next` treatment is the page's existing status-banner style. */}
          {task.readiness && (
            <div className="ws-next">
              <div>
                <p className="ws-kicker">Where this stands</p>
                <h2>{task.readiness.headline}</h2>
                {task.readiness.operatorAction && <p>{task.readiness.operatorAction}</p>}
                {task.readiness.missingViews.length > 0 && (
                  <p className="ws-muted">Still needed: {task.readiness.missingViews.join(", ")}.</p>
                )}
                <NextTaskUpdate nextUpdateIso={task.readiness.nextUpdateIso} />
              </div>
            </div>
          )}

          <Feedback error={action.error} notice={action.notice} />
          <div className="ws-tabs" role="tablist" aria-label="Task sections">
            {["overview", "results", "capture"].map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="ws-detail-grid">
              <section>
                <h2>The task</h2>
                <p className="ws-section">
                  {task.terms.successDefinition || task.title}
                </p>
                <h2 className="ws-section">Success criteria</h2>
                <Facts
                  rows={[
                    [
                      "Successful cycles",
                      task.terms.successRate === null
                        ? "To be agreed"
                        : `At least ${task.terms.successRate}%`,
                    ],
                    [
                      "Cycle time",
                      task.terms.cycleTimeSeconds === null
                        ? "To be agreed"
                        : `${task.terms.cycleTimeSeconds} seconds or less`,
                    ],
                  ]}
                />
              </section>
              <section>
                <h2>Pilot & deployment</h2>
                <Facts
                  rows={[
                    ["Pilot budget", money(task.terms.pilotBudgetUsd)],
                    [
                      "Deployment budget",
                      money(task.terms.deploymentBudgetUsd),
                    ],
                    ["Target start", dateLabel(task.terms.targetDate)],
                    [
                      "Opening visibility",
                      task.published
                        ? "Open to approved robot teams"
                        : task.visibility === "private"
                          ? "Private"
                          : "Anonymized after review",
                    ],
                  ]}
                />
                <p className="ws-note">
                  Budgets are planning figures. Pilot scope, commercial terms,
                  and any deployment are agreed separately.
                </p>
                {task.potentialMatches !== null && (
                  <p className="ws-note">
                    {task.potentialMatches} potential matches from the latest
                    compatibility review. Evaluation is still required.
                  </p>
                )}
                <p className="ws-note">
                  {task.nextStep ||
                    "Blueprint will review the task and confirm the next step."}
                </p>
              </section>
            </div>
          )}
          {tab === "results" && (
            <>
              <div className="ws-target-strip">
                <span>
                  Success{" "}
                  {task.terms.successRate === null
                    ? "to be agreed"
                    : `≥${task.terms.successRate}%`}
                </span>
                <span>
                  Cycle time{" "}
                  {task.terms.cycleTimeSeconds === null
                    ? "to be agreed"
                    : `≤${task.terms.cycleTimeSeconds} sec`}
                </span>
              </div>
              <section className="ws-section">
                <h2>Team results</h2>
                {task.results.length ? (
                  <>
                    <div className="ws-table-wrap ws-section">
                      <table className="ws-table">
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>Success</th>
                            <th>Cycle time</th>
                            <th>Outcome</th>
                            <th>
                              <span className="sr-only">Action</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {task.results.map((result) => (
                            <tr key={result.id}>
                              <td>{result.teamAlias}</td>
                              <td>
                                {result.successRate === null
                                  ? "Results pending"
                                  : `${Number(result.successRate.toFixed(1))}%`}
                              </td>
                              <td>
                                {result.cycleTimeSeconds === null
                                  ? "—"
                                  : `${Number(result.cycleTimeSeconds.toFixed(1))} sec`}
                              </td>
                              <td>
                                <Tag
                                  tone={
                                    result.selected || result.targetsMet
                                      ? "green"
                                      : "neutral"
                                  }
                                >
                                  {result.selected
                                    ? "Pilot selected"
                                    : result.targetsMet === true
                                      ? "Meets targets"
                                      : result.targetsMet === false
                                        ? "Below target"
                                        : statusLabel(result.status)}
                                </Tag>
                              </td>
                              <td>
                                {!task.archived &&
                                !task.pilot.selectedResultId &&
                                result.targetsMet === true ? (
                                  <button
                                    className="ws-link"
                                    onClick={() => {
                                      setSelection(result);
                                      setPilotAction("invite");
                                    }}
                                  >
                                    Invite to pilot →
                                  </button>
                                ) : (
                                  <button
                                    className="ws-link"
                                    onClick={() => setDetails(result)}
                                  >
                                    View details →
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="ws-note">
                      Teams are anonymized. These results come from evaluation;
                      how a robot does on site is confirmed in the pilot.
                    </p>
                  </>
                ) : (
                  <Empty title="No team results yet">
                    Evaluation requests and results will appear here once robot
                    teams submit them.
                  </Empty>
                )}
              </section>
              <details className="ws-section">
                <summary>What does success mean?</summary>
                <p>
                  {task.terms.successDefinition ||
                    "Success criteria are still being agreed."}
                </p>
              </details>
              <section className="ws-next ws-section">
                <div>
                  <h2>
                    {task.pilot.selectedResultId
                      ? statusLabel(task.pilot.state)
                      : "No pilot team selected"}
                  </h2>
                  <p className="ws-muted">
                    {task.pilot.notes ||
                      "You choose the team after reviewing the results."}
                  </p>
                  {["pilot", "pilot_complete", "deployed"].includes(
                    task.pilot.state,
                  ) && (
                    <p className="ws-note">Outcome recorded by your site.</p>
                  )}
                </div>
                {!task.archived &&
                  task.pilot.selectedResultId &&
                  task.pilot.state !== "deployed" && (
                    <button
                      className="ws-link"
                      onClick={() =>
                        setPilotAction(
                          ["selected", "invited"].includes(task.pilot.state)
                            ? "start"
                            : task.pilot.state === "pilot"
                              ? "complete"
                              : "deploy",
                        )
                      }
                    >
                      {["selected", "invited"].includes(task.pilot.state)
                        ? "Record pilot start"
                        : task.pilot.state === "pilot"
                          ? "Record pilot outcome"
                          : "Record deployment"}{" "}
                      →
                    </button>
                  )}
              </section>
              {!task.archived && (
                <button
                  className="ws-link"
                  onClick={() => setPilotAction("close")}
                >
                  Close task
                </button>
              )}
            </>
          )}
          {tab === "capture" && (
            <>
              <div className="ws-section-title">
                <h2>Capture visit</h2>
                {task.capture && <Tag>{statusLabel(task.capture.status)}</Tag>}
              </div>
              {task.capture ? (
                <>
                  <Facts
                    rows={[
                      ["When", dateLabel(task.capture.startsAt, true)],
                      ["Where", `${task.siteName} · ${task.location}`],
                      [
                        "Capturer",
                        task.capture.capturerName || "Assignment pending",
                      ],
                    ]}
                  />
                  {task.capture.changeStatus && (
                    <p className="ws-note">
                      {statusLabel(task.capture.changeStatus)}. Existing visit
                      details remain in effect until confirmed.
                    </p>
                  )}
                  {!task.archived && (
                    <div className="ws-form-actions">
                      <button
                        className="ws-link"
                        onClick={() => setCaptureAction("reschedule")}
                      >
                        Request a change
                      </button>
                      <button
                        className="ws-link"
                        onClick={() => setCaptureAction("cancel")}
                      >
                        Cancel visit
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Empty title="Plan your capture">
                  Capture coordination will confirm the date, time, and capturer
                  for this task.
                </Empty>
              )}
              {!task.capture && !task.archived && (
                <button
                  className="ws-primary"
                  onClick={() => setCaptureAction("request")}
                >
                  Request capture
                </button>
              )}
              {task.capture?.canMessage && !task.archived && (
                <form
                  method="post"
                  className="ws-section"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const message = String(
                      new FormData(form).get("message") || "",
                    );
                    void action.perform(
                      `${endpoint}/capture`,
                      { action: "message", message },
                      () => form.reset(),
                    );
                  }}
                >
                  <h2>Message your capturer</h2>
                  <div className="ws-section">
                    <Field label="Message">
                      <textarea
                        name="message"
                        required
                        maxLength={2000}
                        placeholder="Share access instructions or ask a question"
                      />
                    </Field>
                  </div>
                  <div className="ws-form-actions">
                    <button className="ws-primary" disabled={action.pending}>
                      Send message
                    </button>
                  </div>
                </form>
              )}
              <details className="ws-section">
                <summary>Prepare for your capture</summary>
                <p>
                  Have the work area, task objects, and site access ready. Share
                  entry instructions with your capturer and confirm the agreed
                  capture window.
                </p>
              </details>
              <p className="ws-note">
                Changes are confirmed by capture coordination. Already have
                capture files?{" "}
                <Link className="ws-link" href="/app/captures">
                  Upload or review a capture
                </Link>
              </p>
            </>
          )}
          {captureAction && (
            <Modal
              title={
                captureAction === "cancel"
                  ? "Request cancellation"
                  : captureAction === "reschedule"
                    ? "Request a change"
                    : "Request capture"
              }
              onClose={() => setCaptureAction(null)}
            >
              <p>
                {captureAction === "cancel"
                  ? "Your visit remains scheduled until capture coordination confirms the cancellation."
                  : "Share a preferred time and any access requirements. We will confirm the visit details."}
              </p>
              <Feedback error={action.error} />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget),
                    date = String(values.get("startsAt") || "");
                  void action.perform(
                    `${endpoint}/capture`,
                    {
                      action: captureAction,
                      message: String(values.get("message") || ""),
                      ...(date
                        ? { startsAt: new Date(date).toISOString() }
                        : {}),
                    },
                    () => setCaptureAction(null),
                  );
                }}
              >
                {captureAction !== "cancel" && (
                  <Field
                    label="Preferred date and time"
                    hint={`Shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                  >
                    <input
                      type="datetime-local"
                      name="startsAt"
                      required={captureAction === "reschedule"}
                    />
                  </Field>
                )}
                <Field label={captureAction === "cancel" ? "Reason" : "Notes"}>
                  <textarea name="message" required maxLength={2000} />
                </Field>
                <div className="ws-form-actions">
                  <button className="ws-primary" disabled={action.pending}>
                    Submit request
                  </button>
                  <button
                    type="button"
                    className="ws-link"
                    onClick={() => setCaptureAction(null)}
                  >
                    Keep current visit
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {pilotAction && (
            <Modal
              title={
                pilotAction === "invite"
                  ? `Invite ${selection?.teamAlias} to pilot`
                  : pilotAction === "close"
                    ? "Close this task"
                    : "Record pilot / deployment outcome"
              }
              onClose={() => setPilotAction(null)}
            >
              <p>
                {pilotAction === "invite"
                  ? "Blueprint will coordinate the invitation. Pilot scope, pricing, and terms must be agreed before work starts."
                  : "Record the site's decision and any notes. This doesn't change evaluation scores."}
              </p>
              <Feedback error={action.error} />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action.perform(
                    `${endpoint}/pilot`,
                    {
                      action: pilotAction,
                      resultId: selection?.id || task.pilot.selectedResultId,
                      notes: String(
                        new FormData(event.currentTarget).get("notes") || "",
                      ),
                    },
                    () => setPilotAction(null),
                  );
                }}
              >
                <Field label="Decision notes">
                  <textarea name="notes" required maxLength={2000} />
                </Field>
                <div className="ws-form-actions">
                  <button className="ws-primary" disabled={action.pending}>
                    {pilotAction === "invite"
                      ? "Confirm pilot selection"
                      : "Save decision"}
                  </button>
                  <button
                    type="button"
                    className="ws-link"
                    onClick={() => setPilotAction(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {details && (
            <Modal title={details.teamAlias} onClose={() => setDetails(null)}>
              <Score result={details} />
              <p className="ws-note">
                {details.targetsMet === null
                  ? "These results cannot be compared with every current target."
                  : details.targetsMet
                    ? "This result meets the recorded targets."
                    : "This result is below one or more targets."}
              </p>
            </Modal>
          )}
          {editing && (
            <Modal
              title="Request a task edit"
              onClose={() => setEditing(false)}
            >
              <p>
                Describe the change. Current task criteria remain in effect
                until Blueprint reviews it, so existing evaluations stay
                comparable.
              </p>
              <Feedback error={action.error} />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action.perform(
                    `${endpoint}/edit-request`,
                    {
                      message: String(
                        new FormData(event.currentTarget).get("message") || "",
                      ),
                    },
                    () => setEditing(false),
                  );
                }}
              >
                <Field label="Requested changes">
                  <textarea name="message" required maxLength={3000} />
                </Field>
                <div className="ws-form-actions">
                  <button className="ws-primary" disabled={action.pending}>
                    Request edit
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </>
      )}
    </Frame>
  );
}
