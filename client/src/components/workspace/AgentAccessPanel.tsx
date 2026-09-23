import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { workspaceRequest } from "@/lib/workspace";
import type { AgentAccessRun, AgentAccessTeam } from "@/lib/robotTeamAccount";

function formatUsd(value: number) {
  return `$${(Math.round(value * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function taskFamilyLabel(value: string) {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function runResultLabel(run: AgentAccessRun) {
  if (run.resultStatus === "reported" && run.episodesRun) {
    return `${run.episodesSucceeded ?? 0} of ${run.episodesRun} simulated episodes succeeded`;
  }
  if (run.resultStatus === "no_result") return "Ended without a result (not charged for unrun episodes)";
  return run.state === "requested" ? "Queued or running" : "Waiting for the result";
}

/**
 * Where a robot team's agent keys, balance and runs live.
 *
 * A person with a verified email owns the team and its keys; the agent then
 * plans, pays and runs on its own inside the team's policy. A key is shown
 * once, when it is issued, because we keep only its hash.
 */
export function AgentAccessPanel({ user }: { user: User | null }) {
  const [teams, setTeams] = useState<AgentAccessTeam[] | null>(null);
  const [verified, setVerified] = useState(true);
  const [label, setLabel] = useState("");
  const [connectKey, setConnectKey] = useState("");
  const [issued, setIssued] = useState<{ agentKey: string; teamId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const body = await workspaceRequest<{ verified: boolean; teams: AgentAccessTeam[] }>(
        user,
        "/robot-team/agent-access",
      );
      setTeams(body.teams);
      setVerified(body.verified);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Agent access could not be loaded.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(run: () => Promise<void>) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const issue = () =>
    act(async () => {
      const body = await workspaceRequest<{ agentKey: string; teamId: string }>(user, "/robot-team/agent-keys", "POST", {
        ...(teams?.[0] ? { teamId: teams[0].teamId } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      setIssued(body);
      setLabel("");
    });

  const revoke = (keyId: string) =>
    act(async () => {
      await workspaceRequest(user, `/robot-team/agent-keys/${encodeURIComponent(keyId)}/revoke`, "POST", {});
    });

  const connect = () =>
    act(async () => {
      await workspaceRequest(user, "/robot-team/connect", "POST", { agentKey: connectKey.trim() });
      setConnectKey("");
    });

  return (
    <section className="ws-section" aria-label="Agent access">
      <h2>Agent access</h2>
      <p className="ws-muted">
        Your agent uses a key to plan, pay for and run evaluations inside the limits you set. Keys
        belong to this account: issue one here, and revoke it here if it leaks.
      </p>
      {!verified && <p role="alert">Verify your email before issuing a key or connecting a team.</p>}
      {error && <p role="alert">{error}</p>}

      {issued && (
        <div className="ws-section" aria-live="polite">
          <p>
            <strong>Your new key.</strong> Store it now: we keep only a hash and cannot show it again.
          </p>
          <code style={{ display: "block", wordBreak: "break-all" }}>{issued.agentKey}</code>
          <button className="ws-link" type="button" onClick={() => setIssued(null)}>
            I have stored it
          </button>
        </div>
      )}

      {teams === null ? (
        <p className="ws-muted">Loading…</p>
      ) : (
        <>
          {teams.map((team) => (
            <div key={team.teamId} className="ws-table-wrap">
              <p>
                <strong>{team.name}</strong> <span className="ws-muted">{team.teamId}</span>
              </p>
              <p aria-label={`${team.name} balance`}>
                {team.balance
                  ? <>
                      <strong>{formatUsd(team.balance.availableUsd)}</strong> available
                      {team.balance.reservedUsd > 0 ? <span className="ws-muted"> · {formatUsd(team.balance.reservedUsd)} held for runs in progress</span> : null}
                      <span className="ws-muted"> · {formatUsd(team.balance.creditedUsd)} added, {formatUsd(team.balance.spentUsd)} spent</span>
                    </>
                  : <span className="ws-muted">The balance could not be loaded. Try again shortly.</span>}
              </p>
              <h3 className="ws-kicker">Runs</h3>
              {team.runs?.length ? (
                <table className="ws-table" aria-label={`${team.name} runs`}>
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th>Task</th>
                      <th>Result</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.runs.map((run) => (
                      <tr key={run.runId}>
                        <td>{new Date(run.requestedAtIso).toLocaleDateString()}</td>
                        <td>{run.taskFamily ? taskFamilyLabel(run.taskFamily) : "Site task"}</td>
                        <td>{runResultLabel(run)}</td>
                        <td>{formatUsd(run.quotedUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="ws-muted">
                  No runs yet. Choose a task in the <a href="/contact/robot-team">task library</a> to see a plan.
                </p>
              )}
              <h3 className="ws-kicker">Keys</h3>
              {team.keys.length ? (
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Created</th>
                      <th>Last used</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.keys.map((key) => (
                      <tr key={key.keyId}>
                        <td>{key.label}</td>
                        <td>{new Date(key.createdAtIso).toLocaleDateString()}</td>
                        <td>{key.lastUsedAtIso ? new Date(key.lastUsedAtIso).toLocaleDateString() : "Never"}</td>
                        <td>
                          <button className="ws-link" type="button" disabled={busy} onClick={() => void revoke(key.keyId)}>
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="ws-muted">No active keys.</p>
              )}
            </div>
          ))}
          <form
            className="ws-form"
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <label>
              Key label (optional)
              <input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} placeholder="ci agent" />
            </label>
            <button className="ws-primary" type="submit" disabled={busy || !verified}>
              {teams.length ? "Issue a new key" : "Create your team and issue a key"}
            </button>
          </form>
          <form
            className="ws-form"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label>
              Connect a team you registered on the plan page
              <input
                value={connectKey}
                onChange={(event) => setConnectKey(event.target.value)}
                placeholder="bpk_…"
                autoComplete="off"
              />
            </label>
            <button className="ws-link" type="submit" disabled={busy || !verified || connectKey.trim().length < 8}>
              Connect team
            </button>
          </form>
        </>
      )}
    </section>
  );
}
