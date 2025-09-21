"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  MapPin,
  CalendarCheck,
  Shield,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);
  const { toast } = useToast();
  const { signIn, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();

  // Soft ambient pulse for the hero badge
  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlowing((prev) => !prev);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await signIn(values.email, values.password);

      const searchParams = new URLSearchParams(window.location.search);
      const returnUrl = searchParams.get("returnUrl");

      toast({
        title: "Welcome back!",
        description: "You’ve successfully signed in.",
      });

      if (returnUrl) {
        window.location.href = decodeURIComponent(returnUrl);
      } else {
        setLocation("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setUserNotFound(false);
    try {
      await signInWithGoogle();
      toast({
        title: "Welcome back!",
        description: "You’ve signed in with Google.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setUserNotFound(true);
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
    <div className="min-h-screen relative overflow-hidden bg-[#0B1220] text-slate-100">
      {/* Brand glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-24 h-[45rem] w-[45rem] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-sky-500/10" />
        <div className="absolute -bottom-32 -left-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-amber-400/10" />
      </div>

      {/* Subtle grid overlay */}
      <div className="fixed inset-0 -z-10 opacity-[0.06] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

      <Nav />

      <main className="relative z-10 pt-20 md:pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-stretch">
            {/* LEFT: Persuasive panel */}
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <div className="max-w-xl">
                <motion.div
                  animate={{
                    boxShadow: isGlowing
                      ? "0 0 40px 2px rgba(16, 185, 129, 0.25)"
                      : "0 0 0px 0px rgba(16, 185, 129, 0)",
                  }}
                  transition={{ duration: 1.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 mb-5"
                >
                  <MapPin className="w-4 h-4" />
                  Durham/Triangle Pilot — Live in 24 hours
                </motion.div>

                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                  Sign in to{" "}
                  <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-200 bg-clip-text text-transparent">
                    Blueprint
                  </span>
                </h1>
                <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-8">
                  For local retail, museums, restaurants, and showrooms within
                  ~30 minutes of Durham. Access your pilot, manage AR
                  experiences, and see analytics—without the technical headache.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
                  {[
                    {
                      icon: CalendarCheck,
                      title: "Launch in under 24 hours",
                      copy: "Mapping + activation within a day.",
                    },
                    {
                      icon: Shield,
                      title: "Zero risk",
                      copy: "No credit card required.",
                    },
                    {
                      icon: Sparkles,
                      title: "AR that sells",
                      copy: "Delight customers on site.",
                    },
                    {
                      icon: Building2,
                      title: "Built for venues",
                      copy: "Retail, museums, restaurants, real estate.",
                    },
                  ].map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                        <f.icon className="w-4.5 h-4.5 text-emerald-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {f.title}
                        </p>
                        <p className="text-xs text-slate-300">{f.copy}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/pilot-program"
                    className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors underline underline-offset-4"
                  >
                    Need an invite? Join the pilot waitlist →
                  </a>
                  <span className="text-slate-600">•</span>
                  <a
                    href="mailto:nijel@tryblueprint.io"
                    className="text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    Questions? Email our team
                  </a>
                </div>
              </div>
            </motion.section>

            {/* RIGHT: Sign-in card */}
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="order-1 lg:order-2"
              aria-label="Sign in form"
            >
              <div className="relative">
                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/30 via-cyan-500/30 to-emerald-400/30 blur-md opacity-60" />
                <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <div className="px-6 py-7 sm:px-8 sm:py-9">
                    {/* Mini brand mark */}
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-tr from-emerald-500/30 to-cyan-500/30">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 21L5 14H7V10H17V14H19L12 21Z"
                            fill="white"
                          />
                          <path
                            d="M12 3L19 10H17V14H7V10H5L12 3Z"
                            fill="white"
                            opacity="0.35"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">
                          Blueprint Portal
                        </p>
                        <h2 className="text-lg font-bold text-white">
                          Sign in to continue
                        </h2>
                      </div>
                    </div>

                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-5"
                      >
                        {/* Email */}
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-200">
                                Work email
                              </FormLabel>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-emerald-300/70" />
                                <FormControl>
                                  <Input
                                    placeholder="you@business.com"
                                    className="pl-10 h-12 rounded-lg bg-white/5 border-white/10 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400/50"
                                    autoComplete="email"
                                    inputMode="email"
                                    {...field}
                                  />
                                </FormControl>
                              </div>
                              <FormMessage className="text-red-400 text-xs" />
                            </FormItem>
                          )}
                        />

                        {/* Password */}
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-slate-200">
                                  Password
                                </FormLabel>
                                <a
                                  href="/forgot-password"
                                  className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                                >
                                  Forgot password?
                                </a>
                              </div>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-emerald-300/70" />
                                <FormControl>
                                  <Input
                                    type={showPassword ? "text" : "password"}
                                    className="pl-10 pr-10 h-12 rounded-lg bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400/50"
                                    autoComplete="current-password"
                                    {...field}
                                  />
                                </FormControl>
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((s) => !s)}
                                  className="absolute right-3 top-3.5 text-slate-300/70 hover:text-white transition-colors"
                                  aria-label={
                                    showPassword
                                      ? "Hide password"
                                      : "Show password"
                                  }
                                >
                                  {showPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                  ) : (
                                    <Eye className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                              <FormMessage className="text-red-400 text-xs" />
                            </FormItem>
                          )}
                        />

                        {/* Submit */}
                        <Button
                          type="submit"
                          className="w-full h-12 mt-1 rounded-lg font-semibold bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Signing in…</span>
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

                    {/* Divider */}
                    <div className="mt-8 flex items-center gap-3">
                      <div className="h-px bg-white/10 flex-grow" />
                      <span className="text-sm text-slate-400">
                        or continue with
                      </span>
                      <div className="h-px bg-white/10 flex-grow" />
                    </div>

                    {/* Google Auth */}
                    <AnimatePresence>
                      <motion.div
                        className="mt-6"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
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
                    </AnimatePresence>

                    {/* User not found notice */}
                    <AnimatePresence>
                      {userNotFound && (
                        <motion.div
                          key="user-not-found"
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100"
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 mt-0.5 text-rose-400" />
                            <div>
                              <p className="text-sm mb-3">
                                No account was found with your Google email. Join our pilot program to get access.
                              </p>
                              <Button
                                onClick={() => (window.location.href = "/#contactForm")}
                                className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white"
                              >
                                Join Pilot Program
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Fine print */}
                    <p className="mt-6 text-xs leading-relaxed text-slate-400">
                      By continuing, you agree to Blueprint’s{" "}
                      <a
                        href="/terms"
                        className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                      >
                        Terms
                      </a>{" "}
                      and{" "}
                      <a
                        href="/privacy"
                        className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                      >
                        Privacy Policy
                      </a>
                      .
                    </p>
                  </div>
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

// "use client";

// import { useState, useEffect } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
// import { useLocation } from "wouter";
// import { useAuth } from "@/contexts/AuthContext";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
// import * as z from "zod";

// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { useToast } from "@/hooks/use-toast";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";

// const formSchema = z.object({
//   email: z.string().email({
//     message: "Please enter a valid email address.",
//   }),
//   password: z.string().min(8, {
//     message: "Password must be at least 8 characters.",
//   }),
// });

// export default function SignIn() {
//   const [isLoading, setIsLoading] = useState(false);
//   const [isGlowing, setIsGlowing] = useState(false);
//   const { toast } = useToast();
//   const { signIn } = useAuth();
//   const [, setLocation] = useLocation();

//   // Animation for the glow effect
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setIsGlowing((prev) => !prev);
//     }, 3000);
//     return () => clearInterval(interval);
//   }, []);

//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       email: "",
//       password: "",
//     },
//   });

//   async function onSubmit(values: z.infer<typeof formSchema>) {
//     setIsLoading(true);
//     try {
//       await signIn(values.email, values.password);

//       // Check if there's a return URL
//       const searchParams = new URLSearchParams(window.location.search);
//       const returnUrl = searchParams.get("returnUrl");

//       toast({
//         title: "Welcome back!",
//         description: "You've successfully signed in.",
//       });

//       // Redirect to return URL if it exists, otherwise to dashboard
//       if (returnUrl) {
//         window.location.href = decodeURIComponent(returnUrl);
//       } else {
//         setLocation("/dashboard");
//       }
//     } catch (error: any) {
//       toast({
//         title: "Authentication failed",
//         description: error.message,
//         variant: "destructive",
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-blue-50 relative overflow-hidden">
//       {/* Animated background elements */}
//       <div className="fixed inset-0 z-[-2] opacity-70">
//         <motion.div
//           className="absolute w-[70vw] h-[70vw] rounded-full bg-gradient-to-r from-violet-300/30 to-fuchsia-300/30 blur-3xl"
//           style={{ top: "-35vw", right: "-20vw" }}
//           animate={{
//             y: [0, 10, 0],
//             scale: [1, 1.05, 1],
//           }}
//           transition={{
//             duration: 20,
//             repeat: Infinity,
//             repeatType: "reverse",
//           }}
//         />
//         <motion.div
//           className="absolute w-[50vw] h-[50vw] rounded-full bg-gradient-to-r from-blue-300/20 to-cyan-300/20 blur-3xl"
//           style={{ bottom: "-20vw", left: "-10vw" }}
//           animate={{
//             y: [0, -15, 0],
//             scale: [1, 1.08, 1],
//           }}
//           transition={{
//             duration: 25,
//             repeat: Infinity,
//             repeatType: "reverse",
//             delay: 1,
//           }}
//         />
//       </div>

//       {/* Subtle grid pattern overlay */}
//       <motion.div className="fixed inset-0 z-[-1] opacity-[0.07] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

//       <Nav />

//       <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
//         <div className="max-w-md mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 30 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.8,
//               ease: [0.22, 1, 0.36, 1],
//             }}
//             className="backdrop-blur-lg bg-white/70 border border-white/50 rounded-2xl overflow-hidden shadow-xl"
//           >
//             <div className="px-6 py-8 sm:px-8 sm:py-10">
//               <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{
//                   delay: 0.2,
//                   duration: 0.6,
//                   ease: [0.22, 1, 0.36, 1],
//                 }}
//               >
//                 <div className="text-center mb-8">
//                   <motion.div
//                     className={`inline-block p-3 rounded-full bg-gradient-to-tr from-blue-600/80 to-indigo-600/80 mb-4 ${isGlowing ? "shadow-lg shadow-blue-500/20" : ""}`}
//                     animate={{
//                       boxShadow: isGlowing
//                         ? "0 0 20px 2px rgba(79, 70, 229, 0.4)"
//                         : "0 0 0px 0px rgba(79, 70, 229, 0)",
//                     }}
//                     transition={{ duration: 1.5 }}
//                   >
//                     <svg
//                       width="32"
//                       height="32"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       xmlns="http://www.w3.org/2000/svg"
//                     >
//                       <path d="M12 21L5 14H7V10H17V14H19L12 21Z" fill="white" />
//                       <path
//                         d="M12 3L19 10H17V14H7V10H5L12 3Z"
//                         fill="white"
//                         fillOpacity="0.4"
//                       />
//                     </svg>
//                   </motion.div>
//                   <h1 className="text-3xl font-bold text-indigo-900">
//                     Welcome back
//                   </h1>
//                   <p className="text-indigo-600 mt-2">
//                     Sign in to access your Blueprint dashboard
//                   </p>
//                 </div>

//                 <Form {...form}>
//                   <form
//                     onSubmit={form.handleSubmit(onSubmit)}
//                     className="space-y-5"
//                   >
//                     <FormField
//                       control={form.control}
//                       name="email"
//                       render={({ field }) => (
//                         <FormItem>
//                           <FormLabel className="text-indigo-900">
//                             Email
//                           </FormLabel>
//                           <div className="relative">
//                             <Mail className="absolute left-3 top-3 h-5 w-5 text-indigo-500" />
//                             <FormControl>
//                               <Input
//                                 placeholder="your@email.com"
//                                 className="pl-10 h-12 bg-white/60 border-indigo-200 text-indigo-900 placeholder:text-indigo-400/60 focus:border-indigo-400 focus:ring focus:ring-indigo-400/20 rounded-lg"
//                                 {...field}
//                               />
//                             </FormControl>
//                           </div>
//                           <FormMessage className="text-red-500" />
//                         </FormItem>
//                       )}
//                     />
//                     <FormField
//                       control={form.control}
//                       name="password"
//                       render={({ field }) => (
//                         <FormItem>
//                           <div className="flex justify-between items-center">
//                             <FormLabel className="text-indigo-900">
//                               Password
//                             </FormLabel>
//                             <a
//                               href="#"
//                               className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
//                             >
//                               Forgot password?
//                             </a>
//                           </div>
//                           <div className="relative">
//                             <Lock className="absolute left-3 top-3 h-5 w-5 text-indigo-500" />
//                             <FormControl>
//                               <Input
//                                 type="password"
//                                 className="pl-10 h-12 bg-white/60 border-indigo-200 text-indigo-900 focus:border-indigo-400 focus:ring focus:ring-indigo-400/20 rounded-lg"
//                                 {...field}
//                               />
//                             </FormControl>
//                           </div>
//                           <FormMessage className="text-red-500" />
//                         </FormItem>
//                       )}
//                     />
//                     <Button
//                       type="submit"
//                       className="w-full h-12 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/40"
//                       disabled={isLoading}
//                     >
//                       {isLoading ? (
//                         <>
//                           <Loader2 className="h-5 w-5 animate-spin" />
//                           <span>Signing in...</span>
//                         </>
//                       ) : (
//                         <>
//                           <span>Sign In</span>
//                           <ArrowRight className="h-5 w-5" />
//                         </>
//                       )}
//                     </Button>
//                   </form>
//                 </Form>

//                 <div className="mt-8 flex items-center gap-3">
//                   <div className="h-px bg-indigo-200/50 flex-grow"></div>
//                   <span className="text-sm text-indigo-600">
//                     or continue with
//                   </span>
//                   <div className="h-px bg-indigo-200/50 flex-grow"></div>
//                 </div>

//                 <motion.div
//                   className="mt-6"
//                   initial={{ opacity: 0 }}
//                   animate={{ opacity: 1 }}
//                   transition={{ delay: 0.4, duration: 0.5 }}
//                 >
//                   <GoogleOAuthProvider
//                     clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}
//                   >
//                     <div className="bg-white/60 p-0.5 rounded-lg overflow-hidden backdrop-blur-sm hover:bg-white/80 transition-colors">
//                       <GoogleLogin
//                         onSuccess={async (credentialResponse) => {
//                           setIsLoading(true);
//                           try {
//                             console.log(credentialResponse);
//                             toast({
//                               title: "Welcome back!",
//                               description:
//                                 "You've successfully signed in with Google.",
//                             });
//                             setLocation("/dashboard");
//                           } catch (error) {
//                             toast({
//                               title: "Authentication failed",
//                               description: "Failed to sign in with Google.",
//                               variant: "destructive",
//                             });
//                           } finally {
//                             setIsLoading(false);
//                           }
//                         }}
//                         onError={() => {
//                           toast({
//                             title: "Authentication failed",
//                             description: "Failed to sign in with Google.",
//                             variant: "destructive",
//                           });
//                         }}
//                         width="100%"
//                         theme="filled_black"
//                         text="continue_with"
//                         shape="pill"
//                         locale="en"
//                         logo_alignment="center"
//                       />
//                     </div>
//                   </GoogleOAuthProvider>
//                 </motion.div>
//               </motion.div>
//             </div>
//           </motion.div>
//         </div>
//       </div>
//       <Footer />
//     </div>
//   );
// }
