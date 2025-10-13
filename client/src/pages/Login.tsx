"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
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
      params.get("returnUrl") || params.get("redirectAfterAuth") || params.get("redirect");

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

  const handlePostAuthNavigation = (options?: { fallbackToDashboard?: boolean }) => {
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
      await signInWithGoogle();
      toast({
        title: "Welcome to Blueprint",
        description: "You are signed in with Google.",
      });
      handlePostAuthNavigation();
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
        await signIn(values.email, values.password);
        toast({
          title: "Welcome back",
          description: "You are signed in.",
        });
        handlePostAuthNavigation({ fallbackToDashboard: true });
      } else {
        const signUpValues = values as SignUpValues;
        await signUp(signUpValues.email, signUpValues.password, signUpValues.name);
        toast({
          title: "Account created",
          description: "You are ready to explore Blueprint.",
        });
      handlePostAuthNavigation({ fallbackToDashboard: true });
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
    <div className="relative min-h-screen overflow-hidden bg-[#080F1E] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 -right-24 h-[50rem] w-[50rem] rounded-full bg-gradient-to-br from-emerald-500/15 via-cyan-500/15 to-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[45rem] w-[45rem] rounded-full bg-gradient-to-tr from-cyan-500/10 via-emerald-400/10 to-amber-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] bg-repeat opacity-[0.05]" />
      </div>

      <Nav />

      <main className="relative z-10 pb-20 pt-24 md:pt-28">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-emerald-100">
                <Sparkles className="h-4 w-4" />
                <span>Spatial experiences without the technical headache</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                  Access the Blueprint pilot
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-slate-300">
                  Sign in or create your account in one place. Blueprint helps local retail, museums, restaurants, and showrooms launch mixed-reality experiences in less than 24 hours.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: ShieldCheck,
                    title: "Enterprise-grade security",
                    copy: "SOC2-aligned processes built in.",
                  },
                  {
                    icon: Building2,
                    title: "Purpose-built for venues",
                    copy: "Tailored onboarding for physical spaces.",
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl"
                  >
                    <feature.icon className="mt-1 h-5 w-5 text-emerald-300" />
                    <div>
                      <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-slate-300">{feature.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Continue with Blueprint</h2>
                    <p className="text-sm text-slate-400">
                      Use Google or your work email to access your workspace.
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Pilot access
                  </div>
                </div>

                <div className="space-y-4">
                  <Button
                    onClick={handleGoogleAuth}
                    disabled={isGoogleSubmitting}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white text-slate-900 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed"
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

                  <div className="relative py-4 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span className="bg-slate-900/70 px-3">Or use your email</span>
                    <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-slate-800/80 p-1 text-sm">
                    {["signin", "signup"].map((value) => {
                      const currentMode = value as AuthMode;
                      const isActive = mode === currentMode;
                      return (
                        <button
                          key={currentMode}
                          type="button"
                          onClick={() => setMode(currentMode)}
                          className={`flex-1 rounded-full px-4 py-2 font-medium transition ${
                            isActive
                              ? "bg-white text-slate-900 shadow"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          {currentMode === "signin" ? "Sign in" : "Create account"}
                        </button>
                      );
                    })}
                  </div>

                  <Form {...(form as any)}>
                    <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                      {mode === "signup" && (
                        <FormField
                          control={form.control as any}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-slate-300">Full name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Jordan Williams"
                                  className="rounded-2xl border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
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
                            <FormLabel className="text-sm text-slate-300">Work email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <Input
                                  {...field}
                                  type="email"
                                  autoComplete="email"
                                  placeholder="you@company.com"
                                  className="pl-10 rounded-2xl border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
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
                            <FormLabel className="text-sm text-slate-300">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                                  placeholder="Enter your password"
                                  className="pl-10 pr-10 rounded-2xl border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((prev) => !prev)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                              <FormLabel className="text-sm text-slate-300">Confirm password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    type={showConfirmPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Re-enter your password"
                                    className="pr-10 rounded-2xl border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                        {mode === "signin" ? "Sign in" : "Create account"}
                      </Button>
                    </form>
                  </Form>

                  <p className="text-xs leading-relaxed text-slate-500">
                    By continuing you agree to Blueprint's Terms of Service and Privacy Policy. You'll receive onboarding updates and can unsubscribe at any time.
                  </p>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
