// ===============================================
// FILE: src/pages/Home.tsx
// PURPOSE: Flagship Landing (Home) tuned for Durham Pilot conversion
// NOTES:
// - Premium "aurora glass" aesthetic with parallax orbs & grid
// - Subtle motion with prefers-reduced-motion guard
// - Sticky mobile CTA, above-the-fold trust chips, animated counters
// - Uses existing: Nav, Hero, LocationShowcase, ContactForm, Footer
// ===============================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
// ↓ Lazy-load below-the-fold UI so the Home above-the-fold gets first paint fast
const LocationShowcase = lazy(
  () => import("@/components/sections/LocationShowcase"),
);
const ContactForm = lazy(() => import("@/components/sections/ContactForm"));
import Footer from "@/components/Footer";
import LindyChat from "@/components/LindyChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  ShieldCheck,
  Clock,
  Smartphone,
  Sparkles,
  BarChart3,
} from "lucide-react";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const [isContactInView, setIsContactInView] = useState(false);
  const [hasReachedContact, setHasReachedContact] = useState(false);
  const shouldReduce = useReducedMotion();
  // Only enable heavy visuals on larger screens without reduced motion

  // Only enable heavy visuals on larger screens without reduced motion
  const [useLightFX, setUseLightFX] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mql = window.matchMedia(
        "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      );
      setUseLightFX(mql.matches);
    }
  }, []);

  //just to make changes, necessary again

  useEffect(() => {
    if (currentUser) setLocation("/dashboard");
  }, [currentUser, setLocation]);

  // 👇 Set up intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsContactInView(entry.isIntersecting),
      { threshold: 0.3 }, // adjust so it hides when ~30% of the contact section is visible
    );
    if (contactRef.current) observer.observe(contactRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Hide CTA once we've reached the contact section (and keep it hidden below)
  useEffect(() => {
    const computeReached = () => {
      const el = contactRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const contactTop = rect.top + window.scrollY;
      const viewportBottom = window.scrollY + window.innerHeight;
      // small buffer so it disappears a touch early
      setHasReachedContact(viewportBottom >= contactTop - 8);
    };
    
    computeReached(); // initialize on first mount
    window.addEventListener("scroll", computeReached, { passive: true });
    window.addEventListener("resize", computeReached);
    
    return () => {
      window.removeEventListener("scroll", computeReached);
      window.removeEventListener("resize", computeReached);
    };
  }, []);

  const benefits = useMemo(
    () => [
      { icon: <Clock className="w-4 h-4" />, label: "60-min on-site setup" },
      { icon: <Smartphone className="w-4 h-4" />, label: "No app required" },
      {
        icon: <Sparkles className="w-4 h-4" />,
        label: "Custom AR for your space",
      },
      {
        icon: <BarChart3 className="w-4 h-4" />,
        label: "Live engagement analytics",
      },
    ],
    [],
  );

  const handleScrollToContact = () => {
    const el = document.getElementById("contactForm");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Parallax background orbs (desktop only, super subtle)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const orbX = useTransform(mouseX, [0, 1], ["-2%", "2%"]);
  const orbY = useTransform(mouseY, [0, 1], ["-1%", "1%"]);

  const onMouseMove = (e: React.MouseEvent) => {
    if (shouldReduce) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100"
      onMouseMove={onMouseMove}
    >
      {/* BACKGROUND: aurora + grid + parallax blobs */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ contain: "paint" }}
      >
        {/* Soft grid (cheap) */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Aurora wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
        {/* Parallax blobs (desktop only) */}
        {useLightFX && !shouldReduce && (
          <>
            <motion.div
              style={{ x: orbX, y: orbY }}
              className="absolute -top-40 -right-64 h-[50rem] w-[50rem] rounded-full md:blur-xl blur-none opacity-35 bg-gradient-to-br from-emerald-500/25 via-cyan-500/25 to-sky-500/10 will-change-transform"
            />
            <motion.div
              style={{ x: orbX, y: orbY }}
              className="absolute -bottom-56 -left-64 h-[46rem] w-[46rem] rounded-full md:blur-xl blur-none opacity-25 bg-gradient-to-tr from-cyan-500/15 via-emerald-500/15 to-amber-400/10 will-change-transform"
            />
          </>
        )}
        {/* No film-grain turbulence layer — it causes extra paints on scroll */}
      </div>

      <Nav />

      <main ref={mainRef} className="flex-1 relative">
        {/* HERO */}
        <Hero onPrimaryCta={handleScrollToContact} />

        {/* Benefit strip */}
        <section
          className="bg-[#0E172A]/90 py-4 border-y border-white/5"
          style={{
            contentVisibility: "auto",
            contain: "paint",
            containIntrinsicSize: "1px 240px",
          }}
        >
          <div className="container mx-auto px-4 overflow-hidden">
            <div className="marquee">
              <div className="marquee__track">
                {[
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "60-min on-site setup",
                  },
                  {
                    icon: <Smartphone className="w-4 h-4" />,
                    label: "No app required",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Custom AR for your space",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Live engagement analytics",
                  },
                  {
                    icon: <ShieldCheck className="w-4 h-4" />,
                    label: "No hardware cost",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Works on headsets & glasses",
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "White-glove onboarding",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Boosts customer engagement",
                  },
                  // duplicate once for seamless loop:
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "60-min on-site setup",
                  },
                  {
                    icon: <Smartphone className="w-4 h-4" />,
                    label: "No app required",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Custom AR for your space",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Live engagement analytics",
                  },
                  {
                    icon: <ShieldCheck className="w-4 h-4" />,
                    label: "No hardware cost",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Works on headsets & glasses",
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "White-glove onboarding",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Boosts customer engagement",
                  },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-center gap-2"
                  >
                    <span className="text-emerald-300">{b.icon}</span>
                    <span className="text-sm font-medium text-slate-100 whitespace-nowrap">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Qualify (replaces the "Social proof / assurances" section) */}
        <section className="bg-[#0B1220] py-8 md:py-12">
          <div className="container mx-auto px-4">
            {/* MOBILE: stacked, compact */}
            <div className="md:hidden space-y-4">
              {/* Are you a fit? */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-emerald-300 mb-1">
                  Eligibility
                </p>
                <h3 className="text-lg font-bold text-white mb-3">
                  Are you a fit?
                </h3>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "Durham ≤ 30-min drive",
                    "Customer-facing space",
                    "On-site point of contact",
                    "~60-min access window",
                  ].map((t) => (
                    <li
                      key={t}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What’s included */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-cyan-300 mb-1">
                  Included
                </p>
                <h3 className="text-lg font-bold text-white mb-3">
                  What you’ll get
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• LiDAR mapping of your space</li>
                  <li>• Custom AR layer tailored to your brand</li>
                  <li>• QR kit for instant access on-site</li>
                  <li>• VR headset demo day for your team</li>
                  <li>• Simple engagement recap & next-step options</li>
                </ul>
              </div>

              {/* Who does what + availability */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 mb-1">
                      We handle
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li>• Mapping & design</li>
                      <li>• Setup & devices</li>
                      <li>• Analytics recap</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-cyan-300 mb-1">
                      You provide
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li>• 60-min window</li>
                      <li>• Logo/menu/product list</li>
                      <li>• Quick feedback</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Two visits (~10 days)
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Live demo 1–2 hrs
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Replies &lt; 24h
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Limited spots
                  </span>
                </div>

                <Button
                  onClick={handleScrollToContact}
                  className="w-full rounded-xl h-12 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold shadow-xl"
                >
                  Check my eligibility
                </Button>
              </div>
            </div>

            {/* DESKTOP: compact 3-card grid */}
            <div className="hidden md:grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-semibold text-emerald-300 mb-1">
                  Eligibility
                </p>
                <h3 className="text-xl font-bold text-white mb-3">
                  Are you a fit?
                </h3>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "Durham ≤ 30-min",
                    "Customer-facing",
                    "POC on-site",
                    "~60-min access",
                  ].map((t) => (
                    <li
                      key={t}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-semibold text-cyan-300 mb-1">
                  Included
                </p>
                <h3 className="text-xl font-bold text-white mb-3">
                  What you’ll get
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• LiDAR mapping</li>
                  <li>• Custom AR layer</li>
                  <li>• QR kit</li>
                  <li>• VR headset demo day</li>
                  <li>• Engagement recap</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 mb-1">
                      We handle
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li>• Mapping & design</li>
                      <li>• Setup & devices</li>
                      <li>• Analytics recap</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-cyan-300 mb-1">
                      You provide
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li>• 60-min window</li>
                      <li>• Brand assets</li>
                      <li>• Feedback</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      Replies &lt; 24h
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      Limited spots
                    </span>
                  </div>
                  <Button
                    onClick={handleScrollToContact}
                    className="rounded-xl h-10 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"
                  >
                    Join the Pilot
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Showcase (lazy) */}
        <Suspense fallback={<div className="h-40" />}>
          <div
            style={{
              contentVisibility: "auto",
              contain: "paint",
              containIntrinsicSize: "1px 720px",
            }}
          >
            <LocationShowcase />
          </div>
        </Suspense>

        {/* Conversion block (no backdrop-blur) */}
        <section
          className="relative py-16"
          style={{
            contentVisibility: "auto",
            contain: "paint",
            containIntrinsicSize: "1px 560px",
          }}
        >
          <div className="container mx-auto px-4">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-6 md:p-10 text-center overflow-hidden relative">
              {/* light sweep */}
              <div className="pointer-events-none absolute -top-1/2 left-1/2 h-[120%] w-[60%] -translate-x-1/2 rotate-12 bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
              <h3 className="text-2xl md:text-4xl font-black text-white">
                Ready to put AR to work in your location?
              </h3>
              <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
                We’re onboarding businesses within a 30-minute drive of Durham.
                Two quick visits about a week apart: mapping (~60 min) and an
                on-site demo (1–2 hrs). The pilot is free.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 justify-center">
                <Button
                  onClick={handleScrollToContact}
                  className="h-12 w-full text-base rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition will-change-transform"
                >
                  Join the Durham Pilot (Free)
                </Button>
                <a href="/pilot-program" className="w-full">
                  <Button
                    variant="outline"
                    className="h-12 w-full text-base rounded-xl border-white/20 text-black hover:bg-white/10"
                  >
                    How the Pilot Works
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact (lazy) */}
        <div
          ref={contactRef}
          id="contactForm"
          style={{
            contentVisibility: "auto",
            contain: "paint",
            containIntrinsicSize: "1px 680px",
          }}
        >
          <Suspense fallback={<div className="h-40" />}>
            <ContactForm />
          </Suspense>
        </div>
      </main>

      {/* Sticky mobile CTA */}
      {!hasReachedContact && (
        <div className="md:hidden sticky bottom-4 z-50 px-4">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={handleScrollToContact}
              className="w-full rounded-2xl h-14 text-base font-semibold shadow-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"
            >
              Join Pilot — Free Setup
            </Button>
          </motion.div>
        </div>
      )}

      <Footer />
      <LindyChat ctaVisible={!hasReachedContact} />
    </div>
  );
}

function AssuranceCard({
  title,
  headlineSuffix,
  body,
  accentClass,
}: {
  title: React.ReactNode;
  headlineSuffix: string;
  body: string;
  accentClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-6"
    >
      <p className={`text-4xl font-black ${accentClass}`}>
        {title}
        {typeof title === "string" ? "" : ""}
      </p>
      <p className="mt-1 text-slate-200 font-semibold">{headlineSuffix}</p>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
    >
      <div className="text-xl font-extrabold text-white">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">
        {label}
      </div>
    </motion.div>
  );
}

// // This file defines the Home page component, which serves as the main landing page for the application.
// // It showcases the application's features, benefits, and provides a way for users to join the waitlist or contact the team.

// import React, { useState, useEffect, useRef } from "react";
// import { useLocation } from "wouter";
// import { useAuth } from "@/contexts/AuthContext";
// import Nav from "@/components/Nav";
// import Hero from "@/components/sections/Hero";
// import Features from "@/components/sections/Features";
// import { Button } from "@/components/ui/button";
// import ContactForm from "@/components/sections/ContactForm";
// import { Card, CardContent } from "@/components/ui/card";
// import Footer from "@/components/Footer";
// import Testimonials from "@/components/sections/Testimonials";
// import LocationShowcase from "@/components/sections/LocationShowcase";
// import {
//   motion,
//   useScroll,
//   useTransform,
//   AnimatePresence,
// } from "framer-motion";
// import {
//   ShieldCheck,
//   Rocket,
//   Sparkle,
//   Zap,
//   MapPin,
//   Edit,
//   Wand2,
//   PlayCircle,
//   ArrowRight,
//   CheckCircle2,
//   ArrowDown,
//   Info,
//   Layers,
//   Code,
//   Globe,
//   Users,
//   PenTool,
//   Activity,
//   Clock,
//   Star,
//   Smartphone,
//   Brain,
// } from "lucide-react";

// /**
//  * Mobile-specific process stepper component with compact timeline design
//  */
// function MobileProcessStepper({ steps, onGetStarted }) {
//   const [currentStep, setCurrentStep] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   // Handle touch events for swipe
//   const onTouchStart = (e) => {
//     setTouchEnd(null);
//     setTouchStart(e.targetTouches[0].clientX);
//   };

//   const onTouchMove = (e) => {
//     setTouchEnd(e.targetTouches[0].clientX);
//   };

//   const onTouchEnd = () => {
//     if (!touchStart || !touchEnd) return;

//     const distance = touchStart - touchEnd;
//     const isLeftSwipe = distance > 50;
//     const isRightSwipe = distance < -50;

//     if (isLeftSwipe && currentStep < steps.length - 1) {
//       setCurrentStep(currentStep + 1);
//     }
//     if (isRightSwipe && currentStep > 0) {
//       setCurrentStep(currentStep - 1);
//     }
//   };

//   const step = steps[currentStep];

//   return (
//     <div className="relative">
//       {/* Horizontal Stepper Timeline */}
//       <motion.div
//         className="relative mb-8"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         {/* Progress Line */}
//         <div className="absolute top-6 left-6 right-6 h-1 bg-slate-200 rounded-full">
//           <motion.div
//             className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 via-violet-500 to-fuchsia-500 rounded-full"
//             initial={{ width: "0%" }}
//             animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
//             transition={{ duration: 0.5, ease: "easeInOut" }}
//           />
//         </div>

//         {/* Step Icons */}
//         <div className="flex justify-between relative z-10">
//           {steps.map((stepItem, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentStep(idx)}
//               className="group relative"
//             >
//               <motion.div
//                 className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
//                   idx <= currentStep
//                     ? `bg-gradient-to-br ${stepItem.color} text-white shadow-lg`
//                     : "bg-white border-2 border-slate-200 text-slate-400"
//                 }`}
//                 whileHover={{ scale: 1.1 }}
//                 whileTap={{ scale: 0.95 }}
//               >
//                 {idx < currentStep ? (
//                   <CheckCircle2 className="w-6 h-6" />
//                 ) : (
//                   React.cloneElement(stepItem.icon, {
//                     className: "w-5 h-5",
//                   })
//                 )}
//               </motion.div>

//               {/* Step Number Badge */}
//               <div
//                 className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
//                   idx <= currentStep
//                     ? "bg-slate-900 text-white"
//                     : "bg-slate-200 text-slate-500"
//                 }`}
//               >
//                 {idx + 1}
//               </div>

//               {/* Step Label */}
//               <div className="absolute top-14 left-1/2 transform -translate-x-1/2 w-20 text-center">
//                 <span className="text-xs font-medium text-slate-600 block leading-tight">
//                   {stepItem.title.split(" ").slice(0, 2).join(" ")}
//                 </span>
//               </div>
//             </button>
//           ))}
//         </div>
//       </motion.div>

//       {/* Current Step Card */}
//       <div
//         className="relative overflow-hidden mt-16"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentStep}
//             initial={{ x: 300, opacity: 0 }}
//             animate={{ x: 0, opacity: 1 }}
//             exit={{ x: -300, opacity: 0 }}
//             transition={{ type: "spring", stiffness: 300, damping: 30 }}
//           >
//             <Card className="bg-white border-slate-200 shadow-xl">
//               <CardContent className="p-6">
//                 {/* Duration Badge */}
//                 <div className="text-center mb-4">
//                   <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
//                     {step.duration}
//                   </span>
//                 </div>

//                 {/* Step Icon & Title */}
//                 <div className="flex items-center gap-4 mb-4">
//                   <div
//                     className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}
//                   >
//                     {React.cloneElement(step.icon, {
//                       className: "w-7 h-7",
//                     })}
//                   </div>
//                   <div>
//                     <h3 className="text-xl font-bold text-slate-900">
//                       {step.title}
//                     </h3>
//                     <p className="text-sm text-slate-500">
//                       Step {currentStep + 1} of {steps.length}
//                     </p>
//                   </div>
//                 </div>

//                 {/* Description */}
//                 <p className="text-slate-600 mb-6 leading-relaxed">
//                   {step.description}
//                 </p>

//                 {/* Benefits */}
//                 <div className="space-y-3 mb-6">
//                   {step.benefits.map((benefit, bidx) => (
//                     <motion.div
//                       key={bidx}
//                       initial={{ opacity: 0, x: -20 }}
//                       animate={{ opacity: 1, x: 0 }}
//                       transition={{ delay: 0.2 + bidx * 0.1 }}
//                       className="flex items-center gap-3"
//                     >
//                       <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
//                       <span className="text-slate-700 font-medium">
//                         {benefit}
//                       </span>
//                     </motion.div>
//                   ))}
//                 </div>

//                 {/* CTA Button for first step */}
//                 {currentStep === 0 && (
//                   <Button
//                     className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
//                     onClick={onGetStarted}
//                   >
//                     Start Your AR Journey
//                     <ArrowRight className="w-5 h-5 ml-2" />
//                   </Button>
//                 )}
//               </CardContent>
//             </Card>
//           </motion.div>
//         </AnimatePresence>
//       </div>

//       {/* Navigation Controls */}
//       <div className="flex justify-between items-center mt-6">
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
//           disabled={currentStep === 0}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           <ArrowRight className="w-4 h-4 rotate-180" />
//           Previous
//         </Button>

//         <div className="text-sm text-slate-500">
//           {currentStep + 1} / {steps.length}
//         </div>

//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() =>
//             currentStep < steps.length - 1 && setCurrentStep(currentStep + 1)
//           }
//           disabled={currentStep === steps.length - 1}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           Next
//           <ArrowRight className="w-4 h-4" />
//         </Button>
//       </div>

//       {/* Swipe Hint */}
//       {currentStep === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right or use buttons to navigate
//           </p>
//         </motion.div>
//       )}

//       {/* Final CTA */}
//       {currentStep === steps.length - 1 && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 0.5 }}
//           className="mt-8 text-center"
//         >
//           <p className="text-slate-600 mb-4">
//             Ready to transform your customer experience?
//           </p>
//           <Button
//             size="lg"
//             variant="outline"
//             className="px-8 py-4 font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
//             onClick={onGetStarted}
//           >
//             Learn More & Get Started
//             <ArrowDown className="w-5 h-5 ml-2" />
//           </Button>
//         </motion.div>
//       )}
//     </div>
//   );
// }

// /**
//  * Mobile-specific trust metrics component with horizontal scroll and compact design
//  */
// function MobileTrustMetrics({ trustMetrics }) {
//   const [activeIndex, setActiveIndex] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   // Industry types for mobile icons
//   const industryTypes = [
//     { icon: "🏪", name: "Retail" },
//     { icon: "🏛️", name: "Museum" },
//     { icon: "🎨", name: "Gallery" },
//     { icon: "🏢", name: "Showroom" },
//     { icon: "🏨", name: "Hospitality" },
//   ];

//   // Handle touch events for swipe
//   const onTouchStart = (e) => {
//     setTouchEnd(null);
//     setTouchStart(e.targetTouches[0].clientX);
//   };

//   const onTouchMove = (e) => {
//     setTouchEnd(e.targetTouches[0].clientX);
//   };

//   const onTouchEnd = () => {
//     if (!touchStart || !touchEnd) return;

//     const distance = touchStart - touchEnd;
//     const isLeftSwipe = distance > 50;
//     const isRightSwipe = distance < -50;

//     if (isLeftSwipe && activeIndex < trustMetrics.length - 1) {
//       setActiveIndex(activeIndex + 1);
//     }
//     if (isRightSwipe && activeIndex > 0) {
//       setActiveIndex(activeIndex - 1);
//     }
//   };

//   return (
//     <div className="relative">
//       {/* Header with Icons */}
//       <motion.div
//         className="text-center mb-6"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         {/* Industry Icons */}
//         <div className="flex justify-center items-center gap-3 mb-4">
//           <div className="flex -space-x-2">
//             {industryTypes.map((industry, i) => (
//               <div
//                 key={i}
//                 className="w-8 h-8 rounded-full border-2 border-white bg-white flex items-center justify-center shadow-lg"
//                 title={industry.name}
//               >
//                 <span className="text-lg">{industry.icon}</span>
//               </div>
//             ))}
//             <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs flex items-center justify-center border-2 border-white font-bold shadow-lg">
//               20+
//             </div>
//           </div>
//         </div>

//         <h3 className="text-lg font-bold text-slate-900 mb-2">
//           Trusted by 20+ Businesses
//         </h3>
//         <p className="text-sm text-slate-600">
//           Testing the future of customer engagement
//         </p>
//       </motion.div>

//       {/* Rest of the existing component remains the same */}
//       <div
//         className="relative overflow-hidden"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <div
//           className="flex transition-transform duration-300 ease-out"
//           style={{ transform: `translateX(-${activeIndex * 100}%)` }}
//         >
//           {trustMetrics.map((metric, index) => (
//             <motion.div
//               key={metric.label}
//               className="w-full flex-shrink-0 px-2"
//               initial={{ opacity: 0, scale: 0.9 }}
//               whileInView={{ opacity: 1, scale: 1 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.6, delay: index * 0.1 }}
//             >
//               <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-6 shadow-lg text-center">
//                 {/* Icon */}
//                 <div className="flex justify-center mb-4">
//                   <div className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg">
//                     {metric.icon}
//                   </div>
//                 </div>

//                 {/* Metric Value */}
//                 <div className="text-4xl font-black text-slate-900 mb-2">
//                   {metric.value}
//                 </div>

//                 {/* Label */}
//                 <div className="text-slate-600 font-semibold mb-2 text-base">
//                   {metric.label}
//                 </div>

//                 {/* Context */}
//                 <div className="text-sm text-slate-500 italic">
//                   {metric.context}
//                 </div>

//                 {/* Tooltip content for mobile */}
//                 <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
//                   <p className="text-xs text-slate-600 leading-relaxed">
//                     {metric.tooltip}
//                   </p>
//                 </div>
//               </div>
//             </motion.div>
//           ))}
//         </div>
//       </div>

//       {/* Navigation Dots */}
//       <div className="flex justify-center mt-6 gap-2">
//         {trustMetrics.map((_, index) => (
//           <button
//             key={index}
//             onClick={() => setActiveIndex(index)}
//             className={`w-2 h-2 rounded-full transition-all duration-300 ${
//               index === activeIndex ? "bg-indigo-600 w-6" : "bg-slate-300"
//             }`}
//           />
//         ))}
//       </div>

//       {/* Swipe Hint */}
//       {activeIndex === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right to see more metrics
//           </p>
//         </motion.div>
//       )}

//       {/* Compact Summary */}
//       <motion.div
//         className="mt-8 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.3 }}
//       >
//         <div className="text-center">
//           <h4 className="font-bold text-slate-900 mb-2 text-sm">
//             Why Businesses Choose Blueprint
//           </h4>
//           <div className="grid grid-cols-2 gap-3 text-xs">
//             <div className="flex items-center gap-2">
//               <div className="w-2 h-2 bg-green-500 rounded-full"></div>
//               <span className="text-slate-700">10x Faster Setup</span>
//             </div>
//             <div className="flex items-center gap-2">
//               <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
//               <span className="text-slate-700">No App Required</span>
//             </div>
//             <div className="flex items-center gap-2">
//               <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
//               <span className="text-slate-700">200% Engagement</span>
//             </div>
//             <div className="flex items-center gap-2">
//               <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
//               <span className="text-slate-700">Industry Leading</span>
//             </div>
//           </div>
//         </div>
//       </motion.div>
//     </div>
//   );
// }

// /**
//  * The Home component renders the main landing page of the application.
//  * It includes sections such as Hero, Features, Testimonials, LocationShowcase, and a ContactForm.
//  * It also handles redirection to the dashboard if the user is already logged in.
//  *
//  * @returns {JSX.Element} The rendered Home page.
//  */
// export default function Home() {
//   const { currentUser } = useAuth();
//   const [, setLocation] = useLocation();
//   const mainRef = useRef(null);

//   const steps = [
//     {
//       icon: <Users className="w-6 h-6 md:w-8 md:h-8" />,
//       title: "Join Pilot Program",
//       description:
//         "Secure your spot in our exclusive Pilot Program. Priority onboarding available.",
//       benefits: ["Priority access", "Free 2 week program", "Dedicated support"],
//       color: "from-emerald-500 to-teal-600",
//       duration: "1 minute",
//     },
//     {
//       icon: <MapPin className="w-6 h-6 md:w-8 md:h-8" />,
//       title: "3D Space Mapping",
//       description:
//         "Our expert team visits your location to create a precise 3D digital twin of your space.",
//       benefits: [
//         "Professional scanning",
//         "Flexible scheduling",
//         "High-precision mapping",
//       ],
//       color: "from-blue-500 to-cyan-500",
//       duration: "30-60 minutes",
//     },
//     // {
//     //   icon: <Brain className="w-6 h-6 md:w-8 md:h-8" />,
//     //   title: "AI-Powered Setup",
//     //   description:
//     //     "Our AI generates custom AR experiences tailored to your business goals and customer journey.",
//     //   benefits: [
//     //     "Intelligent content placement",
//     //     "Custom interactions",
//     //     "Brand integration",
//     //   ],
//     //   color: "from-violet-500 to-purple-600",
//     //   duration: "30 minutes",
//     // },
//     {
//       icon: <Brain className="w-6 h-6 md:w-8 md:h-8" />,
//       title: "Blueprint Design",
//       description:
//         "Our designers work to create custom AR experiences tailored to your business goals and customer journey.",
//       benefits: [
//         "Intelligent content placement",
//         "Custom interactions",
//         "Brand integration",
//       ],
//       color: "from-violet-500 to-purple-600",
//       duration: "1-2 Days",
//     },
//     // {
//     //   icon: <Rocket className="w-6 h-6 md:w-8 md:h-8" />,
//     //   title: "Launch & Scale",
//     //   description:
//     //     "Go live instantly with QR codes. Track engagement and optimize your AR experience with real-time analytics.",
//     //   benefits: [
//     //     "Instant deployment",
//     //     "Performance analytics",
//     //     "Continuous optimization",
//     //   ],
//     //   color: "from-fuchsia-500 to-pink-600",
//     //   duration: "Same day",
//     // },
//     {
//       icon: <Rocket className="w-6 h-6 md:w-8 md:h-8" />,
//       title: "Demo Day",
//       description:
//         "We'll come in with a VR headset to give a ~1 hour long demonstration. Open to any and everyone!",
//       benefits: [
//         "Feedback",
//         "Performance analytics",
//         "Continuous optimization",
//       ],
//       color: "from-fuchsia-500 to-pink-600",
//       duration: "Next Week",
//     },
//   ];

//   // Trust indicators with enhanced context
//   const trustMetrics = [
//     {
//       label: "Faster Setup",
//       value: "10x",
//       icon: <Clock className="w-5 h-5" />,
//       context: "vs. building solutions in-house",
//       tooltip:
//         "Average business takes ~10 days to build AR solutions vs. Blueprint's 1-day deployment",
//     },
//     {
//       label: "Customer Engagement",
//       value: "200%",
//       icon: <Star className="w-5 h-5" />,
//       context: "vs. non-AR experiences",
//       tooltip:
//         "AR experiences deliver significantly higher interactivity compared to traditional digital interactions",
//     },
//     {
//       label: "No App Required",
//       value: "N/A",
//       icon: <Smartphone className="w-5 h-5" />,
//       context: "Works via QR codes",
//       tooltip:
//         "Customers access AR experiences instantly through their glasses's camera - no downloads needed",
//     },
//   ];

//   // Parallax scrolling effect
//   const { scrollYProgress } = useScroll({
//     target: mainRef,
//     offset: ["start start", "end start"],
//   });

//   /**
//    * Scrolls the page to the contact form section smoothly.
//    */
//   const handleScrollToContactForm = () => {
//     const contactFormElement = document.getElementById("contactForm");
//     if (contactFormElement) {
//       contactFormElement.scrollIntoView({ behavior: "smooth" });
//     }
//   };

//   const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

//   useEffect(() => {
//     if (currentUser) {
//       setLocation("/dashboard");
//     }
//   }, [currentUser, setLocation]);

//   useEffect(() => {
//     const lindyScriptId = "lindy-embed-script";

//     // Check if script already exists or if timeout is already set
//     // @ts-ignore
//     if (document.getElementById(lindyScriptId) || window.lindyScriptTimeoutId) {
//       return;
//     }

//     const loadLindyScript = () => {
//       if (document.getElementById(lindyScriptId)) return; // Double check

//       const script = document.createElement("script");
//       script.id = lindyScriptId;
//       script.src =
//         "https://api.lindy.ai/api/lindyEmbed/lindyEmbed.js?a=9620fed7-bdfb-4329-ada0-b60963170c59";
//       script.async = true;
//       script.crossOrigin = "use-credentials";

//       document.body.appendChild(script);
//     };

//     // @ts-ignore
//     window.lindyScriptTimeoutId = setTimeout(loadLindyScript, 3000); // Delay loading by 3 seconds

//     return () => {
//       // @ts-ignore
//       if (window.lindyScriptTimeoutId) {
//         // @ts-ignore
//         clearTimeout(window.lindyScriptTimeoutId);
//         // @ts-ignore
//         window.lindyScriptTimeoutId = null;
//       }
//       const existingScript = document.getElementById(lindyScriptId);
//       if (existingScript && existingScript.parentNode) {
//         existingScript.parentNode.removeChild(existingScript);
//       }
//     };
//   }, []);

//   return (
//     <div className="min-h-screen flex flex-col relative overflow-hidden bg-white">
//       {/* Enhanced background patterns */}
//       <div className="fixed inset-0 z-[-2] bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
//         {/* <motion.div
//           className="absolute w-[120vw] h-[120vw] md:w-[80vw] md:h-[80vw] rounded-full bg-gradient-to-r from-indigo-100/40 via-violet-100/30 to-fuchsia-100/20 blur-3xl"
//           style={{ top: "-60vw", right: "-40vw" }}
//           animate={{
//             y: [0, 20, 0],
//             scale: [1, 1.1, 1],
//             rotate: [0, 45, 0],
//           }}
//           transition={{
//             duration: 30,
//             repeat: Infinity,
//             repeatType: "reverse",
//           }}
//         /> */}
//         <div
//           className="absolute w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] rounded-full bg-gradient-to-r from-indigo-100/40 via-violet-100/30 to-fuchsia-100/20 blur-2xl opacity-60"
//           style={{ top: "-40vw", right: "-20vw" }}
//         />
//         <motion.div
//           className="absolute w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] rounded-full bg-gradient-to-r from-blue-100/30 via-cyan-100/20 to-emerald-100/15 blur-3xl"
//           style={{ bottom: "-50vw", left: "-30vw" }}
//         />
//       </div>

//       <Nav />

//       <main ref={mainRef} className="flex-1 relative z-10">
//         <Hero />

//         {/* Trust metrics section */}
//         <section className="py-3 md:py-16 bg-gradient-to-b from-indigo-50/30 via-white/60 to-slate-50/40 backdrop-blur-sm">
//           <div className="container mx-auto px-4 md:px-6">
//             {/* MOBILE VERSION */}
//             <div className="block md:hidden">
//               <MobileTrustMetrics trustMetrics={trustMetrics} />
//             </div>

//             {/* DESKTOP VERSION - Keep existing */}
//             <motion.div
//               className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto"
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true, amount: 0.8 }}
//               transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
//             >
//               {trustMetrics.map((metric, index) => (
//                 <motion.div
//                   key={metric.label}
//                   className="text-center p-4 md:p-6 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group relative"
//                   initial={{ opacity: 0, y: 20 }}
//                   whileInView={{ opacity: 1, y: 0 }}
//                   viewport={{ once: true }}
//                   transition={{ duration: 0.6, delay: index * 0.1 }}
//                 >
//                   {/* Tooltip */}
//                   <div className="hidden md:block absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
//                     <div className="relative">
//                       <Info className="w-5 h-5 text-slate-400 hover:text-slate-600 cursor-help" />
//                       <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50">
//                         {metric.tooltip}
//                         <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="flex items-center justify-center mb-2 md:mb-3">
//                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center text-white">
//                       {metric.icon}
//                     </div>
//                   </div>
//                   <div className="text-2xl md:text-4xl font-black text-slate-900 mb-1 md:mb-2">
//                     {metric.value}
//                   </div>
//                   <div className="text-slate-600 font-medium mb-1 text-sm md:text-base">
//                     {metric.label}
//                   </div>
//                   {/* Context text */}
//                   <div className="text-xs md:text-sm text-slate-500 italic">
//                     {metric.context}
//                   </div>
//                 </motion.div>
//               ))}
//             </motion.div>
//           </div>
//         </section>

