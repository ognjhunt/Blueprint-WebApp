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
  if (workspaceType === "site_operator" && !account.access.operations
    && (account.siteIntakeRequired === true || !account.workspaceType)) return (
    <section className="ws-account-setup">
      <h1>Start with your site and job</h1>
      <p className="ws-muted">Start a job first. We set up your account from it.</p>
      <Link className="ws-primary" href="/contact/site-operator">Start a job →</Link>
      <button className="ws-link" type="button" onClick={() => setWorkspaceType("")}>Back</button>
    </section>
  );
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
          <h1>{manage ? "Account type" : "Set up your account"}</h1>
        </div>
      </header>
      <p className="ws-muted">
        Are you a site or a deployment company?
      </p>
      <form
        method="post"
        className="ws-form ws-section"
        aria-label="Account setup"
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
                  ? "/contact/site-operator"
                  : "/contact/robot-team",
            );
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not save your account. Please try again.",
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
            <label htmlFor={`${id}-organization`}>
              {workspaceType === "robot_team" ? "Company" : "Business name"}
            </label>
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
            <label htmlFor={`${id}-type`}>Account type</label>
            <select
              id={`${id}-type`}
              value={workspaceType}
              required
              disabled={busy}
              onChange={(event) => setWorkspaceType(event.target.value)}
              aria-describedby={workspaceType ? `${id}-type-note` : undefined}
            >
              <option value="" disabled>
                Choose one
              </option>
              <option value="site_operator">
                Site — I have work to automate
              </option>
              <option value="robot_team">
                Deployment company — I deploy robots
              </option>
            </select>
            {workspaceType && (
              <small id={`${id}-type-note`}>
                {workspaceType === "site_operator"
                  ? "Start a job and follow it here."
                  : "For deployment companies we have approved."}
              </small>
            )}
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
            {busy ? "Saving…" : manage ? "Save" : "Continue →"}
          </button>
          {manage && (
            <Link href="/settings" className="ws-link">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
