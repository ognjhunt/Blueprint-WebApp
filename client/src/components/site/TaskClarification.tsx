import { useEffect, useRef, useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

type Clarification = { revision: string; questions: string[]; needed: boolean;
  response?: { revision: string; explanation: string; state: string } | null };

export function TaskClarification({ token, refreshKey }: { token: string; refreshKey?: string }) {
  const [request, setRequest] = useState<Clarification | null>(null);
  const [explanation, setExplanation] = useState("");
  const draft = useRef("");
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const url = `/api/site-task-brief/${encodeURIComponent(token)}/clarification`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Questions could not be loaded. Please retry.");
      const data: Clarification = await response.json();
      if (controller.signal.aborted) return;
      setRequest(data);
      if (!draft.current && data.response?.revision === data.revision) setExplanation(data.response.explanation);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [url, refreshKey, loadAttempt]);
  const saved = request?.response?.revision === request?.revision && Boolean(request?.response);
  if (!request && !error) return <p className="ms-field-hint">Checking for job questions…</p>;
  if (request && !request.needed && !error && !saved) return null;
  return <section className="ms-intake-questions" aria-label="Answer job questions">
    {request?.questions.length ? <>
      <h2>Questions about your job</h2>
      <ul>{request.questions.map(question => <li key={question}>{question}</li>)}</ul>
    </> : null}
    {saved && !editing ? <>
      <p role="status">Your answer is saved with this job for review.</p>
      <details><summary>Your saved answer</summary><p style={{whiteSpace:"pre-wrap"}}>{request!.response!.explanation}</p></details>
      {request?.needed && <button type="button" className="ms-text-link" onClick={() => setEditing(true)}>Edit your answer</button>}
    </> : request?.needed && request.questions.length > 0 ? <>
      <label htmlFor="screening-explanation">Your answers</label>
      <textarea id="screening-explanation" value={explanation} maxLength={4000} rows={4} disabled={busy}
        onChange={event => { draft.current = event.target.value; setExplanation(event.target.value); }} />
      <p className="ms-field-hint">Answer what you know. If something is uncertain, say what still needs checking.</p>
      <button type="button" className="ms-button" disabled={busy || !explanation.trim()} onClick={async () => {
        setBusy(true); setError("");
        try {
          const response = await fetch(url, { method: "POST", credentials: "include", headers: await withCsrfHeader({ "Content-Type": "application/json" }),
            body: JSON.stringify({ revision: request.revision, explanation: explanation.trim() }) });
          if (!response.ok) throw new Error((await response.json()).error || "Your answer could not be saved. Please retry.");
          const result = await response.json();
          setRequest(current => current ? {...current, response: {revision: request.revision, explanation: explanation.trim(), state: result.state}} : current);
          draft.current = ""; setEditing(false);
        } catch (error) { setError(error instanceof Error ? error.message : "Your answer could not be saved. Please retry."); }
        finally { setBusy(false); }
      }}>{busy ? "Saving…" : "Save answers"}</button>
    </> : request?.needed ? <p className="ms-field-hint">No specific question has been added yet.</p> : null}
    {error && <p role="alert">{error}</p>}
    {(error || request?.needed && !request.questions.length) && <button type="button" className="ms-text-link" disabled={busy}
      onClick={() => { setError(""); setLoadAttempt(value => value + 1); }}>Retry questions</button>}
  </section>;
}