//         <LocationShowcase />

//         {/* Enhanced Process Overview */}
//         <section className="py-16 md:py-24 px-6 relative bg-gradient-to-b from-slate-50 to-white">
//           <div className="container mx-auto max-w-7xl">
//             <motion.div
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.8 }}
//               className="max-w-4xl mx-auto text-center mb-12 md:mb-16"
//             >
//               <div className="inline-flex items-center gap-2 mb-4 bg-indigo-50 text-indigo-700 py-2 px-4 rounded-full text-sm font-semibold">
//                 <Zap className="w-4 h-4" />
//                 Simple 4-Step Process
//               </div>
//               <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 md:mb-6 text-slate-900">
//                 From Concept to{" "}
//                 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">
//                   Live AR Experience
//                 </span>
//               </h2>
//               <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
//                 Our streamlined approach makes implementing cutting-edge AR
//                 technology effortless. Get your interactive experience up and
//                 running in under 24 hours. No hardware or expertise required.
//               </p>
//             </motion.div>

//             {/* MOBILE VERSION */}
//             <div className="block md:hidden">
//               <MobileProcessStepper
//                 steps={steps}
//                 onGetStarted={handleScrollToContactForm}
//               />
//             </div>

//             {/* DESKTOP VERSION - Keep existing */}
//             <div className="hidden md:block">
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
//                 {/* Enhanced connection line */}
//                 <div className="hidden lg:block absolute top-20 left-[12.5%] right-[12.5%] h-1 bg-gradient-to-r from-emerald-400 via-blue-400 via-violet-400 to-fuchsia-400 rounded-full shadow-lg" />

