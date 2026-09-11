import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { auth, sendPasswordResetEmail } = await import("@/lib/firebase");
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Keep the same response for every outcome to avoid account enumeration.
    } finally { setIsSubmitted(true); setIsLoading(false); }
  }

  return <AuthLayout>
    <SEO title="Reset password | Blueprint" description="Request a password reset link for your Blueprint account." canonical="/forgot-password" noIndex />
    {isSubmitted ? <div role="status"><h1>Check your email</h1><p className="auth-description">If an account exists for <strong>{email}</strong>, you’ll receive a password reset link.</p><a className="auth-primary auth-reset-return" href="/sign-in">Return to sign in<ArrowRight size={18} aria-hidden="true" /></a></div> : <>
      <h1>Reset your password</h1><p className="auth-description">Enter your email to request a reset link.</p>
      <form method="post" className="auth-form auth-reset-form" onSubmit={handleSubmit} aria-label="Reset password" aria-busy={isLoading}>
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required disabled={isLoading} /></div>
        <button type="submit" className="auth-primary" disabled={isLoading}>{isLoading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Sending…</> : <>Send reset link<ArrowRight size={18} aria-hidden="true" /></>}</button>
      </form><a className="auth-back" href="/sign-in"><ArrowLeft size={16} aria-hidden="true" />Back to sign in</a>
    </>}
  </AuthLayout>;
}
