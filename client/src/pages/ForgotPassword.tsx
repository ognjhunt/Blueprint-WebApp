"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { MinimalAccountLayout } from "@/components/site/MinimalAccountLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const { auth, sendPasswordResetEmail } = await import("@/lib/firebase");
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Use the same response for all outcomes to avoid account enumeration.
    } finally {
      setIsSubmitted(true);
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Reset password | Blueprint"
        description="Reset your Blueprint account password. Enter your email to receive a password reset link."
        canonical="/forgot-password"
        noIndex
      />

      <MinimalAccountLayout action={{ href: "/sign-in", label: "Sign in" }}>
        <section className="ms-inquiry ms-auth ms-container">
          <div className="ms-inquiry-intro">
            <a className="ms-back" href="/sign-in">
              <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
            </a>
            <p className="ms-eyebrow">Account access</p>
            <h1>Reset your password.</h1>
            <p className="ms-inquiry-description">
              Enter the email on your account and we&apos;ll send a reset link.
            </p>
            <p className="ms-inquiry-aside">
              This screen answers the same way whether or not an account exists, so it never reveals who has one.
              If nothing arrives, check the address and try again, or email hello@tryblueprint.io.
            </p>
          </div>

          {isSubmitted ? (
            <div className="ms-success" role="status" aria-live="polite">
              <Check size={30} aria-hidden="true" />
              <h2>Check your email</h2>
              <p>
                If an account exists for <strong>{email}</strong>, the reset link is now in that inbox.
              </p>
              <a className="ms-text-link" href="/sign-in">
                Return to sign in <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <form className="ms-form" onSubmit={handleSubmit} aria-label="Reset password" aria-busy={isLoading}>
              <label>
                Email
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={isLoading}
                  maxLength={254}
                />
              </label>

              <button className="ms-button" type="submit" disabled={isLoading}>
                {isLoading ? "Sending…" : "Send reset link"}
                <ArrowRight size={20} aria-hidden="true" />
              </button>

              <p className="ms-form-note">
                Read our <a href="/privacy">privacy policy</a> for how we handle your information.
              </p>
            </form>
          )}
        </section>
      </MinimalAccountLayout>
    </>
  );
}