//                 {steps.map((step, idx) => (
//                   <motion.div
//                     key={idx}
//                     initial={{ opacity: 0, y: 30 }}
//                     whileInView={{ opacity: 1, y: 0 }}
//                     viewport={{ once: true }}
//                     transition={{ duration: 0.6, delay: idx * 0.15 }}
//                     whileHover={{ y: -8 }}
//                     className="relative z-10"
//                   >
//                     <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-white/90 backdrop-blur-sm overflow-hidden group">
//                       <CardContent className="p-6 md:p-8">
//                         <div className="flex flex-col items-center text-center mb-6">
//                           <div className="relative mb-6">
//                             <div
//                               className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${step.color} shadow-xl group-hover:scale-110 transition-transform duration-300`}
//                             >
//                               {step.icon}
//                             </div>
//                             <div className="absolute -top-2 -right-2 bg-slate-900 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">
//                               {idx + 1}
//                             </div>
//                           </div>

//                           <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
//                             {step.duration}
//                           </div>

//                           <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">
//                             {step.title}
//                           </h3>

//                           <p className="text-slate-600 mb-6 leading-relaxed">
//                             {step.description}
//                           </p>
//                         </div>

//                         <div className="space-y-3">
//                           {step.benefits.map((benefit, bidx) => (
//                             <div
//                               key={bidx}
//                               className="flex items-center text-slate-700"
//                             >
//                               <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
//                               <span className="text-sm font-medium">
//                                 {benefit}
//                               </span>
//                             </div>
//                           ))}
//                         </div>

