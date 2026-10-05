import { useEffect, useState } from "react";

export function TaskClarification({ token }: { token: string }) {
  const [request, setRequest] = useState<{ revision: string; questions: string[]; needed: boolean; response?: { explanation: string } } | null>(null);
  const [explanation, setExplanation] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/site-task-brief/${encodeURIComponent(token)}/clarification`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Questions could not be loaded. Reload to retry.");
      const data = await response.json(); setRequest(data); setExplanation(data.response?.explanation || "");
    }).catch(error => { if (!controller.signal.aborted) setStatus(error.message); });
    return () => controller.abort();
  }, [url]);
  if (request && !request.needed) return null;
  return <section aria-label="Answer screening questions">
    <h3>Answer in writing</h3>
    <p>You can explain the open questions here. A reviewer will check your answers; you can also book a call.</p>
    {request?.questions.length ? <ul>{request.questions.map(question => <li key={question}>{question}</li>)}</ul> : null}
    <label htmlFor="screening-explanation">Your explanation</label>
    <textarea id="screening-explanation" value={explanation} maxLength={4000} rows={5} onChange={event => setExplanation(event.target.value)} />
    <button type="button" className="ms-button" disabled={!request || busy || explanation.trim().length < 10} onClick={async () => {
      setBusy(true); setStatus("");
      try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: request!.revision, explanation }) });
        if (!response.ok) throw new Error((await response.json()).error);
        setStatus("Your explanation is saved for review. We will email you when there is an update.");
      } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save. Please retry."); }
      finally { setBusy(false); }
    }}>{busy ? "Saving…" : "Send explanation"}</button>
    <p role="status">{status}</p>
  </section>;
}
