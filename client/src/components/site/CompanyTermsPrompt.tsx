import { useState } from "react";
import type { User } from "firebase/auth";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { PRIVACY_URL, PRIVACY_VERSION, TERMS_URL, TERMS_VERSION } from "@/lib/legalAcceptance";
import { TERMS_PROMPT } from "@/lib/companyResponses";

/**
 * Shown to an approved deployment company that has not accepted the current Terms and Privacy Policy, in place of the
 * library or a job page: nothing about any job, only this. Pressing the button records the acceptance on the account
 * (`POST /api/robot-team-access/accept-terms`, versions from the server), then the page loads its jobs.
 */
export function CompanyTermsPrompt({ user, onAccepted }: { user: User; onAccepted: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function agree() {
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/robot-team-access/accept-terms", { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }) });
      if (!response.ok) throw new Error("not saved");
      onAccepted();
    } catch { setMessage("Your agreement was not saved. Try again."); }
    finally { setSaving(false); }
  }
  return <section aria-label="Terms and Privacy Policy" className="ms-task-empty">
    <p>{TERMS_PROMPT}</p>
    <p><a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> · <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a></p>
    <button type="button" className="ms-button" onClick={() => void agree()} disabled={saving}>
      {saving ? "Saving…" : "I agree to the Terms and Privacy Policy"}</button>
    {message && <p role="alert">{message}</p>}
  </section>;
}
