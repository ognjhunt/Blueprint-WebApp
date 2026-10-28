import { SiteAdvisoryReport } from "@/components/site/SiteAdvisoryReport";
import { TaskOutcomeNotice } from "@/components/site/TaskOutcomeNotice";
import { PilotBookingDetails } from "@/components/site/PilotBookingDetails";
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
import { deploymentPathOptions, optionLabel, pilotConsiderationOptions, siteVisitOptions } from "@/data/sitePilotIntent";
import { waitingTimeline } from "@/data/betaTimelines";
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
    [editing, setEditing] = useState(false),
    [linkState, setLinkState] = useState<"idle" | "working">("idle"),
    [linkError, setLinkError] = useState(""),
    [previewState, setPreviewState] = useState<"idle" | "working">("idle"),
    [previewError, setPreviewError] = useState("");
  const endpoint = `/tasks/${encodeURIComponent(taskId || "")}`;
  // A short-lived ticket per click; the download itself re-checks consent.
  async function downloadPreview(captureId: string) {
    if (previewState === "working") return;
    setPreviewState("working");
    setPreviewError("");
    try {
      const { download_url: url } = await query.request<{ download_url: string }>(
        `${endpoint}/atlas-preview/download-ticket`, "POST", { captureId }, { timeoutMs: 15000 });
      if (typeof url !== "string" || !url.startsWith("/api/website-atlas-preview-downloads/"))
        throw new Error("The download link was missing. Please try again.");
      window.location.assign(url);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "The 3D preview could not be downloaded. Please try again.");
    } finally {
      setPreviewState("idle");
    }
  }
  // The task page is where the brief is reviewed or edited, footage is added
  // and the scene is opened. The emailed link expires; the account mints a
  // fresh one on demand.
  async function openTaskPage() {
    if (linkState === "working") return;
    setLinkState("working");
    setLinkError("");
    try {
      const { url } = await query.request<{ url: string }>(`${endpoint}/task-link`, "POST", {}, { timeoutMs: 15000 });
      if (typeof url !== "string" || !url.trim()) throw new Error("The task page link was missing. Please try again.");
      window.location.assign(url);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : "The task page could not be opened. Please try again.");
    } finally {
      setLinkState("idle");
    }
  }
  return (
    <Frame
      query={query}
      active="tasks"
      title={task?.title || "Job"}
      contentClassName="ws-task-detail"
      back={{ href: "/app/tasks", label: "Your jobs" }}
      action={
        task && !task.archived ? (
          <button className="ws-link" onClick={() => setEditing(true)}>
            Request an edit
          </button>
        ) : undefined
      }
    >
      {!task ? (
        <Empty title="Task not found" href="/app/tasks" action="Your jobs">
          This job is unavailable in your account.
        </Empty>
      ) : (
        <>
          <div className="ws-detail-header">
            <p>
              {[...new Set([task.siteName?.trim(), task.location?.trim()].filter(Boolean))].join(" · ")}
            </p>
            <p>
              <Tag tone={task.published ? "green" : "neutral"}>
                {task.status}
              </Tag>
            </p>
          </div>

          <section className="ws-task-status" aria-label="Job progress">
            {task.readiness && (
              <div className="ws-task-progress">
                <h2>Progress</h2>
                {/* Preserve the shared, source-bound status projection. */}
                <p>{task.readiness.headline}</p>
                <TaskOutcomeNotice showTitle={false} outcome={query.error ? null : task.readiness.outcome} />
                {task.readiness.operatorAction && <p>{task.readiness.operatorAction}</p>}
                {task.readiness.missingViews.length > 0 && task.readiness.decision !== "add_views" && (
                  <p>Still needed: {task.readiness.missingViews.join(", ")}.</p>
                )}
                {waitingTimeline(task.readiness.decision) && <p>{waitingTimeline(task.readiness.decision)}</p>}
                <p className="ws-note">Check this page for updates.</p>
              </div>
            )}
            {!task.archived && (
              <div className="ws-task-action" aria-label="Your job page">
                <button
                  className="ws-primary"
                  type="button"
                  onClick={() => void openTaskPage()}
                  disabled={linkState === "working"}
                >
                  {linkState === "working" ? "Opening…" : "Open your job page"}
                </button>
                <p className="ws-note">
                  Review the brief, update planning details{task.sceneReady ? ", open your scene," : ""} and follow the next action.
                </p>
                {linkError && <p role="alert">{linkError}</p>}
              </div>
            )}
          </section>

          <SiteAdvisoryReport compact advisory={query.error ? null : task.siteAdvisory} />

          {task.atlasPreview && !task.recordingPermissionWithdrawn && (
            <section className="ws-section" aria-label={task.atlasPreview.label}>
              <h2>{task.atlasPreview.label}</h2>
              <p>{task.atlasPreview.statusText}</p>
              {task.atlasPreview.downloadAvailable && (
                <button
                  className="ws-link"
                  type="button"
                  onClick={() => void downloadPreview(task.atlasPreview!.captureId)}
                  disabled={previewState === "working"}
                >
                  {previewState === "working" ? "Preparing download…" : "Download 3D preview"}
                </button>
              )}
              <p className="ws-note">
                For viewing only. It is generated from your recording, is not to scale, and is not a measurement of
                your site.
              </p>
              {previewError && <p role="alert">{previewError}</p>}
            </section>
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
                <h2>The job</h2>
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
                        ? "Open to approved partners"
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
                <Facts rows={[
                  ["Physical pilot interest", optionLabel(pilotConsiderationOptions, task.pilotIntent?.pilotConsideration)],
                  ["After a successful pilot", optionLabel(deploymentPathOptions, task.pilotIntent?.deploymentPath)],
                ]} />
                <p className="ws-note">
                  {task.nextStep ||
                    "Blueprint will review the job and confirm the next step."}
                </p>
              </section>
              <section aria-label="Partner job library">
                <h2>Partner job library</h2>
                {task.archived ? (
                  <p className="ws-muted">Closed. The job is off the library and no new runs can start.</p>
                ) : !task.listing?.approved ? (
                  <p className="ws-muted">
                    Not listed. Manage sharing on your job page to review and publish a card, or keep it hidden.
                  </p>
                ) : task.listing.live ? (
                  <>
                    <p>Listed. Partners approved for the beta can see the anonymized card authorized for this job and ask to have their systems evaluated on it. Your job page lets you review, edit or hide the card.</p>
                    <div className="ws-form-actions">
                      <button
                        className="ws-link"
                        type="button"
                        disabled={action.pending}
                        onClick={() => void action.perform(`${endpoint}/listing`, { paused: true })}
                      >
                        Hide from partners
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Hidden. Partners cannot see the card or request new evaluations.</p>
                    <button
                      className="ws-link"
                      type="button"
                      disabled={action.pending}
                      onClick={() => void action.perform(`${endpoint}/listing`, { paused: false })}
                    >
                      Show to partners again
                    </button>
                  </>
                )}
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
                {task.results.length ? (
                  <>
                    <h2>Evaluation results</h2>
                    <div className="ws-table-wrap ws-section">
                      <table className="ws-table">
                        <thead>
                          <tr>
                            <th>Submitted by</th>
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
                                <button
                                  className="ws-link"
                                  onClick={() => setDetails(result)}
                                >
                                  View details →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="ws-note">
                      Submitters are anonymized. These results come from evaluation in simulation;
                      how a robot does on site is confirmed in the pilot.
                    </p>
                  </>
                ) : (
                  <Empty title="No evaluation results yet">
                    Results will appear here when Blueprint's simulation of your job reports them. The next action is on your job page.
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
              <section className="ws-task-pilot ws-section">
                <div>
                  <h2>
                    {["pilot", "pilot_complete", "deployed"].includes(task.pilot.state)
                      ? statusLabel(task.pilot.state)
                      : task.pilotBooking
                        ? "Delivery partner selected"
                        : task.pilot.selectedResultId
                          ? statusLabel(task.pilot.state)
                          : "Pilot"}
                  </h2>
                  {task.pilotBooking ? (
                    <PilotBookingDetails booking={task.pilotBooking} other="delivery partner" />
                  ) : (
                    <p className="ws-muted">
                      {task.pilot.notes || (task.pilotRecommended
                        ? "Review the proposed approach, cost, support and evidence on your job page. If you go ahead, you agree pilot terms directly with the deployment company."
                        : "No pilot is planned yet. When the simulation shows what works, Blueprint works alongside a deployment company on your site. Your job page shows the next step.")}
                    </p>
                  )}
                  {task.pilot.siteVisitAnswer && (
                    <p className="ws-note">Partner site access: {optionLabel(siteVisitOptions, task.pilot.siteVisitAnswer)}. A visit still needs separate approval and agreed terms.</p>
                  )}
                  {["pilot", "pilot_complete", "deployed"].includes(
                    task.pilot.state,
                  ) && (
                    <p className="ws-note">Outcome recorded by your site.</p>
                  )}
                </div>
                {/* Only a pilot Blueprint recommended can be booked (audit N14). */}
                {!task.archived && task.pilotRecommended && !task.pilot.selectedResultId && !task.pilotBooking && (
                  <button
                    className="ws-link"
                    type="button"
                    onClick={() => void openTaskPage()}
                    disabled={linkState === "working"}
                  >
                    Review the proposal on your job page →
                  </button>
                )}
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
          {tab === "capture" && task.captureMode === "self_capture" && (
            <section className="ws-section" aria-label="Your recording">
              <h2>Your recording</h2>
              <p>
                You film this job yourself on your phone. Your job page shows what has been
                received, what is still needed, and lets you add more footage.
              </p>
              {task.readiness?.missingViews?.length ? (
                <p className="ws-muted">Still needed: {task.readiness.missingViews.join(", ")}.</p>
              ) : null}
              {!task.archived && !task.recordingPermissionWithdrawn && (
                <button className="ws-primary" type="button" onClick={() => void openTaskPage()} disabled={linkState === "working"}>
                  {linkState === "working" ? "Opening…" : "Add or review footage"}
                </button>
              )}
              {task.recordingPermissionWithdrawn ? <p role="status">
                Recording permission withdrawn. Blueprint stops further processing and use of this recording: new uploads
                are refused, the job is paused, queued evaluations were asked to cancel and approved partners can no longer see the job.
                Withdrawal is not deletion: a copy of the recording and any results already produced are retained, and handled
                as our <a className="ws-link" href="/privacy">Privacy Policy</a> describes.
              </p> : <details className="mt-4">
                <summary>Withdraw recording permission</summary>
                <p>
                  This stops Blueprint's further processing and use of this recording: new uploads are refused, the job is
                  paused, queued evaluations are asked to cancel and approved partners can no longer see the job. Withdrawal is not
                  deletion: a copy of the recording and any results already produced are retained, and handled as
                  our <a className="ws-link" href="/privacy">Privacy Policy</a> describes.
                </p>
                <button type="button" className="ws-link" disabled={action.pending}
                  onClick={() => void action.perform(`${endpoint}/recording-consent/withdraw`, {})}>Withdraw permission</button>
              </details>}
            </section>
          )}
          {tab === "capture" && task.captureMode !== "self_capture" && (
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
                  for this job.
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
                    ? "Close this job"
                    : "Record pilot / deployment outcome"
              }
              onClose={() => setPilotAction(null)}
            >
              <p>
                {pilotAction === "invite"
                  ? "Blueprint passes on your invitation to this partner. You and the partner agree pilot scope, dates and terms directly before work starts."
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
                      ...(pilotAction === "invite" ? {
                        siteVisitAnswer: String(new FormData(event.currentTarget).get("siteVisitAnswer") || ""),
                      } : {}),
                    },
                    () => setPilotAction(null),
                  );
                }}
              >
                {pilotAction === "invite" && (
                  <Field label="Could this partner bring people and equipment on site for a scoped visit or pilot?">
                    <select name="siteVisitAnswer" aria-label="Partner on-site access" required defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {siteVisitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <p className="ws-note">This records your current answer. It does not grant site access or start physical work.</p>
                  </Field>
                )}
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
              title="Request a job edit"
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
