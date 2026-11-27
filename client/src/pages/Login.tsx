"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { authReturnPath } from "@/lib/authReturnPath";
import { friendlyAuthError } from "@/lib/siteClaim";
import { withCsrfHeader } from "@/lib/csrf";
import { readSignInLinkFromAddress, SIGN_IN_LINK_ENDED, signInWithCompanyLink, stripSignInLinkFromAddress } from "@/lib/companySignInLink";
import { Helmet } from "@/lib/helmet";

interface ValidationErrors {
  email?: string;
  password?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "Enter your email.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Enter a valid email address.";
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Enter your password.";
  return undefined;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-.9 2.2-2 3l3.2 2.5c1.9-1.7 3.1-4.2 3.1-7.2Z" fill="currentColor" />
      <path d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.6 0-4.8-1.8-5.6-4.2l-3.4 2.6C4.6 19.6 8 22 12 22Z" fill="currentColor" />
      <path d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3 7.6C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.4-2.6Z" fill="currentColor" />
      <path d="M12 6c1.4 0 2.7.5 3.7 1.5l2.8-2.8C16.9 3.2 14.7 2 12 2 8 2 4.6 4.4 3 7.6l3.4 2.6C7.2 7.8 9.4 6 12 6Z" fill="currentColor" />
    </svg>
  );
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const redirectChecked = useRef(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  // A deployment company's emailed sign-in link, read once and kept until the company presses to spend it.
  const [pendingLink, setPendingLink] = useState<string | null>(readSignInLinkFromAddress);
  const { signIn, signInWithGoogle, completeGoogleRedirect, prepareGoogleSignIn, currentUser, loading: authLoading } = useAuth();
  const browserLocation = typeof window === "undefined" ? null : window.location;
  const returnPath = authReturnPath(new URLSearchParams(browserLocation?.search || "").get("next"));
  const isCompanyJob = returnPath?.startsWith("/jobs/") || returnPath?.startsWith("/contact/robot-team");
  const returnLink = returnPath && browserLocation
    ? new URL(returnPath, browserLocation.origin).href
    : browserLocation?.href || "";

  // A company already signed in that follows an emailed "Find jobs" link (`/sign-in?next=/contact/robot-team`) goes
  // straight there; a form for an account already signed in would mislead.
  useEffect(() => {
    if (!authLoading && currentUser && isCompanyJob && returnPath && !pendingLink) window.location.replace(returnPath);
  }, [authLoading, currentUser, isCompanyJob, returnPath, pendingLink]);

  useEffect(() => {
    if (returnPath) {
      try {
        sessionStorage.setItem("redirectAfterAuth", returnPath);
      } catch {
        // Sign-in still works when this browser disables session storage.
      }
    }
  }, [returnPath]);

  // A deployment company's emailed sign-in link (`companySignInLink.ts`): it leaves the address bar at once, and is
  // spent only when the company presses "Sign in with this link" (outreach gap 1, 2026-11-27). A mail scanner that loads
  // the page and runs its scripts spends nothing, so the company's own open still works.
  useEffect(() => { stripSignInLinkFromAddress(); }, []);

  const spendSignInLink = async () => {
    if (!pendingLink || isLoading) return;
    const link = pendingLink;
    setIsLoading(true);
    setAuthError(null);
    try {
      const returnTo = await signInWithCompanyLink(link);
      // A job the company was opening in this tab comes first; the emailed link's own destination otherwise.
      let saved: string | null = null;
      try { saved = sessionStorage.getItem("redirectAfterAuth"); sessionStorage.removeItem("redirectAfterAuth"); } catch { saved = null; }
      // Replaced, as every sign-in is (`navigateAfterAuth`): Back never returns to this sign-in page once signed in.
      window.location.replace(authReturnPath(saved) ?? authReturnPath(returnTo) ?? "/contact/robot-team");
    } catch (error) {
      setPendingLink(null);
      setAuthError(error instanceof Error ? error.message : SIGN_IN_LINK_ENDED);
      setIsLoading(false);
    }
  };

  const requestSignInLink = async () => {
    const emailError = validateEmail(formData.email);
    setErrors((current) => ({ ...current, email: emailError, password: undefined }));
    setTouched((current) => ({ ...current, email: true }));
    if (isLoading || emailError) return;
    setIsLoading(true);
    setAuthError(null);
    setLinkStatus(null);
    try {
      const response = await fetch("/api/robot-team-access/sign-in-link", { method: "POST", credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }), body: JSON.stringify({ email: formData.email.trim() }) });
      const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "The link could not be sent. Try again.");
      setLinkStatus(data.message || null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "The link could not be sent. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (redirectChecked.current) return;
    redirectChecked.current = true;
    let redirectPending = false;
    try {
      redirectPending = sessionStorage.getItem("googleRedirectPending") === "1";
    } catch {
      // The auth context will report a storage error if redirect recovery needs it.
    }
    if (redirectPending) setIsLoading(true);
    void completeGoogleRedirect().catch((error: unknown) => {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
      setAuthErrorCode((error as { code?: string } | null)?.code || null);
    }).finally(() => {
      if (redirectPending) setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void prepareGoogleSignIn().then(() => {
      if (active) setGoogleReady(true);
    }).catch(() => {
      if (active) setAuthError("Google sign-in is unavailable. Please sign in with email and password.");
    });
    return () => { active = false; };
  }, [prepareGoogleSignIn]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (errors[name as keyof ValidationErrors]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
    const nextErrors: ValidationErrors = { ...errors };
    if (name === "email") nextErrors.email = validateEmail(formData.email);
    if (name === "password") nextErrors.password = validatePassword(formData.password);
    setErrors(nextErrors);
  };

  const validateForm = () => {
    const nextErrors: ValidationErrors = {
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
    };
    setErrors(nextErrors);
    setTouched({ email: true, password: true });
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || !validateForm()) return;
    setIsLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      await signIn(formData.email, formData.password);
    } catch (error) {
      // The account layer has already put credential, network and account errors into words; anything still raw gets
      // the fallback.
      setAuthError(friendlyAuthError(error, "We could not sign you in. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading || !googleReady) return;
    setIsLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
      setAuthErrorCode((error as { code?: string } | null)?.code || null);
    } finally {
      setIsLoading(false);
    }
  };

  const copyReturnLink = async () => {
    try {
      await navigator.clipboard.writeText(returnLink);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
      setAuthError("Copying was blocked here. Select the link below and copy it manually.");
    }
  };

  return (
    <AuthLayout>
      <SEO title="Sign in | Blueprint" description="Sign in to your Blueprint account." canonical="/sign-in" noIndex />
      <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
      <h1>Sign in</h1>
      {pendingLink && <div className="auth-form">
        <p className="auth-account-link">You opened a sign-in link from your email. It works once.</p>
        <button type="button" className="auth-primary" onClick={() => void spendSignInLink()} disabled={isLoading}>{isLoading
          ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Signing in…</>
          : <>Sign in with this link<ArrowRight size={18} aria-hidden="true" /></>}</button>
      </div>}
      <button type="button" className="auth-google" onClick={handleGoogleSignIn} disabled={isLoading || !googleReady}><GoogleMark />Continue with Google</button>
      <div className="auth-divider"><span>or</span></div>
      <form method="post" onSubmit={handleSubmit} className="auth-form" noValidate aria-label="Sign in" aria-busy={isLoading}>
        {authError && <p className="auth-error" role="alert">{authError}</p>}
        {authErrorCode === "auth/popup-blocked" && (
          <div className="auth-browser-handoff">
            <p>Copy this link and open it in Safari or Chrome, then sign in there.</p>
            <button type="button" onClick={copyReturnLink}>{linkCopied ? "Link copied" : "Copy link"}</button>
            <input aria-label="Link to open in Safari or Chrome" readOnly value={returnLink} onFocus={(event) => event.currentTarget.select()} />
          </div>
        )}
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={formData.email} onChange={handleInputChange} onBlur={handleBlur} placeholder="you@company.com" disabled={isLoading} aria-invalid={Boolean(errors.email && touched.email)} aria-describedby={errors.email && touched.email ? "email-error" : undefined} />{errors.email && touched.email && <p id="email-error" className="auth-field-error">{errors.email}</p>}</div>
        <div><label htmlFor="password">Password</label><div className="auth-password"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={formData.password} onChange={handleInputChange} onBlur={handleBlur} disabled={isLoading} aria-invalid={Boolean(errors.password && touched.password)} aria-describedby={errors.password && touched.password ? "password-error" : undefined} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{errors.password && touched.password && <p id="password-error" className="auth-field-error">{errors.password}</p>}</div>
        <a className="auth-forgot" href="/forgot-password">Forgot password?</a>
        <button type="submit" className="auth-primary" disabled={isLoading}>{isLoading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Signing in…</> : <>Sign in<ArrowRight size={18} aria-hidden="true" /></>}</button>
      </form>
      {/* Deployment companies sign in without a password: the link goes only to an approved company's address. */}
      <div className="auth-form">
        <p className="auth-account-link">Deployment company? Enter your email above.</p>
        <button type="button" className="auth-google" onClick={() => void requestSignInLink()} disabled={isLoading}>Email me a sign-in link</button>
        {linkStatus && <p role="status" className="auth-account-link">{linkStatus}</p>}
      </div>
      {isCompanyJob
        ? <p className="auth-account-link">New deployment company? <a href="/jobs#partner-application">Apply to see jobs</a></p>
        : <>
          <p className="auth-account-link">New to Blueprint? <a href="/contact/site-operator?source=sign-in">Start a job</a></p>
          <p className="auth-account-link">Lost your job link? Email <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a> from the address you used.</p>
        </>}
    </AuthLayout>
  );
}
