"use client";

import { useState } from "react";
import { SEO } from "@/components/SEO";
import { ArrowRight, Eye, EyeOff, Lock, Loader2, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ValidationErrors {
  email?: string;
  password?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) {
    return "Email is required";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) {
    return "Password is required";
  }
  return undefined;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const { signIn, signInWithGoogle } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    // Validate on blur
    validateField(name);
  };

  const validateField = (fieldName: string) => {
    const newErrors: ValidationErrors = { ...errors };

    switch (fieldName) {
      case "email":
        newErrors.email = validateEmail(formData.email);
        break;
      case "password":
        newErrors.password = validatePassword(formData.password);
        break;
    }

    setErrors(newErrors);
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Email validation
    newErrors.email = validateEmail(formData.email);

    // Password validation
    newErrors.password = validatePassword(formData.password);

    setErrors(newErrors);
    setTouched({ email: true, password: true });

    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      await signIn(formData.email, formData.password);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
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
      setAuthError(
        error instanceof Error
          ? error.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to access your Blueprint account, downloads, and purchased scene and dataset packs."
        canonical="/login"
      />
      <div className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              Blueprint
            </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue to Blueprint
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 488 512"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M488 261.8c0-17.4-1.5-34.1-4.3-50.2H249v95.1h134c-5.8 31-23.5 57.3-50.1 74.9l80.9 62.7c47.2-43.6 74.2-108 74.2-182.5Z"
              />
              <path
                fill="#34A853"
                d="M249 512c67.5 0 124.1-22.4 165.4-60.7l-80.9-62.7c-22.5 15.1-51.3 24-84.5 24-64.9 0-119.9-43.8-139.6-102.8l-83.2 64.5C67.4 455.6 150.8 512 249 512Z"
              />
              <path
                fill="#FBBC05"
                d="M109.4 310.8c-4.6-13.8-7.2-28.5-7.2-43.8s2.6-30 7.2-43.8l-83.2-64.5C9.1 194.5 0 225.2 0 267s9.1 72.5 26.2 108.2l83.2-64.4Z"
              />
              <path
                fill="#EA4335"
                d="M249 97.6c35.7 0 67.8 12.3 93.1 36.4l69.8-69.8C373 24.9 316.5 0 249 0 150.8 0 67.4 56.4 26.2 158.8l83.2 64.5C129.1 141.4 184.1 97.6 249 97.6Z"
              />
            </svg>
            <span className="text-sm font-semibold">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {authError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="you@example.com"
                  className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                    errors.email && touched.email
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
              </div>
              {errors.email && touched.email && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                    errors.password && touched.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && touched.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="text-right">
              <a
                href="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-semibold">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold">Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            By continuing, you agree to Blueprint's{" "}
            <a href="/terms" className="text-indigo-600 hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</a>.
          </p>
        </div>

        {/* Bottom Link */}
        <p className="mt-8 text-center text-sm text-slate-600">
          Don't have an account?{" "}
          <a
            href="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
    </>
  );
}
