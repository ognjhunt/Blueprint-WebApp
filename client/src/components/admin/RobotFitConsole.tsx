/**
 * Robot fit for staff, in the job console and beside a pilot proposal.
 *
 * Three parts. What the job needs and how every form of robot rates against
 * it (one arm, two arms, an arm on a wheeled base, wheeled and walking
 * humanoids, legged robots) are rules over the site's own data, computed on
 * every read. The site preview is exactly what the owner's job page shows once
 * shared, and it never names a team. The researched-team ranking is a model's
 * reading of Blueprint's research notes, every reason quoting the research: it
 * decides whom to ask to evaluate the job, and it is reference beside the
 * evaluation when a recommendation is written, never its basis. Prospects have
 * agreed to nothing. Loaded only when opened.
 */
import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, StatusChip } from "@/components/blueprint";
import {
  FIT_VERDICT_LABELS,
  REQUIREMENT_SOURCE_LABELS,
  ROBOT_FORM_COPY,
  robotFormLabel,
  type AdminRobotFitResponse,
  type FitVerdict,
  type RobotFitAttempt,
  type RobotFitRanking,
  type RobotFitSharing,
  type TeamFit,
} from "@/data/robotFit";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

const VERDICT_TONE: Record<FitVerdict, "proof" | "warn" | "block"> = { fits: "proof", possible: "warn", not_a_fit: "block" };
const TEAM_FIT_TONE: Record<TeamFit, "proof" | "warn" | "neutral"> = { strong: "proof", possible: "warn", weak: "neutral" };
const TEAM_FIT_LABELS: Record<TeamFit, string> = { strong: "Strong fit", possible: "Possible fit", weak: "Weak fit" };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

type Loaded = { status: "idle" | "loading" } | { status: "failed"; message: string }
  | { status: "ready"; fit: AdminRobotFitResponse };

