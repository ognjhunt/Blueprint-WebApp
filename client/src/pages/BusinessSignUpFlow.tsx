import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { signInWithCustomToken, sendEmailVerification, type User } from "firebase/auth";
import { Helmet } from "@/lib/helmet";
import { SEO } from "@/components/SEO";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { workspaceRequest } from "@/lib/workspace";
import { invitationRequest, type AccountInvitation } from "@/lib/accountInvitation";
import { friendlyAuthError } from "@/lib/siteClaim";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";

/** Public URLs collect interest; only a current server-approved invitation shows credentials. */
export default function BusinessSignUpFlow() {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("invitation") || "");
  const [invitation, setInvitation] = useState<AccountInvitation | null>(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [optionalUpdates, setOptionalUpdates] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const account = useRef<User | null>(null);
  const pending = useRef(false);
  const googleReady = useRef(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    invitationRequest<AccountInvitation>("inspect", token).then(data => {
      if (!active) return;
      setInvitation(data); setName(data.name); setOrganization(data.organization);
      void import("@/lib/firebase").catch(() => undefined);
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  async function finish(user: User) {
    if (!invitation || user.email?.trim().toLowerCase() !== invitation.email) throw new Error("Sign in with the email address on your Blueprint invitation.");
    account.current = user;
    await workspaceRequest(user, "/setup", "POST", { name: name.trim(), organization: organization.trim(), workspaceType: invitation.workspaceType, acceptedTerms: true, optionalUpdates });
    if (!user.emailVerified) await sendEmailVerification(user, { url: new URL(invitation.returnTo, window.location.origin).toString() });
    window.location.assign(invitation.returnTo);
  }
  async function submit(google: boolean) {
    if (pending.current || !invitation) return;
    setError("");
    if (!terms || !name.trim() || !organization.trim()) { setError("Enter your name and organization, and accept the Terms and Privacy Policy."); return; }
    if (!google && !account.current && password.length < 8) { setError("Use at least 8 characters for your password."); return; }
    pending.current = true; setBusy(true);
    try {
      const firebase = await import("@/lib/firebase");
      if (google) {
        if (!googleReady.current) { await invitationRequest("redeem", token, { mode: "google", acceptedTerms: true }); googleReady.current = true; }
        await finish(await firebase.signInWithGoogle());
      } else {
        let user = account.current;
        if (!user) {
          const data = await invitationRequest<{ customToken: string }>("redeem", token, { mode: "password", password, acceptedTerms: true });
          user = (await signInWithCustomToken(firebase.auth, data.customToken)).user;
          account.current = user; setPassword("");
        }
        await finish(user);
      }
    } catch (failure: any) {
      setError(failure.code === "auth/popup-blocked" && googleReady.current
        ? "Your invitation is ready. Click Continue with Google again to open sign-in."
        : friendlyAuthError(failure, "We could not finish account setup. Please try again."));
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
    <SEO noIndex title={`${invitation ? "Create your account" : "Request access"} | Blueprint`} description="Blueprint accounts are available by invitation after intake and approval." canonical="/signup/business" />
    <AuthLayout>
      <h1>{checking ? "Checking your invitation" : invitation ? "Create your account" : "Access by invitation"}</h1>
      {!invitation ? <>
        <p className="auth-description">{checking ? "We’re checking the approval for this email address." : "Start with your site task or register your robot team. We’ll invite you to create an account after the required review and approval."}</p>
        {!checking && <div className="auth-form">
          <a className="auth-primary" href="/contact/site-operator">Show us a task <ArrowRight size={18} aria-hidden="true" /></a>
          <a className="auth-google" href="/contact/robot-team">Register robot-team interest</a>
        </div>}
      </> : <>
        <p className="auth-description">Your {invitation.workspaceType === "robot_team" ? "robot team" : "site"} is approved. Use the email address on your invitation.</p>
        <form className="auth-form auth-simple-signup" onSubmit={event => { event.preventDefault(); void submit(false); }} aria-busy={busy}>
          <div><label htmlFor="email">Work email</label><input id="email" type="email" value={invitation.email} readOnly autoComplete="email" /></div>
          <div><label htmlFor="contactName">Your name</label><input id="contactName" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={160} disabled={busy} required /></div>
          <div><label htmlFor="organizationName">Organization</label><input id="organizationName" value={organization} onChange={e => setOrganization(e.target.value)} autoComplete="organization" maxLength={160} disabled={busy} required /></div>
          {!account.current && <div><label htmlFor="password">Password</label><div className="auth-password"><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" disabled={busy} /><button type="button" disabled={busy} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className="auth-signup-note">At least 8 characters. Skip this field to use Google.</p></div>}
          <label className="auth-signup-consent"><input type="checkbox" checked={optionalUpdates} onChange={e => setOptionalUpdates(e.target.checked)} disabled={busy} /><span>Email me relevant jobs and Blueprint updates (optional). Unsubscribe anytime.</span></label>
          <label className="auth-signup-consent"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} disabled={busy} /><span>I agree to the <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> and <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> and am authorized to create this organization’s account.</span></label>
          <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Saving…" : account.current ? "Finish setup" : "Create account"}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <button className="auth-google" type="button" disabled={busy} onClick={() => void submit(true)}>Continue with Google</button>
      </>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <p className="auth-account-link">Already have an account? <a href="/sign-in">Sign in</a></p>
    </AuthLayout>
  </>;
}
