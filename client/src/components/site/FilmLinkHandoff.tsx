/**
 * Getting the record-only link to the person who will actually film.
 *
 * Once outreach is in the mix, the person we reached — a site ops lead at a
 * desk — is usually not the person who can walk the floor with a phone. So the
 * owner does not have to be the capturer: they send a film-scoped link to
 * whoever is on the ground, by text or email, and that person records without
 * ever being able to confirm the brief (which stays the owner's to attest).
 *
 * The link can still be copied and shared by hand; sending it is the one-step
 * version of the same thing. Text messaging is best effort — it is off unless
 * Twilio is configured — so when it is unavailable this says so and falls back
 * to the copyable link rather than pretending.
 */
import { useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; channel: "email" | "sms"; to: string }
  | { status: "failed"; message: string; filmUrl?: string };

export function FilmLinkHandoff({ token }: { token: string }) {
  const [to, setTo] = useState("");
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const [copyLink, setCopyLink] = useState<string | null>(null);
  const [copyPending, setCopyPending] = useState(false);

  async function mintCopyLink() {
    if (copyLink || copyPending) return;
    setCopyPending(true);
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/film-link`);
      const data = (await response.json().catch(() => null)) as { filmUrl?: string } | null;
      if (response.ok && data?.filmUrl) setCopyLink(data.filmUrl);
    } catch {
      // No link. The owner can still film themselves.
    } finally {
      setCopyPending(false);
    }
  }

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = to.trim();
    if (!destination || send.status === "sending") return;
    // A destination with an "@" is an email; otherwise we treat it as a phone
    // number, and the server insists on full international form.
    const channel: "email" | "sms" = destination.includes("@") ? "email" : "sms";
    setSend({ status: "sending" });
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/film-link/send`, {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ channel, to: destination }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; filmUrl?: string }
        | null;
      if (response.ok && data?.ok) {
        setSend({ status: "sent", channel, to: destination });
        setTo("");
        return;
      }
      setSend({
        status: "failed",
        message: data?.error || "We could not send that. Copy the link and share it directly.",
        filmUrl: data?.filmUrl,
      });
    } catch {
      setSend({ status: "failed", message: "We could not reach Blueprint. Try again shortly." });
    }
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <p className="ms-field-hint" style={{ marginBottom: "8px" }}>
        Someone else doing the filming? Send them a record-only link — they can film and upload, but
        only you can confirm the task brief.
      </p>

      <form onSubmit={sendLink} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          type="text"
          inputMode="text"
          value={to}
          maxLength={320}
          placeholder="their phone (+15551234567) or email"
          onChange={(event) => setTo(event.target.value)}
          style={{ flex: "1 1 220px", minWidth: 0 }}
          aria-label="Phone number or email of whoever is filming"
        />
        <button type="submit" className="ms-button" disabled={send.status === "sending" || !to.trim()}>
          {send.status === "sending" ? "Sending…" : "Send link"}
        </button>
      </form>

      {send.status === "sent" && (
        <p className="ms-field-hint" style={{ marginTop: "8px", color: "var(--ms-ok, #157347)" }}>
          Sent to {send.to} ✓ — they can open it on their phone, no app needed.
        </p>
      )}
      {send.status === "failed" && (
        <div role="alert" style={{ marginTop: "8px" }}>
          <p className="ms-field-hint" style={{ color: "var(--ms-alert, #b00)", margin: 0 }}>
            {send.message}
          </p>
          {send.filmUrl && (
            <input
              readOnly
              value={send.filmUrl}
              onFocus={(event) => event.currentTarget.select()}
              style={{ width: "100%", marginTop: "6px" }}
              aria-label="Record-only link to copy"
            />
          )}
        </div>
      )}

      <p className="ms-field-hint" style={{ marginTop: "10px" }}>
        Or{" "}
        <button
          type="button"
          className="ms-text-link"
          onClick={mintCopyLink}
          disabled={copyPending}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
        >
          {copyPending ? "Creating…" : "copy a record-only link"}
        </button>{" "}
        to share yourself.
      </p>
      {copyLink && (
        <input
          readOnly
          value={copyLink}
          onFocus={(event) => event.currentTarget.select()}
          style={{ width: "100%", marginTop: "6px" }}
          aria-label="Record-only link to copy"
        />
      )}
    </div>
  );
}
