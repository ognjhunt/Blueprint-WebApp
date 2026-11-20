/**
 * What a deployment company sees on the job library's page before it is approved.
 *
 * The library is shown to approved companies only. Every other visitor gets the
 * one thing they can do next: apply (on `/partners`, the one application form),
 * wait for approval, or verify the email that was approved.
 */
import { useEffect, useState } from "react";

import { currentAuthUser, sendAccountVerification } from "@/lib/accountAuth";
import { jobLibrarySignInHref, requestInvitationLink, type LibraryAccess } from "@/lib/robotTeamAccess";

/**
 * An approved team creates its account only from its emailed invitation link;
 * a sign-up page without that link can only send it back here. So an approved
 * team that lost the link, or let it expire, asks for a new one.
 */
function ApprovedTeamAccess() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("approvedEmail") ?? "").trim();
    setState("sending");
    try {
      await requestInvitationLink(email);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="ms-field-hint ms-early-access-account" id="approved-team">
      <p>
        Already approved? <a href={jobLibrarySignInHref()}>Sign in</a> or use your emailed invitation to set up your account.
      </p>
      <details>
        <summary>Lost or expired link? Email me a new one</summary>
        <form className="ms-form" method="post" onSubmit={submit} aria-label="Request a new invitation link">
          <label>Approved email<input disabled={!interactive} name="approvedEmail" type="email" autoComplete="email" maxLength={320} required /></label>
          <button className="ms-button" disabled={!interactive || state === "sending"}>{state === "sending" ? "Sending…" : "Email my invitation link"}</button>
        </form>
        {state === "sent" && <p role="status">If that address is approved, check its inbox for your invitation. If it does not arrive, <a href="mailto:hello@tryblueprint.io">contact us</a>.</p>}
        {state === "error" && <p role="alert">The link could not be sent. Try again, or email <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p>}
      </details>
    </div>
  );
}

/** The application itself lives on the page for deployment companies; this page points there (one form, not two). */
function ApplyLink() {
  return (
    <div className="ms-task-empty">
      <p>Approved deployment companies can browse jobs and respond.</p>
      <p><a className="ms-button" href="/partners#partner-application">Apply</a></p>
    </div>
  );
}

export function RobotTeamEarlyAccess({ access, email, returnTo = "/contact/robot-team", onVerified }: {
  access: LibraryAccess | null; email: string | null; returnTo?: string; onVerified?: () => void;
}) {
  const status = access?.status ?? "none";
  const [verification, setVerification] = useState<"idle" | "sending" | "sent" | "error">("idle");
  useEffect(() => {
    if (status !== "approved" || access?.emailVerified !== false || !email || !onVerified) return;
    let active = true;
    async function checkVerification() {
      try {
        const user = await currentAuthUser();
        if (!user || user.email?.toLowerCase() !== email?.toLowerCase()) return;
        await user.reload();
        if (!user.emailVerified) return;
        await user.getIdToken(true);
        if (active) onVerified?.();
      } catch {
        // Reopening the verification link or returning to this tab will try again.
      }
    }
    void checkVerification();
    const checkOnFocus = () => void checkVerification();
    window.addEventListener("focus", checkOnFocus);
    return () => { active = false; window.removeEventListener("focus", checkOnFocus); };
  }, [status, access?.emailVerified, email, onVerified]);

  async function resendVerification() {
    setVerification("sending");
    try {
      const user = await currentAuthUser();
      if (!user || !email || user.email?.toLowerCase() !== email.toLowerCase()) throw new Error("account_changed");
      await sendAccountVerification(user, new URL(returnTo, window.location.origin).toString());
      setVerification("sent");
    } catch {
      setVerification("error");
    }
  }

  if (status === "approved" && access && !access.emailVerified) {
    return (
      <div className="ms-task-empty">
        <h2>You are approved. Verify your email to see jobs.</h2>
        <p>Open the verification email we sent{email ? ` to ${email}` : ""}. Its link takes you back here.</p>
        <button className="ms-button" type="button" disabled={verification === "sending"} onClick={() => void resendVerification()}>
          {verification === "sending" ? "Sending…" : "Resend verification email"}
        </button>
        {verification === "sent" && <p role="status">Verification email sent. Open the link in your inbox.</p>}
        {verification === "error" && <p role="alert">We could not resend the email. Try again from Settings.</p>}
      </div>
    );
  }

  if (status === "applied") {
    return (
      <div className="ms-task-empty">
        <h2>Your application is in review.</h2>
        <p>We'll email {email ?? "you"} if your company is approved.</p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="ms-task-empty">
        <h2>Thanks for applying.</h2>
        <p>We cannot offer access yet. We will email you if that changes, and you can reach us at <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p>
      </div>
    );
  }

  return (
    <section aria-label="Early access" className="ms-early-access">
      <ApplyLink />
      {!access?.signedIn && <ApprovedTeamAccess />}
    </section>
  );
}
