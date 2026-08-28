"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

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
        title="Reset Password"
        description="Reset your Blueprint account password. Enter your email to receive a password reset link."
        canonical="/forgot-password"
        noIndex
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Secure Access Recovery" rightLabel="Private Reset Flow" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid min-h-[38rem] xl:grid-cols-[0.48fr_0.52fr]">
              <div className="relative overflow-hidden">
                <img
                  src={privateGeneratedAssets.forgotPasswordDossier}
                  alt="Blueprint dossier sheet"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,15,14,0.32),rgba(12,15,14,0.78))]" />
              </div>

              <div className="flex items-center bg-runway-deep p-8 lg:p-10">
                <div className="mx-auto grid w-full max-w-[38rem] gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <div className="runway-panel p-6">
                    <SurfaceMiniLabel className="text-runway-faint">Reset your password</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-runway-mute">
                      Enter your email and we&apos;ll send you a secure reset link.
                    </p>

                    {!isSubmitted ? (
                      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <label className="block">
                          <span className="runway-label">Email</span>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                            <input
                              id="email"
                              name="email"
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder="you@company.com"
                              required
                              disabled={isLoading}
                              className="runway-input h-12 pl-11 pr-4"
                            />
                          </div>
                        </label>

                        <button type="submit" className="runway-cta w-full gap-2">
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending
                            </>
                          ) : (
                            <>
                              Send reset link
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>

                        <a href="/sign-in" className="inline-flex items-center gap-2 text-sm text-runway-mute transition hover:text-runway-text">
                          <ArrowLeft className="h-4 w-4" />
                          Back to sign in
                        </a>
                      </form>
                    ) : (
                      <div className="mt-6 space-y-4">
                        <div className="inline-flex h-12 w-12 items-center justify-center border border-runway-green-dim bg-runway-raised">
                          <CheckCircle className="h-6 w-6 text-runway-green" />
                        </div>
                        <p className="text-sm leading-7 text-runway-mute">
                          If an account exists for <span className="font-semibold text-runway-text">{email}</span>,
                          we&apos;ve sent a reset link.
                        </p>
                        <a href="/sign-in" className="runway-cta-ghost w-full">
                          Return to sign in
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="hidden justify-center lg:flex">
                    <ArrowRight className="h-5 w-5 text-runway-faint" />
                  </div>

                  <div className="runway-panel p-6">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center border border-runway-line-strong bg-runway-raised">
                      <CheckCircle className="h-7 w-7 text-runway-mute" />
                    </div>
                    <p className="mt-6 font-display uppercase text-[2rem] font-semibold tracking-[0.005em] text-runway-text">
                      {isSubmitted ? "Check your email" : "Private reset flow"}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-runway-mute">
                      {isSubmitted
                        ? "If an account exists, the next step is now in your inbox."
                        : "We use the same response for all requests so account state is never exposed on this screen."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
