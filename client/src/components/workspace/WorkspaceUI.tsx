import { useRef, useState, useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Helmet } from "@/lib/helmet";
import { AppShell, type AppView } from "@/components/blueprint/app/AppShell";
import { WorkspaceSetup } from "./WorkspaceSetup";
import {
  useWorkspace,
  WorkspaceRequestError,
} from "@/lib/workspace";
export type WorkspaceQuery = ReturnType<typeof useWorkspace>;
export function Frame({
  query,
  active,
  title,
  children,
  action,
  back,
  contentClassName,
}: {
  query: WorkspaceQuery;
  active: AppView;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
  contentClassName?: string;
}) {
  return (
    <AppShell
      active={active}
      breadcrumb={title}
      role={query.data?.role}
      organization={query.data?.profile.organization}
      contentClassName={contentClassName}
    >
      <Helmet>
        <title>{title} · Blueprint</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {query.needsSetup ? (
        <WorkspaceSetup />
      ) : (
        <>
          {back && (
            <Link className="ws-back" href={back.href}>
              ← {back.label}
            </Link>
          )}
          <header className="ws-heading">
            <div>
              {!back && (
                <p>{query.data?.profile.organization || "Your workspace"}</p>
              )}
              <h1>{title}</h1>
            </div>
            {!query.isLoading && !query.error && action}
          </header>
          {query.isLoading ? (
            <p className="ws-loading" role="status">
              Loading your workspace…
            </p>
          ) : query.error ? (
            <div className="ws-alert" role="alert">
              <p>{query.error.message}</p>
              {query.error instanceof WorkspaceRequestError &&
              query.error.status === 401 ? (
                <Link className="ws-link" href="/sign-in">
                  Sign in again
                </Link>
              ) : (
                <button
                  type="button"
                  className="ws-link"
                  disabled={query.isFetching}
                  onClick={() => query.refetch()}
                >
                  {query.isFetching ? "Trying…" : "Try again"}
                </button>
              )}
            </div>
          ) : (
            children
          )}
        </>
      )}
    </AppShell>
  );
}
export function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={primary ? "ws-primary" : "ws-link"}>
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}
export function Empty({
  title,
  children,
  href,
  action,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <section className="ws-empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {href && action && (
        <ActionLink href={href} primary>
          {action}
        </ActionLink>
      )}
    </section>
  );
}
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <span className="ws-tag" data-tone={tone}>
      {children}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  const generatedId = useId();
  const control = isValidElement(children)
    ? (children as ReactElement<any>)
    : null;
  const fieldId = control?.props.id || generatedId;
  return (
    <div className={`ws-field ${wide ? "wide" : ""}`}>
      <label htmlFor={fieldId}>{label}</label>
      {control
        ? cloneElement(control, {
            id: fieldId,
            ...(hint ? { "aria-describedby": `${fieldId}-hint` } : {}),
          })
        : children}
      {hint && <small id={`${fieldId}-hint`}>{hint}</small>}
    </div>
  );
}
export function useAction(query: WorkspaceQuery) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function perform(
    path: string,
    body: unknown,
    success?: () => void,
    method = "POST",
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await query.request<{ message?: string }>(
        path,
        method,
        body,
      );
      await query.refresh();
      setNotice(result.message || "Saved.");
      success?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, error, notice, perform, setError, setNotice };
}
export function Feedback({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  return (
    <>
      {error && (
        <div className="ws-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="ws-alert" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