//                         {idx === 0 && (
//                           <Button
//                             className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
//                             onClick={handleScrollToContactForm}
//                           >
//                             Start Your AR Journey
//                             <ArrowRight className="w-5 h-5 ml-2" />
//                           </Button>
//                         )}
//                       </CardContent>
//                     </Card>
//                   </motion.div>
//                 ))}
//               </div>

//               {/* Call-to-action below process */}
//               <motion.div
//                 className="text-center mt-16"
//                 initial={{ opacity: 0, y: 20 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ duration: 0.6, delay: 0.3 }}
//               >
//                 <p className="text-lg text-slate-600 mb-6">
//                   Ready to transform your customer experience?
//                 </p>
//                 <Button
//                   size="lg"
//                   variant="outline"
//                   className="text-lg px-10 py-6 font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
//                   onClick={handleScrollToContactForm}
//                 >
//                   Learn More & Get Started
//                   <ArrowDown className="w-5 h-5 ml-2" />
//                 </Button>
//               </motion.div>
//             </div>
//           </div>
//         </section>

//         <ContactForm />
//       </main>

//       <Footer />

//       {/* Enhanced mobile floating action button */}
//       {/* <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
//         <Button
//           onClick={handleScrollToContactForm}
//           className="w-full py-6 flex items-center justify-center gap-3 text-lg font-semibold shadow-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl border-0 hover:scale-105 transition-all duration-300"
//         >
//           <Rocket className="w-6 h-6" />
//           Join Pilot Program
//           <ArrowRight className="w-5 h-5" />
//         </Button>
//       </div> */}
//     </div>
//   );
// }
