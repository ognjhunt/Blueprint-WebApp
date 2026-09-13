import { useId, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useWorkspaceAccountSetup,
  WorkspaceRequestError,
} from "@/lib/workspace";
import type { WorkspaceAccountSetup } from "@/types/workspace";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalAcceptance";

export function WorkspaceSetup({ manage = false }: { manage?: boolean }) {
  const query = useWorkspaceAccountSetup();
  if (query.isLoading)
    return (
      <p className="ws-loading" role="status">
        Loading your account…
      </p>
    );
  if (query.error)
    return (
      <div className="ws-alert" role="alert">
        <p>{query.error.message}</p>
        <button
          type="button"
          className="ws-link"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          {query.isFetching ? "Trying…" : "Try again"}
        </button>
      </div>
    );
  if (!query.data) return null;
  return (
    <SetupForm
      account={query.data}
      manage={manage}
      save={query.save}
      refresh={query.refetch}
    />
  );
}
function SetupForm({
  account,
  manage,
  save,
  refresh,
}: {
  account: WorkspaceAccountSetup;
  manage: boolean;
  save: ReturnType<typeof useWorkspaceAccountSetup>["save"];
  refresh: ReturnType<typeof useWorkspaceAccountSetup>["refetch"];
}) {
  const id = useId(),
    pending = useRef(false);
  const [name, setName] = useState(account.profile.name),
    [organization, setOrganization] = useState(account.profile.organization);
  const [workspaceType, setWorkspaceType] = useState(
    account.workspaceType || "",
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="ws-account-setup">
      {manage && (
        <Link className="ws-back" href="/settings">
          ← Account settings
        </Link>
      )}
      <header className="ws-heading">
        <div>
          <p>Your account</p>
          <h1>{manage ? "Workspace setup" : "Set up your workspace"}</h1>
        </div>
      </header>
      <p className="ws-muted">
        Choose how you’ll use Blueprint, then add your site or robot details.
      </p>
      <form
        method="post"
        className="ws-form ws-section"
        aria-label="Workspace setup"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await save({ name, organization, workspaceType, acceptedTerms });
            // Reload authenticated profile and query caches from the saved record.
            // Never infer a role locally or mutate operations/capture privileges.
            window.location.assign(
              manage
                ? "/settings"
                : workspaceType === "site_operator"
                  ? "/app/tasks/new"
                  : "/settings?tab=robots",
            );
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not save your workspace. Please try again.",
            );
            if (
              failure instanceof WorkspaceRequestError &&
              failure.code === "workspace_terms_required"
            )
              void refresh();
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        {error && (
          <div className="ws-alert" role="alert">
            {error}
          </div>
        )}
        <div className="ws-fields">
          <div className="ws-field">
            <label htmlFor={`${id}-name`}>Your name</label>
            <input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              maxLength={160}
              disabled={busy}
            />
          </div>
          <div className="ws-field">
            <label htmlFor={`${id}-organization`}>Organization</label>
            <input
              id={`${id}-organization`}
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              autoComplete="organization"
              required
              maxLength={160}
              disabled={busy}
            />
          </div>
          <div className="ws-field wide">
            <label htmlFor={`${id}-email`}>Email</label>
            <input
              id={`${id}-email`}
              value={account.profile.email}
              type="email"
              readOnly
              aria-describedby={`${id}-email-note`}
            />
            <small id={`${id}-email-note`}>Your sign-in email</small>
          </div>
          <div className="ws-field wide">
            <label htmlFor={`${id}-type`}>Workspace type</label>
            <select
              id={`${id}-type`}
              value={workspaceType}
              required
              disabled={busy}
              onChange={(event) => setWorkspaceType(event.target.value)}
              aria-describedby={`${id}-type-note`}
            >
              <option value="" disabled>
                Choose a workspace
              </option>
              <option value="site_operator">
                Site — I have work to automate
              </option>
              <option value="robot_team">
                Robot team — I want to test my robots
              </option>
            </select>
            <small id={`${id}-type-note`}>
              {workspaceType === "site_operator"
                ? "Set up site tasks, captures, and pilot decisions."
                : workspaceType === "robot_team"
                  ? "Set up embodiments, policies, checkpoints, containers, or endpoints."
                  : "You can change this in Settings. Saved records are kept."}
            </small>
          </div>
        </div>
        {account.termsRequired && (
          <label className="ws-check">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              disabled={busy}
            />
            <span>
              I agree to Blueprint’s <Link href={TERMS_URL}>Terms</Link> and{" "}
              <Link href={PRIVACY_URL}>Privacy Policy</Link>.
            </span>
          </label>
        )}
        <div className="ws-form-actions">
          <button
            type="submit"
            className="ws-primary"
            disabled={busy || !workspaceType}
          >
            {busy
              ? "Opening workspace…"
              : manage
                ? "Save workspace"
                : workspaceType === "site_operator"
                  ? "Continue to site setup →"
                  : workspaceType === "robot_team"
                    ? "Continue to robot setup →"
                    : "Save and continue →"}
          </button>
          {manage && (
            <Link href="/settings" className="ws-link">
              Cancel
            </Link>
          )}
        </div>
      </form>
      {(account.access.operations || account.access.capture) && (
        <div className="ws-setup-existing">
          <p className="ws-note">Your existing account access is kept.</p>
          {account.access.operations && (
            <Link className="ws-link" href="/admin/leads">
              Open operations →
            </Link>
          )}
          {account.access.capture && (
            <Link className="ws-link" href="/capture-app/account">
              Open capture account →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