export function RobotFitConsole({ requestId, currentUser }: {
  requestId: string;
  currentUser: FirebaseUser | null;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "idle" });
  const [busy, setBusy] = useState<"ranking" | "sharing" | null>(null);
  const [actionError, setActionError] = useState("");
  const base = `/api/admin/jobs/${encodeURIComponent(requestId)}/robot-fit`;

  async function authorized(init: RequestInit = {}, json = false) {
    return {
      ...init,
      credentials: "include" as const,
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader(json ? { "Content-Type": "application/json" } : {})),
    };
  }

  /** Quiet unless first: a refresh after an action keeps what the action returned on screen. */
  async function load(quiet = false) {
    if (!quiet) setLoaded({ status: "loading" });
    try {
      const response = await fetch(base, await authorized());
      const value = (await response.json().catch(() => ({}))) as Partial<AdminRobotFitResponse> & { error?: string };
      if (!response.ok || !value.job) {
        if (!quiet) setLoaded({ status: "failed", message: String(value.error || `Request failed (${response.status})`) });
        return;
      }
      setLoaded({ status: "ready", fit: value as AdminRobotFitResponse });
    } catch {
      if (!quiet) setLoaded({ status: "failed", message: "Robot fit could not be loaded." });
    }
  }

  /** Apply what an action returned at once, so a failed refresh never hides a run that already happened. */
  function apply(patch: Partial<Pick<AdminRobotFitResponse, "ranking" | "lastAttempt" | "sharing">>) {
    setLoaded((current) => (current.status === "ready" ? { status: "ready", fit: { ...current.fit, ...patch } } : current));
  }

  async function act(kind: "ranking" | "sharing", body: unknown, failure: string) {
    if (busy) return;
    setBusy(kind);
    setActionError("");
    try {
      const response = await fetch(`${base}/${kind}`, await authorized({ method: "POST", body: JSON.stringify(body) }, true));
      const value = await response.json().catch(() => ({})) as { error?: string; ranking?: RobotFitRanking | null;
        attempt?: RobotFitAttempt; sharing?: RobotFitSharing };
      if (!response.ok) {
        setActionError(String(value.error || `${failure} (${response.status}).`));
        return;
      }
      if (kind === "ranking" && value.attempt) {
        apply({ lastAttempt: value.attempt, ...(value.ranking ? { ranking: { ...value.ranking, stale: false } } : {}) });
      }
      if (kind === "sharing" && value.sharing) apply({ sharing: value.sharing });
      await load(true);
    } catch {
      setActionError(`${failure}. Check your connection and try again.`);
    } finally {
      setBusy(null);
    }
  }

  const fit = loaded.status === "ready" ? loaded.fit : null;
  const ranking = fit?.ranking ?? null;
  const attempt = fit?.lastAttempt ?? null;
  const shared = fit?.sharing?.shared === true;

  return (
    <details onToggle={(event) => {
      if (event.currentTarget.open && (loaded.status === "idle" || loaded.status === "failed")) void load();
    }}>
      <summary className="runway-rule-head runway-meta cursor-pointer">Robot fit</summary>
      <div className="mt-4 grid gap-5">
        {loaded.status === "loading" ? <p className="text-sm text-runway-mute">Reading the job's needs…</p> : null}
        {loaded.status === "failed" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-runway-red">{loaded.message}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>
          </div>
        ) : null}
        {fit ? (
          <>
            {fit.consentRevoked ? (
              <p className="text-sm text-runway-red">
                Recording consent was withdrawn for this job. Teams are not ranked for it and nothing new is shared with the site.
              </p>
            ) : null}
            {fit.job.summary || fit.job.instruction ? (
              <div className="grid gap-1 text-sm text-runway-body">
                {fit.job.summary ? <p>{fit.job.summary}</p> : null}
                {fit.job.instruction ? <p className="text-xs text-runway-mute">From the video: {fit.job.instruction}</p> : null}
              </div>
            ) : null}

            {!fit.job.rated ? (
              <p className="text-sm text-runway-mute">Robot forms are not rated for this job. {fit.job.notRatedReason}</p>
            ) : (
              <>
                <section aria-label="What the job needs" className="grid gap-2">
                  <h4 className="runway-label">What the job needs</h4>
                  <ul className="grid gap-1 text-sm text-runway-body">
                    {fit.job.needs.map((line, index) => <li key={`need-${index}`}>{line}</li>)}
                  </ul>
                  {fit.job.requirements.length ? (
                    <p className="text-xs text-runway-mute">
                      From: {fit.job.requirements.map((entry) => `${entry.label.toLowerCase()} ${entry.display} (${REQUIREMENT_SOURCE_LABELS[entry.source]})`).join("; ")}.
                    </p>
                  ) : null}
                  {fit.job.unknowns.length ? (
                    <p className="text-xs text-runway-mute">
                      Unknown: {fit.job.unknowns.map((entry) => `${entry.label.toLowerCase()} (${entry.resolve === "measurements" ? "site measurements" : "ask the site"})`).join("; ")}.
                    </p>
                  ) : null}
                </section>

                <section aria-label="Robot forms" className="grid gap-3">
                  <h4 className="runway-label">Robot forms</h4>
                  {fit.job.forms.map((rating) => (
                    <div key={rating.id} className="grid gap-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-runway-text">
                        {ROBOT_FORM_COPY[rating.id].label}
                        <StatusChip tone={VERDICT_TONE[rating.verdict]} square>{FIT_VERDICT_LABELS[rating.verdict]}</StatusChip>
                      </p>
                      {rating.checks.length ? (
                        <ul className="grid gap-1 text-xs text-runway-body">
                          {rating.checks.map((entry, index) => <li key={`${rating.id}-${index}`}>{entry.text}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                  <p className="text-xs text-runway-mute">
                    Rules over the site's own data, using Blueprint's conservative screening bands. They describe the job, not any robot's specification.
                  </p>
                </section>
              </>
            )}

            <section aria-label="What the site sees" className="grid gap-2">
              <h4 className="runway-label">What the site sees</h4>
              <p className="text-sm text-runway-body">
                {shared
                  ? `Shared on the owner's job page since ${dateLabel(fit.sharing!.changedAtIso)}.`
                  : "Not shared. The owner's job page shows nothing about robot fit."}
              </p>
              {fit.site ? (
                <div className="grid gap-1 border border-runway-line p-3 text-xs text-runway-body">
                  {fit.site.needs.map((line, index) => <p key={`site-need-${index}`}>{line}</p>)}
                  {fit.site.forms.map((form) => (
                    <p key={form.id}>{form.label}: {FIT_VERDICT_LABELS[form.verdict]}.{form.reasons.length ? ` ${form.reasons.join(" ")}` : ""}</p>
                  ))}
                  {fit.site.unknowns.map((line, index) => <p key={`site-unknown-${index}`}>Not known yet: {line}</p>)}
                  <p className="text-runway-mute">{fit.site.note}</p>
                </div>
              ) : <p className="text-xs text-runway-mute">Nothing to show the site for this job.</p>}
              <div>
                {shared ? (
                  <Button type="button" size="sm" variant="secondary" disabled={busy !== null}
                    onClick={() => void act("sharing", { shared: false }, "Sharing could not be changed")}>Stop sharing</Button>
                ) : (
                  <Button type="button" size="sm" disabled={busy !== null || !fit.site || fit.consentRevoked}
                    onClick={() => void act("sharing", { shared: true }, "Sharing could not be changed")}>Share with the site</Button>
                )}
              </div>
            </section>

            <section aria-label="Researched teams" className="grid gap-3">
              <h4 className="runway-label">Researched teams (internal)</h4>
              <p className="text-xs text-runway-mute">
                A model reads every research note in the registry. Each reason is the model's reading of a quote that the
                server found word for word in that team's research; judge the claim against the quote. Use it to decide
                whom to ask. A recommendation stands on a passing evaluation, and a prospect has agreed to nothing.
              </p>
              {attempt?.state === "failed" ? (
                <p className="text-sm text-runway-red">
                  The last ranking run, {dateLabel(attempt.atIso)}, failed: {attempt.error ?? "no reason given"}.
                  {ranking ? " The ranking below is the last one that completed." : ""}
                </p>
              ) : null}
              {!ranking && attempt?.state !== "failed" ? <p className="text-sm text-runway-mute">Not ranked yet.</p> : null}
              {ranking?.stale ? (
                <p className="text-sm text-runway-red">The job or the research notes changed since this ranking. Rank again before relying on it.</p>
              ) : null}
              {ranking && !ranking.teams.length ? (
                <p className="text-sm text-runway-body">No research note supported any team for this job.</p>
              ) : null}
              {ranking?.teams.length ? (
                <ol className="grid gap-4">
                  {ranking.teams.map((team) => (
                    <li key={team.teamId} className="grid gap-1 border-t border-runway-line pt-3">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-runway-text">
                        {team.name}
                        <StatusChip tone={TEAM_FIT_TONE[team.fit]} square>{TEAM_FIT_LABELS[team.fit]}</StatusChip>
                        <StatusChip tone={team.agreed ? "proof" : "neutral"} square>
                          {team.agreed ? "Supply terms agreed" : team.status === "prospect" ? "Prospect, nothing agreed" : `${team.status}, terms not agreed`}
                        </StatusChip>
                        <span className="text-xs text-runway-mute">{robotFormLabel(team.form)}</span>
                      </p>
                      <ul className="grid gap-2 text-sm text-runway-body">
                        {team.reasons.map((reason, index) => (
                          <li key={`${team.teamId}-${index}`}>
                            <span className="text-xs text-runway-mute">Model's reading: </span>{reason.claim}
                            <blockquote className="mt-1 border-l-2 border-runway-line pl-3 text-xs text-runway-mute">“{reason.quote}”</blockquote>
                          </li>
                        ))}
                      </ul>
                      {team.concerns.length ? (
                        <p className="text-xs text-runway-body">Unknown or doubtful: {team.concerns.join(" ")}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              {ranking ? (
                <p className="text-xs text-runway-mute">
                  {ranking.candidateCount} research notes read · ranked {dateLabel(ranking.rankedAtIso)}
                  {ranking.model ? ` · ${ranking.model}` : ""}
                  {ranking.droppedReasons || ranking.droppedTeams
                    ? ` · dropped ${ranking.droppedReasons} unquoted reasons and ${ranking.droppedTeams} entries` : ""}
                </p>
              ) : null}
              <div>
                <Button type="button" size="sm" variant={ranking ? "secondary" : "action"}
                  disabled={busy !== null || fit.consentRevoked}
                  onClick={() => void act("ranking", {}, "The ranking could not be run")}>
                  {busy === "ranking" ? "Ranking…" : ranking ? "Rank again" : "Rank researched teams"}
                </Button>
              </div>
            </section>
            {actionError ? <p role="alert" className="text-sm text-runway-red">{actionError}</p> : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
