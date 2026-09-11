"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { SEO } from "@/components/SEO";
import { MinimalAccountLayout } from "@/components/site/MinimalAccountLayout";
import { useAuth } from "@/contexts/AuthContext";

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
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24">
      <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-.9 2.2-2 3l3.2 2.5c1.9-1.7 3.1-4.2 3.1-7.2Z" fill="currentColor" />
      <path d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.6 0-4.8-1.8-5.6-4.2l-3.4 2.6C4.6 19.6 8 22 12 22Z" fill="currentColor" />
      <path d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3 7.6C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.4-2.6Z" fill="currentColor" />
      <path d="M12 6c1.4 0 2.7.5 3.7 1.5l2.8-2.8C16.9 3.2 14.7 2 12 2 8 2 4.6 4.4 3 7.6l3.4 2.6C7.2 7.8 9.4 6 12 6Z" fill="currentColor" />
    </svg>
  );
}

/** Every way into Blueprint that is not "I already have an account". */
const startPaths = [
  { href: "/signup/business?buyerType=robot_team&source=login", label: "Robot team: Create evaluation account" },
  { href: "/signup/business?buyerType=site_operator&source=login", label: "Site operator: Start site review" },
  {
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=login",
    label: "Robot team: Scope before signup",
  },
  { href: "/capture-app", label: "Capturer: Access the capture app" },
];

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
        title="Sign in | Blueprint"
        description="Sign in to Blueprint to follow your captures, task evaluation runs, and results."
        canonical="/sign-in"
        noIndex
      />

      <MinimalAccountLayout action={{ href: "/contact/site-operator", label: "Discuss your site" }}>
        <section className="ms-inquiry ms-auth ms-container">
          <div className="ms-inquiry-intro">
            <a className="ms-back" href="/">
              <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
            </a>
            <p className="ms-eyebrow">Account access</p>
            <h1>Sign in to Blueprint.</h1>
            <p className="ms-inquiry-description">
              Follow your captures, compare candidates on your task, and open the results that decide a pilot.
            </p>
            <p className="ms-inquiry-aside">
              Runs, evidence, and results stay scoped to your team. Nothing you upload is published across teams,
              and a result link is only shareable when you make it so.
            </p>
          </div>

          <div className="ms-auth-panel">
            <button
              type="button"
              className="ms-button-ghost"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <p className="ms-divider">or</p>

            <form className="ms-form" onSubmit={handleSubmit} aria-label="Sign in" aria-busy={isLoading}>
              {authError ? (
                <p className="ms-notice" role="alert">
                  <AlertCircle size={17} aria-hidden="true" />
                  {authError}
                </p>
              ) : null}

              <label>
                Email
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
                />
                {errors.email && touched.email ? <span className="ms-error">{errors.email}</span> : null}
              </label>

              <label>
                Password
                <span className="ms-field-control">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="ms-field-reveal"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </span>
                {errors.password && touched.password ? <span className="ms-error">{errors.password}</span> : null}
              </label>

              <div className="ms-form-foot">
                <span />
                <a href="/forgot-password">Forgot password?</a>
              </div>

              <button className="ms-button" type="submit" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign in"}
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </form>

            <div className="ms-auth-alt">
              <p>New to Blueprint?</p>
              <div className="ms-link-list">
                {startPaths.map((path) => (
                  <a key={path.href} href={path.href}>
                    <span>{path.label}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </MinimalAccountLayout>
    </>
  );
}
