import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";
import { gateFields } from "@/data/siteTaskQualification";
import type { SiteScreeningSummary } from "@/types/inbound-request";

/**
 * Where ops records what a screening call settled.
 *
 * A `needs_conversation` site gets no scene until this panel re-screens it to
 * `qualified`: Blueprint funds preparation only for sites that clear. The
 * server re-runs the same scorer the brief confirmation uses; this panel only
 * collects what the site said on the call.
 */
export function SiteScreeningCallPanel({
  requestId,
  triage,
  gatesOnFile,
  briefConfirmed,
}: {
  requestId: string;
  triage: SiteScreeningSummary | null | undefined;
  gatesOnFile: Record<string, string>;
  briefConfirmed: boolean;
}) {
  const queryClient = useQueryClient();
  const [cleared, setCleared] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const clarification = useQuery({ queryKey: ["site-task-clarification", requestId], queryFn: async () => {
    const response = await fetch(`/api/admin/leads/${requestId}/site-task-clarification`);
    if (!response.ok) throw new Error("Could not load the owner's written clarification.");
    return response.json() as Promise<{ revision: string; response?: { id: string; revision: string; state: string; explanation: string } }>;
  } });
  const written = clarification.data?.response;
  const currentWritten = written?.state === "review_required" && written.revision === clarification.data?.revision;

  const record = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/leads/${requestId}/site-task-call`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ note, answers, clearedFieldIds: cleared, clarificationId: currentWritten ? written.id : undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not record the call");
      return body as { disposition: string };
    },
    onSuccess: () => {
      setCleared([]);
      setAnswers({});
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
      queryClient.invalidateQueries({ queryKey: ["site-task-clarification", requestId] });
    },
  });

  if (!triage) return null;
  const fieldFor = (fieldId: string) => gateFields.find((field) => field.id === fieldId);
  const openIds = triage.open_question_field_ids ?? [];
  const openFields = [...new Set([...openIds, ...triage.unanswered_field_ids, ...triage.blocking_field_ids])]
    .map(fieldFor)
    .filter((field): field is NonNullable<typeof field> => Boolean(field));

  return (
    <div className="border border-runway-line p-4" data-testid="site-screening-call">
      <p className="runway-meta">Screening</p>
      <p className="mt-2 text-sm text-runway-body">
        Verdict: <strong>{triage.disposition.replace(/_/g, " ")}</strong>
        {triage.disposition === "qualified"
          ? " — Blueprint funds the scene."
          : triage.disposition === "needs_conversation"
            ? " — no scene until a reviewer clears the open questions."
            : " — no scene; an answer only the site can change blocks it."}
      </p>
      {written && <div className="mt-3 text-sm"><strong>Owner's written clarification{!currentWritten ? " (previous revision)" : ""}</strong><p className="whitespace-pre-wrap">{written.explanation}</p></div>}
      {clarification.error && <p role="alert">{clarification.error.message}</p>}
      {triage.call_resolution ? (
        <p className="mt-2 text-sm text-runway-mute">
          Last call recorded by {triage.call_resolution.resolved_by}: {triage.call_resolution.note}
        </p>
      ) : null}
      {!briefConfirmed ? (
        <p className="mt-3 text-sm text-runway-mute">The site has not confirmed its brief yet.</p>
      ) : openFields.length && triage.disposition !== "qualified" ? (
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            record.mutate();
          }}
        >
          {openFields.map((field) => {
            const marginal = openIds.includes(field.id);
            const current = fieldFor(field.id)?.options.find((option) => option.value === gatesOnFile[field.id]);
            return (
              <fieldset key={field.id} className="grid gap-2 text-sm">
                <legend className="font-medium text-runway-body">{field.question}</legend>
                <p className="text-runway-mute">On file: {current?.label ?? "No answer"}</p>
                {marginal ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cleared.includes(field.id)}
                      onChange={(event) =>
                        setCleared((ids) =>
                          event.target.checked ? [...ids, field.id] : ids.filter((id) => id !== field.id),
                        )
                      }
                    />
                    Reviewed and settled, answer stands
                  </label>
                ) : null}
                <select
                  aria-label={`What the site said: ${field.question}`}
                  value={answers[field.id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                  className="border border-runway-line bg-transparent p-2"
                >
                  <option value="">{marginal || current ? "Keep the answer on file" : "Choose what the site said"}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </fieldset>
            );
          })}
          <label className="grid gap-2 text-sm">
            What the review settled
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="border border-runway-line bg-transparent p-2"
            />
          </label>
          {record.error ? <p className="text-sm text-red-600">{(record.error as Error).message}</p> : null}
          <button
            type="submit"
            disabled={record.isPending || note.trim().length < 10}
            className="runway-cta-ghost min-h-0 justify-self-start px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {record.isPending ? "Recording…" : "Record screening outcome"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
