"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

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
import { ToastAction } from "@/components/ui/toast";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const { toast } = useToast();
  const { signIn, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();

  // Animation for the glow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlowing((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await signIn(values.email, values.password);

      // Check if there's a return URL
      const searchParams = new URLSearchParams(window.location.search);
      const returnUrl = searchParams.get("returnUrl");

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });

      // Redirect to return URL if it exists, otherwise to dashboard
      if (returnUrl) {
        window.location.href = decodeURIComponent(returnUrl);
      } else {
        setLocation("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Welcome back!",
        description: "You've signed in with Google.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        toast({
          title: "No account found",
          description:
            "No account with that email address. If you have not signed up, then please join the pilot program.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Join Pilot Program"
              onClick={() => (window.location.href = "/#contactForm")}
            >
              Join Pilot Program
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: "Authentication failed",
          description: error?.message || "Failed to sign in with Google.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-blue-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 z-[-2] opacity-70">
        <motion.div
          className="absolute w-[70vw] h-[70vw] rounded-full bg-gradient-to-r from-violet-300/30 to-fuchsia-300/30 blur-3xl"
          style={{ top: "-35vw", right: "-20vw" }}
          animate={{
            y: [0, 10, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute w-[50vw] h-[50vw] rounded-full bg-gradient-to-r from-blue-300/20 to-cyan-300/20 blur-3xl"
          style={{ bottom: "-20vw", left: "-10vw" }}
          animate={{
            y: [0, -15, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1,
          }}
        />
      </div>

      {/* Subtle grid pattern overlay */}
      <motion.div className="fixed inset-0 z-[-1] opacity-[0.07] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

      <Nav />

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="backdrop-blur-lg bg-white/70 border border-white/50 rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.2,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    className={`inline-block p-3 rounded-full bg-gradient-to-tr from-blue-600/80 to-indigo-600/80 mb-4 ${isGlowing ? "shadow-lg shadow-blue-500/20" : ""}`}
                    animate={{
                      boxShadow: isGlowing
                        ? "0 0 20px 2px rgba(79, 70, 229, 0.4)"
                        : "0 0 0px 0px rgba(79, 70, 229, 0)",
                    }}
                    transition={{ duration: 1.5 }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 21L5 14H7V10H17V14H19L12 21Z" fill="white" />
                      <path
                        d="M12 3L19 10H17V14H7V10H5L12 3Z"
                        fill="white"
                        fillOpacity="0.4"
                      />
                    </svg>
                  </motion.div>
                  <h1 className="text-3xl font-bold text-indigo-900">
                    Welcome back
                  </h1>
                  <p className="text-indigo-600 mt-2">
                    Sign in to access your Blueprint dashboard
                  </p>
                </div>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-5"
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-indigo-900">
                            Email
                          </FormLabel>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-indigo-500" />
                            <FormControl>
                              <Input
                                placeholder="your@email.com"
                                className="pl-10 h-12 bg-white/60 border-indigo-200 text-indigo-900 placeholder:text-indigo-400/60 focus:border-indigo-400 focus:ring focus:ring-indigo-400/20 rounded-lg"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel className="text-indigo-900">
                              Password
                            </FormLabel>
                            <a
                              href="#"
                              className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              Forgot password?
                            </a>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-indigo-500" />
                            <FormControl>
                              <Input
                                type="password"
                                className="pl-10 h-12 bg-white/60 border-indigo-200 text-indigo-900 focus:border-indigo-400 focus:ring focus:ring-indigo-400/20 rounded-lg"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-12 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/40"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="mt-8 flex items-center gap-3">
                  <div className="h-px bg-indigo-200/50 flex-grow"></div>
                  <span className="text-sm text-indigo-600">
                    or continue with
                  </span>
                  <div className="h-px bg-indigo-200/50 flex-grow"></div>
                </div>

                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <Button
                    onClick={handleGoogleSignIn}
                    className="w-full h-12 rounded-lg bg-white text-black flex items-center justify-center gap-2 hover:bg-gray-100"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : null}
                    <span>Continue with Google</span>
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
