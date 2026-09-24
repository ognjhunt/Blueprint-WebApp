import { useEffect, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";
import { TaskItemsPanel } from "./TaskItemsPanel";

type Question = { id: string; question: string; hint: string };

export function TaskFollowUp({ token, onAnswered }: { token: string; onAnswered?: (id: string, answer: string) => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/site-task-brief/${encodeURIComponent(token)}/follow-up`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => {
        if (active) setQuestions(Array.isArray(body?.questions) ? body.questions : []);
      })
      .catch(() => { if (active) setQuestions([]); });
    return () => { active = false; };
  }, [token]);

  const current = questions?.[index];
  if (questions === null) return <p className="ms-field-hint">Checking if we need anything else…</p>;
  if (!questions.length) return null;

  async function advance(skip = false) {
    if (!current) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/follow-up`, {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ questionId: current.id, answer: skip ? "" : answer.trim() }),
      });
      if (!response.ok) throw new Error("save failed");
      if (!skip) onAnswered?.(current.id, answer.trim());
    } catch {
      setError("We could not save that. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setAnswer("");
    setIndex((value) => value + 1);
  }

  return (
    <section className="ms-form" style={{ marginTop: "24px", padding: "20px", border: "1px solid var(--ms-rule)", gap: "12px" }}>
      <p className="ms-field-hint" style={{ margin: "0 0 12px" }}>
        A few details while we review your video · {Math.min(index + 1, questions.length)} of {questions.length}
      </p>
      {current ? (
        <>
          <h2 style={{ margin: "0 0 8px" }}>{current.question}</h2>
          <p className="ms-field-hint" style={{ margin: "0 0 16px" }}>{current.hint}</p>
          {current.id === "item_photos" ? (
            <TaskItemsPanel token={token} scope="owner" />
          ) : (
            <label htmlFor="task-follow-up-answer">
              <span className="sr-only">Your answer</span>
              <textarea
                id="task-follow-up-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={1000}
                rows={3}
                style={{ minHeight: "96px" }}
                placeholder="Type what you know…"
              />
            </label>
          )}
          {error && <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>{error}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginTop: "16px" }}>
            <button className="ms-button" type="button" disabled={saving || (current.id !== "item_photos" && !answer.trim())} onClick={() => void advance()}>
              {saving ? "Saving…" : current.id === "item_photos" ? "Continue" : "Save answer"}
            </button>
            <button className="ms-text-link" type="button" disabled={saving} onClick={() => void advance(true)} style={{ border: 0, background: "none", cursor: "pointer" }}>
              I'll add this later
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ margin: 0 }}>Thanks, that helps.</h2>
          <p className="ms-field-hint" style={{ marginBottom: 0 }}>We’ll keep reviewing the video. You can return to this link for updates.</p>
        </>
      )}
    </section>
  );
}
