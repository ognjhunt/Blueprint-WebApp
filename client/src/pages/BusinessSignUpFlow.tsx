import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createUserWithEmailAndPassword, getAuth, type User } from "firebase/auth";
import { SEO } from "@/components/SEO";
import { AuthLayout, AuthSteps } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsEvents, getSafeErrorType } from "@/lib/analytics";
import { getDemandAttributionFromSearchParams, hasDemandAttribution } from "@/lib/demandAttribution";
import { onboardingDestination } from "@/lib/onboardingDestination";
import { workspaceRequest } from "@/lib/workspace";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import type { WorkspaceAccountSetup } from "@/types/workspace";

type WorkspaceType = "site_operator" | "robot_team" | "";
function initialWorkspace(): WorkspaceType {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const value = (params.get("buyerType") || params.get("persona") || "").replaceAll("-", "_");
  return value === "site_operator" || value === "robot_team" ? value : "";
}

export default function BusinessSignUpFlow() {
  const { currentUser } = useAuth();
  const account = useRef<User | null>(null);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>(initialWorkspace);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const attribution = useMemo(() => getDemandAttributionFromSearchParams(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)), []);
  const analytics = { buyerType: workspaceType, requestedLaneCount: 0, includesQualificationLane: false, companySize: "", budgetRange: "", referralSource: "", ...(hasDemandAttribution(attribution) ? { demandAttribution: attribution } : {}) };
  useEffect(() => {
    analyticsEvents.businessSignupStarted({ defaultRequestedLane: "none", requestedLaneCount: 0, ...(hasDemandAttribution(attribution) ? { demandAttribution: attribution } : {}) });
  }, [attribution]);

  // Resume an unfinished signup after reload. Never overwrite an existing
  // customer's workspace merely because they revisit the signup URL.
  useEffect(() => {
    if (!currentUser || pending.current) return;
    let active = true;
    account.current = currentUser;
    setEmail(currentUser.email || "");
    setName(currentUser.displayName || "");
    setAccountCreated(true);
    setStep(2);
    setBusy(true);
    workspaceRequest<WorkspaceAccountSetup>(currentUser, "/setup").then(data => {
      if (!active) return;
      if (data.workspaceType) window.location.assign(onboardingDestination(data.workspaceType, window.location.search, true));
      else {
        setName(data.profile.name || currentUser.displayName || "");
        setOrganization(data.profile.organization || "");
      }
    }).catch(() => {
      if (active) setError("Your account is signed in. Complete your workspace details below, or open Settings to continue setup.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [currentUser]);

  useEffect(() => { if (step === 2) heading.current?.focus(); }, [step]);

  async function google() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { signInWithGoogle } = await import("@/lib/firebase");
      const user = await signInWithGoogle();
      account.current = user;
      setAccountCreated(true);
      setEmail(user.email || "");
      setName(user.displayName || "");
      setStep(2);
      const data = await workspaceRequest<WorkspaceAccountSetup>(user, "/setup");
      if (data.workspaceType) { window.location.assign(onboardingDestination(data.workspaceType, window.location.search, true)); return; }
      setName(data.profile.name || user.displayName || "");
      setOrganization(data.profile.organization || "");
    } catch (failure: any) {
      setError(failure.code === "auth/popup-closed-by-user" ? "Google sign-in was closed. Try again or use your email." : "Could not finish Google sign-in. Please try again.");
    } finally { pending.current = false; setBusy(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || busy) return;
    setError("");
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
      if (password.length < 8) { setError("Use at least 8 characters for your password."); return; }
      setStep(2);
      return;
    }
    if (!name.trim() || !organization.trim() || !workspaceType) { setError("Enter your name, organization, and workspace type."); return; }
    if (!acceptedTerms) { setError("Accept the Terms and Privacy Policy to continue."); return; }
    pending.current = true;
    setBusy(true);
    analyticsEvents.businessSignupSubmitted({ ...analytics, hasPhoneNumber: false, hasWorkflowContext: false, hasOperatingConstraints: false, hasPrivacySecurityConstraints: false, hasCommercializationPreference: false, hasKnownBlockers: false, hasTargetRobotTeam: false });
    try {
      if (!account.current) {
        // Initialize the existing Firebase client; create credentials only once.
        await import("@/lib/firebase");
        const result = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
        account.current = result.user;
        setAccountCreated(true);
        setPassword("");
      }
      const existing = await workspaceRequest<WorkspaceAccountSetup>(account.current, "/setup");
      if (existing.workspaceType) { window.location.assign(onboardingDestination(existing.workspaceType, window.location.search, true)); return; }
      await workspaceRequest(account.current, "/setup", "POST", {
        name: name.trim(), organization: organization.trim(), workspaceType, acceptedTerms: true,
      });
      analyticsEvents.businessSignupCompleted(analytics);
      // Reload the authoritative profile before entering the correct workspace.
      // The public funnels are the front doors. A site goes to the capture
      // form, a robot team to the task library; the workspace is where a task
      // is followed once it exists, not a second intake.
      window.location.assign(onboardingDestination(workspaceType, window.location.search));
    } catch (failure: any) {
      analyticsEvents.businessSignupFailed({ buyerType: workspaceType, requestedLaneCount: 0, stage: "account_creation", stepNumber: 2, errorType: getSafeErrorType(failure) });
      if (account.current) setError("Your account is created, but workspace setup did not save. Your details are still here—try again.");
      else if (failure.code === "auth/email-already-in-use") setError("An account with this email already exists. Sign in below to continue.");
      else if (failure.code === "auth/weak-password") { setError("Choose a stronger password with at least 8 characters."); setStep(1); }
      else setError("Could not create your account. Please try again.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <>
    <SEO title="Create an account | Blueprint" description="Create your Blueprint account, then set up your site or robot team." canonical="/signup/business" />
    <AuthLayout>
      <h1 ref={heading} tabIndex={-1}>{step === 1 ? "Create an account" : "Set up your workspace"}</h1>
      <p className="auth-description">{step === 1 ? "Start with your email. Set up your workspace next." : "A few details, then you’re in."}</p>
      <AuthSteps currentStep={step} labels={["Account", "Workspace"]} />
      <form className="auth-form auth-simple-signup" method="post" onSubmit={submit} noValidate aria-label={step === 1 ? "Account details" : "Workspace details"} aria-busy={busy}>
        {step === 1 ? <>
          <div><label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></div>
          <div><label htmlFor="password">Password</label><div className="auth-password"><input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} aria-describedby="signup-password-hint" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="signup-password-hint" className="auth-signup-note">At least 8 characters.</p></div>
        </> : <>
          <p className="auth-signup-email">{email}</p>
          <div><label htmlFor="contactName">Your name</label><input id="contactName" autoComplete="name" maxLength={160} value={name} onChange={e => setName(e.target.value)} required disabled={busy} /></div>
          <div><label htmlFor="organizationName">Organization</label><input id="organizationName" autoComplete="organization" maxLength={160} value={organization} onChange={e => setOrganization(e.target.value)} required disabled={busy} /></div>
          <fieldset className="auth-workspace-choice" disabled={busy}><legend>I’m here to</legend>
            <label><input type="radio" name="workspaceType" value="site_operator" checked={workspaceType === "site_operator"} onChange={() => setWorkspaceType("site_operator")} required /><span>Plan a robot pilot for my site</span></label>
            <label><input type="radio" name="workspaceType" value="robot_team" checked={workspaceType === "robot_team"} onChange={() => setWorkspaceType("robot_team")} required /><span>Assess site tasks for my robots</span></label>
          </fieldset>
          <p className="auth-signup-note">{workspaceType === "site_operator" ? "Next, describe one recurring job and share footage. Your task page will track its assessment and pilot decisions." : workspaceType === "robot_team" ? "Next, review approved site tasks and confirm what your team can support." : "Next, start with a task or the task library."}</p>
          <label className="auth-signup-consent"><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} disabled={busy} required /><span>I agree to the <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> and <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> and am authorized to create this organization’s account.</span></label>
        </>}
        {error && <div className="auth-error" role="alert">{error}{accountCreated && <> <a href="/settings">Open Settings</a></>}</div>}
        <div className="auth-signup-actions">{step === 2 && !accountCreated && <button className="auth-back" type="button" disabled={busy} onClick={() => { setError(""); setStep(1); }}>← Back</button>}<button className="auth-primary" type="submit" disabled={busy}>{busy ? "Saving…" : step === 1 ? "Continue" : accountCreated ? "Open workspace" : "Create account"}<ArrowRight size={18} aria-hidden="true" /></button></div>
      </form>
      {step === 1 && <><div className="auth-divider"><span>or</span></div><button className="auth-google" type="button" onClick={google} disabled={busy}>Continue with Google</button></>}
      <p className="auth-account-link">Already have an account? <a href="/sign-in">Sign in</a></p>
    </AuthLayout>
  </>;
}
