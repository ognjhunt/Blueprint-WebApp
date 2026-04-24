"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceButton,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { auth, sendPasswordResetEmail } from "@/lib/firebase";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
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
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.2))]" />
              </div>

              <div className="flex items-center bg-[#fbf7f0] p-8 lg:p-10">
                <div className="mx-auto grid w-full max-w-[38rem] gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <div className="rounded-[1.6rem] border border-black/10 bg-white p-6">
                    <SurfaceMiniLabel>Reset your password</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      Enter your email and we&apos;ll send you a secure reset link.
                    </p>

                    {!isSubmitted ? (
                      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <label className="block space-y-2">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">Email</span>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                            <input
                              id="email"
                              name="email"
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder="you@company.com"
                              required
                              disabled={isLoading}
                              className="h-12 w-full rounded-[1rem] border border-black/10 bg-white pl-11 pr-4 text-[15px] text-[#111110] outline-none transition placeholder:text-black/35 focus:border-black/30"
                            />
                          </div>
                        </label>

                        <SurfaceButton type="submit" className="w-full gap-2">
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
                        </SurfaceButton>

                        <a href="/sign-in" className="inline-flex items-center gap-2 text-sm text-black/55 transition hover:text-black">
                          <ArrowLeft className="h-4 w-4" />
                          Back to sign in
                        </a>
                      </form>
                    ) : (
                      <div className="mt-6 space-y-4">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f6f1e7]">
                          <CheckCircle className="h-6 w-6 text-black/70" />
                        </div>
                        <p className="text-sm leading-7 text-black/60">
                          If an account exists for <span className="font-semibold text-black">{email}</span>,
                          we&apos;ve sent a reset link.
                        </p>
                        <SurfaceButton href="/sign-in" tone="secondary" className="w-full">
                          Return to sign in
                        </SurfaceButton>
                      </div>
                    )}
                  </div>

                  <div className="hidden justify-center lg:flex">
                    <ArrowRight className="h-5 w-5 text-black/30" />
                  </div>

                  <div className="rounded-[1.6rem] border border-black/10 bg-white p-6">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-[#faf6ee]">
                      <CheckCircle className="h-7 w-7 text-black/70" />
                    </div>
                    <p className="mt-6 text-[2rem] font-semibold tracking-[-0.06em]">
                      {isSubmitted ? "Check your email" : "Private reset flow"}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-black/60">
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
