"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AuthLayout } from "@/components/auth/AuthLayout";
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
    if (isLoading || !validateForm()) return;
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
    if (isLoading) return;
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
    <AuthLayout>
      <SEO title="Sign in | Blueprint" description="Sign in to your Blueprint account." canonical="/sign-in" noIndex />
      <h1>Sign in</h1>
      <p className="auth-description">Welcome back to Blueprint.</p>
      <button type="button" className="auth-google" onClick={handleGoogleSignIn} disabled={isLoading}><GoogleMark />Continue with Google</button>
      <div className="auth-divider"><span>or</span></div>
      <form method="post" onSubmit={handleSubmit} className="auth-form" noValidate aria-label="Sign in" aria-busy={isLoading}>
        {authError && <p className="auth-error" role="alert">{authError}</p>}
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={formData.email} onChange={handleInputChange} onBlur={handleBlur} placeholder="you@company.com" disabled={isLoading} aria-invalid={Boolean(errors.email && touched.email)} aria-describedby={errors.email && touched.email ? "email-error" : undefined} />{errors.email && touched.email && <p id="email-error" className="auth-field-error">{errors.email}</p>}</div>
        <div><label htmlFor="password">Password</label><div className="auth-password"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={formData.password} onChange={handleInputChange} onBlur={handleBlur} disabled={isLoading} aria-invalid={Boolean(errors.password && touched.password)} aria-describedby={errors.password && touched.password ? "password-error" : undefined} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{errors.password && touched.password && <p id="password-error" className="auth-field-error">{errors.password}</p>}</div>
        <a className="auth-forgot" href="/forgot-password">Forgot password?</a>
        <button type="submit" className="auth-primary" disabled={isLoading}>{isLoading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Signing in…</> : <>Sign in<ArrowRight size={18} aria-hidden="true" /></>}</button>
      </form>
      <p className="auth-account-link">New to Blueprint? <a href="/signup/business">Create an account</a></p>
      <a className="auth-utility" href="/capture-app">Capture app access</a>
    </AuthLayout>
  );
}
