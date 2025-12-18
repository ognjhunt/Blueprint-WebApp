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

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="login-grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#login-grid-pattern)"
      />
    </svg>
  );
}

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

  return (
    <div className="relative min-h-[80vh] bg-white">
      <DotPattern />

      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-zinc-500">
              {mode === "signin"
                ? "Sign in to access your Blueprint workspace"
                : "Get started with Blueprint in minutes"}
            </p>
          </div>

          {/* Auth Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            {/* Google Button */}
            <Button
              onClick={handleGoogleAuth}
              disabled={isGoogleSubmitting}
              variant="outline"
              className="flex w-full items-center justify-center gap-3 rounded-xl border-zinc-200 bg-white py-5 text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed"
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
              <span className="text-sm font-medium">Continue with Google</span>
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-zinc-400">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="mb-6 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
              {(["signin", "signup"] as AuthMode[]).map((value) => {
                const isActive = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`flex-1 rounded-md px-4 py-2 font-medium transition ${
                      isActive
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {value === "signin" ? "Sign in" : "Sign up"}
                  </button>
                );
              })}
            </div>

            {/* Form */}
            <Form {...(form as any)}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                {mode === "signup" && (
                  <FormField
                    control={form.control as any}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-zinc-700">
                          Full name
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                              {...field}
                              placeholder="Jane Smith"
                              className="pl-10 rounded-lg border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400"
                            />
                          </div>
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
                      <FormLabel className="text-sm font-medium text-zinc-700">
                        Email address
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            {...field}
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="pl-10 rounded-lg border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400"
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
                      <FormLabel className="text-sm font-medium text-zinc-700">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            autoComplete={
                              mode === "signin"
                                ? "current-password"
                                : "new-password"
                            }
                            placeholder="Enter your password"
                            className="pl-10 pr-10 rounded-lg border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
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
                        <FormLabel className="text-sm font-medium text-zinc-700">
                          Confirm password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Re-enter your password"
                              className="pl-10 pr-10 rounded-lg border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword((prev) => !prev)
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                              aria-label={
                                showConfirmPassword
                                  ? "Hide password"
                                  : "Show password"
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
                  className="w-full rounded-lg bg-zinc-900 py-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {mode === "signin" ? "Sign in" : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* Footer Text */}
          <p className="text-center text-xs text-zinc-500">
            By continuing, you agree to Blueprint's{" "}
            <a href="/terms" className="underline hover:text-zinc-700">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-zinc-700">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
