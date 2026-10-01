import { useState } from "react";

export type OutreachReviewSummary = {
  hardChecksPassed: boolean;
  blockers: string[];
  digest: string | null;
  semanticReviewRequired: Record<string, string>;
};
export type OutreachApproval = { digest: string; checks: Record<string, "pass"> };

/** Human attestation for the existing approval queue, bound to its current digest. */
export function OutreachApprovalReview({ review, payload, pending, onApprove, sendingEnabled }: {
  review?: OutreachReviewSummary;
  payload: Record<string, unknown>;
  pending: boolean;
  onApprove: (review: OutreachApproval) => void;
  sendingEnabled?: boolean;
}) {
  const digest = review?.digest ?? null;
  const [decisions, setDecisions] = useState<{ digest: string | null; checked: string[] }>({ digest, checked: [] });
  const checked = decisions.digest === digest ? decisions.checked : [];
  const prompts = Object.entries(review?.semanticReviewRequired ?? {});
  const ready = sendingEnabled !== false && review?.hardChecksPassed && digest && prompts.length > 0 && prompts.every(([key]) => checked.includes(key));

  return (
    <div className="w-full space-y-3 border border-runway-line p-3 text-sm">
      <p className="font-medium">Outreach review</p>
      <p>Read the exact message and verify its sources before approving each review item.</p>
      {typeof payload.from === "string" ? <p>From: {payload.from}</p> : null}
      <p>To: {String(payload.to ?? "")}</p>
      <p>Subject: {String(payload.subject ?? "")}</p>
      <p className="whitespace-pre-wrap">{String(payload.body ?? "")}</p>
      <details>
        <summary className="cursor-pointer">Source evidence and draft limits</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify({
          evidence: payload.outreachContext, draft: payload.outreachContract,
          communications: payload.communications,
        }, null, 2)}</pre>
      </details>
      {typeof payload.transportBody === "string" ? <details><summary>Full message including footer</summary>
        <pre className="whitespace-pre-wrap break-words">{payload.transportBody}</pre></details> : null}
      {sendingEnabled === false ? <p role="status">Sending is disabled. This saved Blueprint draft is awaiting review and release authorization.</p> : null}
      {!review?.hardChecksPassed ? (
        <p role="alert">Revise this draft before approval: {review?.blockers.join(", ") || "review contract is missing"}.</p>
      ) : prompts.map(([key, prompt]) => (
        <label key={key} className="flex items-start gap-2">
          <input type="checkbox" checked={checked.includes(key)} disabled={pending} onChange={(event) => {
            const next = event.currentTarget.checked ? [...checked, key] : checked.filter((item) => item !== key);
            setDecisions({ digest, checked: next });
          }} />
          <span>{prompt}</span>
        </label>
      ))}
      <button type="button" className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" disabled={!ready || pending}
        onClick={() => {
          if (ready && digest) onApprove({ digest, checks: Object.fromEntries(prompts.map(([key]) => [key, "pass" as const])) });
        }}>
        Approve outreach
      </button>
    </div>
  );
}
