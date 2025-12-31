"use client";

import { useState } from "react";
import { SEO } from "@/components/SEO";
import { ArrowRight, Eye, EyeOff, Lock, Loader2, Mail, User } from "lucide-react";

type AuthMode = "signin" | "signup";

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO: Connect to AuthContext for actual authentication
    console.log("Form submitted:", { mode, ...formData });
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <>
      <SEO
        title={mode === "signin" ? "Sign In" : "Create Account"}
        description="Sign in or create an account to access Blueprint's SimReady environments, manage your projects, and track scene orders."
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
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "signin"
              ? "Sign in to continue to Blueprint"
              : "Get started with Blueprint today"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Google Button */}
          <button
            type="button"
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

          {/* Mode Toggle */}
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-slate-100 p-1 text-sm font-medium text-slate-700">
            {[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ].map(({ value, label }) => {
              const currentMode = value as AuthMode;
              const isActive = mode === currentMode;
              return (
                <button
                  key={currentMode}
                  type="button"
                  onClick={() => setMode(currentMode)}
                  className={`flex-1 rounded-md px-3 py-2 transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
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
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
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
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            </div>

            {mode === "signup" && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === "signin" && (
              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-semibold">
                    {mode === "signin" ? "Signing in..." : "Creating account..."}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold">
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            By continuing, you agree to Blueprint's Terms of Service and Privacy
            Policy.
          </p>
        </div>

        {/* Bottom Link */}
        <p className="mt-8 text-center text-sm text-slate-600">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
    </>
  );
}
