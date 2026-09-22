import type { ReactNode } from "react";

export function BuyerAppLoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="ws-loading" role="status">{label}</p>;
}

/** Shows what actually failed; callers pass the request's own error message. */
export function BuyerAppErrorState({ message }: { message: string }) {
  return (
    <div className="ws-alert" role="alert">
      <p>{message}</p>
      <p className="mt-1 text-sm">Reload the page to try again.</p>
    </div>
  );
}

export function BuyerAppEmptyState({
  title = "Nothing here yet",
  body,
  action,
}: {
  title?: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ws-empty">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action}
    </section>
  );
}
