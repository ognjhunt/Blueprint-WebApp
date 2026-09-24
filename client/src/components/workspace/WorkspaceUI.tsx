import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Helmet } from "@/lib/helmet";
import { AppShell, type AppView } from "@/components/blueprint/app/AppShell";
import { WorkspaceSetup } from "./WorkspaceSetup";
import {
  useWorkspace,
  statusLabel,
  WorkspaceRequestError,
} from "@/lib/workspace";
import type {
  TaskTargets,
  WorkspaceEvaluation,
  WorkspaceResult,
} from "@/types/workspace";
export type WorkspaceQuery = ReturnType<typeof useWorkspace>;
export function Frame({
  query,
  active,
  title,
  children,
  action,
  back,
}: {
  query: WorkspaceQuery;
  active: AppView;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <AppShell
      active={active}
      breadcrumb={title}
      role={query.data?.role}
      hasOwnedSites={Boolean(query.data?.tasks.length)}
      organization={query.data?.profile.organization}
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
export function TargetLine({ terms }: { terms: TaskTargets }) {
  const parts = [
    terms.successRate !== null ? `≥${terms.successRate}% success` : null,
    terms.cycleTimeSeconds !== null
      ? `≤${terms.cycleTimeSeconds} sec per cycle`
      : null,
  ].filter(Boolean);
  return (
    <span>
      {parts.length ? `Target: ${parts.join(" · ")}` : "Targets to be agreed"}
    </span>
  );
}
export function Score({ result }: { result: WorkspaceResult }) {
  return (
    <>
      <span>
        {result.successRate === null
          ? ["failed", "blocked", "abstained", "cancelled"].includes(
              result.status,
            )
            ? "No scored result"
            : [
                  "decided",
                  "decision_available",
                  "completed",
                  "complete",
                  "partially_decided",
                ].includes(result.status)
              ? "See detailed results"
              : "Results pending"
          : `${Number(result.successRate.toFixed(1))}% success`}
      </span>
      {result.cycleTimeSeconds !== null && (
        <small>{Number(result.cycleTimeSeconds.toFixed(1))} sec / cycle</small>
      )}
      {result.successRate !== null && (
        <small>
          {result.evidenceLabel}
          {result.sampleCount !== null ? ` · ${result.sampleCount} trials` : ""}
        </small>
      )}
    </>
  );
}
export function EvaluationTable({
  evaluations,
}: {
  evaluations: WorkspaceEvaluation[];
}) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Your setup</th>
            <th>Status</th>
            <th>Your result</th>
            <th>
              <span className="sr-only">View result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
                <small>{item.siteType || "Task evaluation"}</small>
              </td>
              <td>{item.setupName || "See run details"}</td>
              <td>
                <Tag tone={item.selected ? "green" : "neutral"}>
                  {item.outcome
                    ? statusLabel(item.outcome)
                    : item.successRate !== null
                      ? "Awaiting site decision"
                      : statusLabel(item.status)}
                </Tag>
              </td>
              <td>
                <Score result={item} />
              </td>
              <td>
                <ActionLink
                  href={`/app/evaluations/${encodeURIComponent(item.id)}`}
                >
                  View
                </ActionLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ws-native-dialog"
      onCancel={onClose}
      aria-labelledby="workspace-dialog-title"
    >
      <div className="ws-section-title">
        <h2 id="workspace-dialog-title">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ✕
        </button>
      </div>
      {children}
    </dialog>
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
