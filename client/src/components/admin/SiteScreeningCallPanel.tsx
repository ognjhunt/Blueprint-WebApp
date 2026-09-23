import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  const record = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/leads/${requestId}/site-task-call`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ note, answers, clearedFieldIds: cleared }),
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
            ? " — no scene until the call clears it."
            : " — no scene; an answer only the site can change blocks it."}
      </p>
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
                    Settled on the call, answer stands
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
            What the call settled
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
            {record.isPending ? "Recording…" : "Record call outcome"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
