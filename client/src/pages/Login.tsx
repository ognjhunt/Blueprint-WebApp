"use client";

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const signInSchema = z.object({
  email: z.string().email({
    message: "Enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

const signUpSchema = signInSchema
  .extend({
    name: z.string().min(2, {
      message: "Name must be at least 2 characters.",
    }),
    confirmPassword: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

type AuthMode = "signin" | "signup";

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [hasExplicitRedirect, setHasExplicitRedirect] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const form = mode === "signin" ? signInForm : signUpForm;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawReturn =
      params.get("returnUrl") ||
      params.get("redirectAfterAuth") ||
      params.get("redirect");

    if (rawReturn) {
      const decoded = decodeURIComponent(rawReturn);
      setRedirectTarget(decoded);
      setHasExplicitRedirect(true);
      sessionStorage.setItem("redirectAfterAuth", decoded);
    } else {
      const stored = sessionStorage.getItem("redirectAfterAuth");
      if (stored) {
        setRedirectTarget(stored);
      }
    }
  }, []);

  useEffect(() => {
    form.clearErrors();
  }, [mode, form]);

  const navigateTo = (target: string) => {
    if (target.startsWith("http")) {
      window.location.href = target;
      return;
    }
    setLocation(target);
  };

  const handlePostAuthNavigation = (
    destination?: string,
    options?: { fallbackToDashboard?: boolean },
  ) => {
    if (destination) {
      return;
    }

    const stored = sessionStorage.getItem("redirectAfterAuth");
    if (stored) {
      sessionStorage.removeItem("redirectAfterAuth");
      navigateTo(stored);
      return;
    }

    if (redirectTarget && hasExplicitRedirect) {
      navigateTo(redirectTarget);
      return;
    }

    if (options?.fallbackToDashboard) {
      setLocation("/dashboard");
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleSubmitting(true);
    try {
      const destination = await signInWithGoogle();
      toast({
        title: "Welcome to Blueprint",
        description: "You are signed in with Google.",
      });
      handlePostAuthNavigation(destination);
    } catch (error: any) {
      toast({
        title: "Google sign-in failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const onSubmit = async (values: SignInValues | SignUpValues) => {
    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        const destination = await signIn(values.email, values.password);
        toast({
          title: "Welcome back",
          description: "You are signed in.",
        });
        handlePostAuthNavigation(destination, { fallbackToDashboard: true });
      } else {
        const signUpValues = values as SignUpValues;
        const destination = await signUp(
          signUpValues.email,
          signUpValues.password,
          signUpValues.name,
        );
        toast({
          title: "Account created",
          description: "You are ready to explore Blueprint.",
        });
        handlePostAuthNavigation(destination, { fallbackToDashboard: true });
      }
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const highlights = [
    "Claim open tasks directly from the queue.",
    "Track payouts and delivery expectations in one place.",
    "Keep venue briefs and file requirements aligned.",
  ];

  return (
    <div className="bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Blueprint access
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Sign in to claim tasks
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            Use your work email to manage scenes, track payout, and stay aligned with the queue.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Stay in sync with the portal
                  </h2>
                  <p className="text-sm text-slate-600">
                    Claim work, log progress, and deliver scenes without leaving the queue.
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-indigo-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-700">
                <Lock className="h-4 w-4" />
                <span className="font-semibold">Secure access</span>
              </div>
              <p className="mt-2">
                Blueprint uses workspace invitations and Google SSO. If you need access, reach out to your program lead or request an invite.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Workspace access
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Continue to Blueprint
                </h2>
                <p className="text-sm text-slate-600">
                  Use Google or your work email to sign in or create an account.
                </p>
              </div>

              <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                <User className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Button
                onClick={handleGoogleAuth}
                disabled={isGoogleSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed"
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
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
                )}
                <span className="text-sm font-semibold">Continue with Google</span>
              </Button>

              <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1 text-sm font-medium text-slate-700">
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
                          ? "bg-white text-slate-900 shadow"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <Form {...(form as any)}>
                <form
                  className="space-y-4"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  {mode === "signup" && (
                    <FormField
                      control={form.control as any}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-slate-700">
                            Full name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Jordan Williams"
                              className="rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control as any}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-slate-700">
                          Work email
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              {...field}
                              type="email"
                              autoComplete="email"
                              placeholder="you@company.com"
                              className="pl-10 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-slate-700">
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              autoComplete={
                                mode === "signin"
                                  ? "current-password"
                                  : "new-password"
                              }
                              placeholder="••••••••"
                              className="pl-10 pr-10 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {mode === "signup" && (
                    <FormField
                      control={form.control as any}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-slate-700">
                            Confirm password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                {...field}
                                type={showConfirmPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="pl-10 pr-10 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowConfirmPassword((prev) => !prev)
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
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
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold">
                      {mode === "signin" ? "Sign in" : "Create account"}
                    </span>
                  </Button>
                </form>
              </Form>

              <p className="text-center text-xs text-slate-500">
                By continuing you agree to the Blueprint Terms and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
