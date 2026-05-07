"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Loader2, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceButton,
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
      <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-.9 2.2-2 3l3.2 2.5c1.9-1.7 3.1-4.2 3.1-7.2Z" fill="#fff" />
      <path d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.6 0-4.8-1.8-5.6-4.2l-3.4 2.6C4.6 19.6 8 22 12 22Z" fill="#d7d7d7" />
      <path d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3 7.6C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.4-2.6Z" fill="#8f8f8f" />
      <path d="M12 6c1.4 0 2.7.5 3.7 1.5l2.8-2.8C16.9 3.2 14.7 2 12 2 8 2 4.6 4.4 3 7.6l3.4 2.6C7.2 7.8 9.4 6 12 6Z" fill="#b8b8b8" />
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
              <div className="relative overflow-hidden bg-black text-white">
                <img
                  src={privateGeneratedAssets.signInReviewRoom}
                  alt="Blueprint review room"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.18),rgba(0,0,0,0.5)_64%,rgba(0,0,0,0.3))]" />
                <div className="relative flex h-full items-end p-8 lg:p-10">
                  <div className="max-w-[14rem] border border-white/15 bg-black/30 p-5 backdrop-blur">
                    <SurfaceMiniLabel className="text-white/50">Exact-site context</SurfaceMiniLabel>
                    <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">Better robot outcomes.</p>
                    <p className="mt-3 text-sm leading-7 text-white/70">
                      Our private platform is for verified buyers and field operators.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#fbf7f0] p-8 lg:p-10">
                <div className="mx-auto flex h-full max-w-[26rem] flex-col justify-center">
                  <div>
                    <h1 className="text-[3rem] font-semibold tracking-[-0.07em]">Sign In</h1>
                    <p className="mt-3 max-w-[18rem] text-sm leading-7 text-black/60">Access the Blueprint portal.</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-[1rem] border border-black/10 bg-white px-4 text-sm font-semibold text-[#111110] transition hover:bg-[#f3efe8] disabled:opacity-70"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.22em] text-black/30">
                    <div className="h-px flex-1 bg-black/10" />
                    <span>or</span>
                    <div className="h-px flex-1 bg-black/10" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {authError ? (
                      <div className="flex items-start gap-3 rounded-[1.2rem] border border-black/10 bg-white px-4 py-3 text-sm text-black/70">
                        <AlertCircle className="mt-0.5 h-4 w-4 text-black/55" />
                        <span>{authError}</span>
                      </div>
                    ) : null}

                    <label className="block space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50">Email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
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
                          className="h-12 w-full rounded-[1rem] border border-black/10 bg-white pl-11 pr-4 text-[15px] text-[#111110] outline-none transition placeholder:text-black/30 focus:border-black/30"
                        />
                      </div>
                      {errors.email && touched.email ? <p className="text-sm text-black/55">{errors.email}</p> : null}
                    </label>

                    <label className="block space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50">Password</span>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={formData.password}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          placeholder="Enter your password"
                          className="h-12 w-full rounded-[1rem] border border-black/10 bg-white pl-11 pr-12 text-[15px] text-[#111110] outline-none transition placeholder:text-black/30 focus:border-black/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && touched.password ? <p className="text-sm text-black/55">{errors.password}</p> : null}
                    </label>

                    <div className="flex justify-end">
                      <a href="/forgot-password" className="text-sm text-black/50 transition hover:text-black">
                        Forgot password?
                      </a>
                    </div>

                    <SurfaceButton type="submit" className="w-full gap-2">
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
                    </SurfaceButton>
                  </form>

                  <SurfaceDivider className="my-8" />

                  <div className="space-y-4">
                    <SurfaceMiniLabel>New to Blueprint?</SurfaceMiniLabel>
                    <div className="space-y-3 text-sm">
                      <a href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=login" className="flex items-center justify-between text-black/70 transition hover:text-black">
                        <span>Buyer: Scope your project</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a href="/signup/business" className="flex items-center justify-between text-black/70 transition hover:text-black">
                        <span>Buyer: Request access</span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a href="/capture-app" className="flex items-center justify-between text-black/70 transition hover:text-black">
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
