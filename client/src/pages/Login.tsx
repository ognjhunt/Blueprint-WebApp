"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Loader2, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceDivider,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { useAuth } from "@/contexts/AuthContext";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

interface ValidationErrors {
  email?: string;
  password?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "Email is required";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Please enter a valid email address";
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
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
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({ email: "", password: "" });
  const { signIn, signInWithGoogle } = useAuth();

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
    if (!validateForm()) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      await signIn(formData.email, formData.password);
    } catch {
      setAuthError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to the Blueprint web portal for robot teams and site operators."
        canonical="/sign-in"
        noIndex
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Access Control Suite" rightLabel="Secure Access Portal" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid min-h-[46rem] xl:grid-cols-[0.54fr_0.46fr]">
              <div className="relative overflow-hidden bg-runway-black text-runway-text">
                <img
                  src={privateGeneratedAssets.signInReviewRoom}
                  alt="Blueprint review room"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.18),rgba(0,0,0,0.5)_64%,rgba(0,0,0,0.3))]" />
                <div className="relative flex h-full items-end p-8 lg:p-10">
                  <div className="max-w-[14rem] border border-runway-line bg-runway-black/70 p-5 backdrop-blur">
                    <SurfaceMiniLabel className="text-runway-faint">Exact-site context</SurfaceMiniLabel>
                    <p className="mt-3 text-xl font-semibold text-runway-text">The evaluation, done before the robot arrives.</p>
                    <p className="mt-3 text-sm leading-7 text-runway-mute">
                      Review captured workflows, controlled evaluations, access rights, and onsite handoffs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-runway-deep p-8 lg:p-10">
                <div className="mx-auto flex h-full max-w-[26rem] flex-col justify-center">
                  <div>
                    <h1 className="font-display uppercase text-[3rem] font-semibold tracking-[0.005em] text-runway-text">Sign In</h1>
                    <p className="mt-3 max-w-[18rem] text-sm leading-7 text-runway-mute">Access the Blueprint portal.</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="runway-cta-ghost mt-8 w-full disabled:opacity-70"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-4 runway-meta">
                    <div className="h-px flex-1 bg-runway-line" />
                    <span>or</span>
                    <div className="h-px flex-1 bg-runway-line" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {authError ? (
                      <div className="flex items-start gap-3 border border-runway-red-dim bg-runway-panel px-4 py-3 text-sm text-runway-red">
                        <AlertCircle className="mt-0.5 h-4 w-4 text-runway-red" />
                        <span>{authError}</span>
                      </div>
                    ) : null}

                    <label className="block">
                      <span className="runway-label">Email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          inputMode="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          placeholder="you@company.com"
                          className="runway-input h-12 pl-11 pr-4"
                        />
                      </div>
                      {errors.email && touched.email ? <p className="mt-2 text-sm text-runway-red">{errors.email}</p> : null}
                    </label>

                    <label className="block">
                      <span className="runway-label">Password</span>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={formData.password}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          placeholder="Enter your password"
                          className="runway-input h-12 pl-11 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-runway-mute transition hover:text-runway-text"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && touched.password ? <p className="mt-2 text-sm text-runway-red">{errors.password}</p> : null}
                    </label>

                    <div className="flex justify-end">
                      <a href="/forgot-password" className="text-sm text-runway-mute transition hover:text-runway-text">
                        Forgot password?
                      </a>
                    </div>

                    <button type="submit" className="runway-cta w-full gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <SurfaceDivider className="my-8 bg-runway-line" />

                  <div className="space-y-4">
                    <SurfaceMiniLabel className="text-runway-faint">New to Blueprint?</SurfaceMiniLabel>
                    <div className="space-y-3 text-sm">
                      <a href="/signup/business?buyerType=robot_team&source=login" className="flex items-center justify-between text-runway-body transition hover:text-runway-text">
                        <span>Robot team: Create evaluation account</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a href="/signup/business?buyerType=site_operator&source=login" className="flex items-center justify-between text-runway-body transition hover:text-runway-text">
                        <span>Site operator: Start site review</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=login" className="flex items-center justify-between text-runway-body transition hover:text-runway-text">
                        <span>Robot team: Scope before signup</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a href="/capture-app" className="flex items-center justify-between text-runway-body transition hover:text-runway-text">
                        <span>Capturer: Access the capture app</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
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
