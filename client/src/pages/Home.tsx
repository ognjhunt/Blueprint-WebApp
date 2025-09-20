// ===============================================
// FILE: src/pages/Home.tsx
// PURPOSE: Flagship Landing (Home) tuned for Durham Pilot conversion
// NOTES:
// - Premium "aurora glass" aesthetic with parallax orbs & grid
// - Subtle motion with prefers-reduced-motion guard
// - Sticky mobile CTA, above-the-fold trust chips, animated counters
// - Uses existing: Nav, Hero, WearableAIDemos, ContactForm, Footer
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
const WearableAIDemos = lazy(
  () => import("@/components/sections/WearableAIDemos"),
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

  //just to make changes, necessary again, yeeyee, testignasaprocky

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
      { icon: <Clock className="w-4 h-4" />, label: "60-min spatial capture" },
      {
        icon: <Smartphone className="w-4 h-4" />,
        label: "Smart glasses + phone ready",
      },
      {
        icon: <Sparkles className="w-4 h-4" />,
        label: "Hands-free AI concierge",
      },
      {
        icon: <BarChart3 className="w-4 h-4" />,
        label: "Live operations insights",
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
                    label: "60-min spatial capture",
                  },
                  {
                    icon: <Smartphone className="w-4 h-4" />,
                    label: "Smart glasses + phone ready",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Hands-free AI concierge",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Real-time operations insights",
                  },
                  {
                    icon: <ShieldCheck className="w-4 h-4" />,
                    label: "No hardware purchase required",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Trained on your brand",
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "White-glove onboarding",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Staff & visitor analytics",
                  },
                  // duplicate once for seamless loop:
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "60-min spatial capture",
                  },
                  {
                    icon: <Smartphone className="w-4 h-4" />,
                    label: "Smart glasses + phone ready",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Hands-free AI concierge",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Real-time operations insights",
                  },
                  {
                    icon: <ShieldCheck className="w-4 h-4" />,
                    label: "No hardware purchase required",
                  },
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    label: "Trained on your brand",
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: "White-glove onboarding",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    label: "Staff & visitor analytics",
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
                  <li>• Spatial scan that trains our AI</li>
                  <li>• Workflow design for staff & guests</li>
                  <li>• Glasses + phone activation kit</li>
                  <li>• Hands-on training session</li>
                  <li>• Engagement recap & next steps</li>
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
                      <li>• Capture & AI training</li>
                      <li>• Setup across glasses & phones</li>
                      <li>• Insight recap</li>
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
                  <li>• Spatial capture walk-through</li>
                  <li>• AI flows tuned to your brand</li>
                  <li>• Glasses + phone activation kit</li>
                  <li>• On-site enablement session</li>
                  <li>• Engagement & ops recap</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 mb-1">
                      We handle
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li>• Capture & AI training</li>
                      <li>• Setup across glasses & phones</li>
                      <li>• Insight recap</li>
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
                    Join the AI pilot
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Wearable AI demos (lazy) */}
        <Suspense
          fallback={
            <div className="container mx-auto px-4 py-16 text-center text-slate-300">
              Loading wearable AI demos…
            </div>
          }
        >
          <div
            style={{
              contentVisibility: "auto",
              contain: "paint",
              containIntrinsicSize: "1px 720px",
            }}
          >
            <WearableAIDemos />
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
                Ready to deliver an on-site AI solution?
              </h3>
              <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
                Smart glasses launches from Meta, Google, Apple, and Samsung are
                bringing hands-free AI into the mainstream. We help you capture
                your space, design the workflows, and test with your team in
                about 10 days. Two quick visits: a 60-minute scan and a 1–2 hour
                on-site demo. The pilot is free.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 justify-center">
                <Button
                  onClick={handleScrollToContact}
                  className="h-12 w-full text-base rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition will-change-transform"
                >
                  Join the AI glasses pilot (Free)
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

// // ===============================================
// // FILE: src/pages/Home.tsx
// // PURPOSE: Flagship Landing (Home) tuned for Durham Pilot conversion
// // NOTES:
// // - Premium "aurora glass" aesthetic with parallax orbs & grid
// // - Subtle motion with prefers-reduced-motion guard
// // - Sticky mobile CTA, above-the-fold trust chips, animated counters
// // - Uses existing: Nav, Hero, WearableAIDemos, ContactForm, Footer
// // ===============================================

// import React, {
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
//   lazy,
//   Suspense,
// } from "react";
// import { useLocation } from "wouter";
// import { useAuth } from "@/contexts/AuthContext";
// import Nav from "@/components/Nav";
// import Hero from "@/components/sections/Hero";
// // ↓ Lazy-load below-the-fold UI so the Home above-the-fold gets first paint fast
// const WearableAIDemos = lazy(
//   () => import("@/components/sections/WearableAIDemos"),
// );
// const ContactForm = lazy(() => import("@/components/sections/ContactForm"));
// import Footer from "@/components/Footer";
// import LindyChat from "@/components/LindyChat";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   motion,
//   useMotionValue,
//   useTransform,
//   useReducedMotion,
// } from "framer-motion";
// import {
//   ShieldCheck,
//   Clock,
//   Smartphone,
//   Sparkles,
//   BarChart3,
// } from "lucide-react";

// export default function Home() {
//   const { currentUser } = useAuth();
//   const [, setLocation] = useLocation();
//   const mainRef = useRef<HTMLDivElement>(null);
//   const contactRef = useRef<HTMLDivElement>(null);
//   const [isContactInView, setIsContactInView] = useState(false);
//   const [hasReachedContact, setHasReachedContact] = useState(false);
//   const shouldReduce = useReducedMotion();
//   // Only enable heavy visuals on larger screens without reduced motion

//   // Only enable heavy visuals on larger screens without reduced motion
//   const [useLightFX, setUseLightFX] = useState(false);
//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       const mql = window.matchMedia(
//         "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
//       );
//       setUseLightFX(mql.matches);
//     }
//   }, []);

//   //just to make changes, necessary again

//   useEffect(() => {
//     if (currentUser) setLocation("/dashboard");
//   }, [currentUser, setLocation]);

//   // 👇 Set up intersection observer
//   useEffect(() => {
//     const observer = new IntersectionObserver(
//       ([entry]) => setIsContactInView(entry.isIntersecting),
//       { threshold: 0.3 }, // adjust so it hides when ~30% of the contact section is visible
//     );
//     if (contactRef.current) observer.observe(contactRef.current);
//     return () => {
//       observer.disconnect();
//     };
//   }, []);

//   // Hide CTA once we've reached the contact section (and keep it hidden below)
//   useEffect(() => {
//     const computeReached = () => {
//       const el = contactRef.current;
//       if (!el) return;
//       const rect = el.getBoundingClientRect();
//       const contactTop = rect.top + window.scrollY;
//       const viewportBottom = window.scrollY + window.innerHeight;
//       // small buffer so it disappears a touch early
//       setHasReachedContact(viewportBottom >= contactTop - 8);
//     };

//     computeReached(); // initialize on first mount
//     window.addEventListener("scroll", computeReached, { passive: true });
//     window.addEventListener("resize", computeReached);

//     return () => {
//       window.removeEventListener("scroll", computeReached);
//       window.removeEventListener("resize", computeReached);
//     };
//   }, []);

//   const benefits = useMemo(
//     () => [
//       { icon: <Clock className="w-4 h-4" />, label: "60-min on-site setup" },
//       { icon: <Smartphone className="w-4 h-4" />, label: "No app required" },
//       {
//         icon: <Sparkles className="w-4 h-4" />,
//         label: "Custom AR for your space",
//       },
//       {
//         icon: <BarChart3 className="w-4 h-4" />,
//         label: "Live engagement analytics",
//       },
//     ],
//     [],
//   );

//   const handleScrollToContact = () => {
//     const el = document.getElementById("contactForm");
//     if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
//   };

//   // Parallax background orbs (desktop only, super subtle)
//   const mouseX = useMotionValue(0);
//   const mouseY = useMotionValue(0);
//   const orbX = useTransform(mouseX, [0, 1], ["-2%", "2%"]);
//   const orbY = useTransform(mouseY, [0, 1], ["-1%", "1%"]);

//   const onMouseMove = (e: React.MouseEvent) => {
//     if (shouldReduce) return;
//     const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
//     mouseX.set((e.clientX - rect.left) / rect.width);
//     mouseY.set((e.clientY - rect.top) / rect.height);
//   };

//   return (
//     <div
//       className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100"
//       onMouseMove={onMouseMove}
//     >
//       {/* BACKGROUND: aurora + grid + parallax blobs */}
//       <div
//         className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
//         style={{ contain: "paint" }}
//       >
//         {/* Soft grid (cheap) */}
//         <div
//           className="absolute inset-0 opacity-[0.08]"
//           style={{
//             background:
//               "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
//             backgroundSize: "32px 32px",
//           }}
//         />
//         {/* Aurora wash */}
//         <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
//         {/* Parallax blobs (desktop only) */}
//         {useLightFX && !shouldReduce && (
//           <>
//             <motion.div
//               style={{ x: orbX, y: orbY }}
//               className="absolute -top-40 -right-64 h-[50rem] w-[50rem] rounded-full md:blur-xl blur-none opacity-35 bg-gradient-to-br from-emerald-500/25 via-cyan-500/25 to-sky-500/10 will-change-transform"
//             />
//             <motion.div
//               style={{ x: orbX, y: orbY }}
//               className="absolute -bottom-56 -left-64 h-[46rem] w-[46rem] rounded-full md:blur-xl blur-none opacity-25 bg-gradient-to-tr from-cyan-500/15 via-emerald-500/15 to-amber-400/10 will-change-transform"
//             />
//           </>
//         )}
//         {/* No film-grain turbulence layer — it causes extra paints on scroll */}
//       </div>

//       <Nav />

//       <main ref={mainRef} className="flex-1 relative">
//         {/* HERO */}
//         <Hero onPrimaryCta={handleScrollToContact} />

//         {/* Benefit strip */}
//         <section
//           className="bg-[#0E172A]/90 py-4 border-y border-white/5"
//           style={{
//             contentVisibility: "auto",
//             contain: "paint",
//             containIntrinsicSize: "1px 240px",
//           }}
//         >
//           <div className="container mx-auto px-4 overflow-hidden">
//             <div className="marquee">
//               <div className="marquee__track">
//                 {[
//                   {
//                     icon: <Clock className="w-4 h-4" />,
//                     label: "60-min on-site setup",
//                   },
//                   {
//                     icon: <Smartphone className="w-4 h-4" />,
//                     label: "No app required",
//                   },
//                   {
//                     icon: <Sparkles className="w-4 h-4" />,
//                     label: "Custom AR for your space",
//                   },
//                   {
//                     icon: <BarChart3 className="w-4 h-4" />,
//                     label: "Live engagement analytics",
//                   },
//                   {
//                     icon: <ShieldCheck className="w-4 h-4" />,
//                     label: "No hardware cost",
//                   },
//                   {
//                     icon: <Sparkles className="w-4 h-4" />,
//                     label: "Works on headsets & glasses",
//                   },
//                   {
//                     icon: <Clock className="w-4 h-4" />,
//                     label: "White-glove onboarding",
//                   },
//                   {
//                     icon: <BarChart3 className="w-4 h-4" />,
//                     label: "Boosts customer engagement",
//                   },
//                   // duplicate once for seamless loop:
//                   {
//                     icon: <Clock className="w-4 h-4" />,
//                     label: "60-min on-site setup",
//                   },
//                   {
//                     icon: <Smartphone className="w-4 h-4" />,
//                     label: "No app required",
//                   },
//                   {
//                     icon: <Sparkles className="w-4 h-4" />,
//                     label: "Custom AR for your space",
//                   },
//                   {
//                     icon: <BarChart3 className="w-4 h-4" />,
//                     label: "Live engagement analytics",
//                   },
//                   {
//                     icon: <ShieldCheck className="w-4 h-4" />,
//                     label: "No hardware cost",
//                   },
//                   {
//                     icon: <Sparkles className="w-4 h-4" />,
//                     label: "Works on headsets & glasses",
//                   },
//                   {
//                     icon: <Clock className="w-4 h-4" />,
//                     label: "White-glove onboarding",
//                   },
//                   {
//                     icon: <BarChart3 className="w-4 h-4" />,
//                     label: "Boosts customer engagement",
//                   },
//                 ].map((b, i) => (
//                   <div
//                     key={i}
//                     className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-center gap-2"
//                   >
//                     <span className="text-emerald-300">{b.icon}</span>
//                     <span className="text-sm font-medium text-slate-100 whitespace-nowrap">
//                       {b.label}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* Quick Qualify (replaces the "Social proof / assurances" section) */}
//         <section className="bg-[#0B1220] py-8 md:py-12">
//           <div className="container mx-auto px-4">
//             {/* MOBILE: stacked, compact */}
//             <div className="md:hidden space-y-4">
//               {/* Are you a fit? */}
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
//                 <p className="text-sm font-semibold text-emerald-300 mb-1">
//                   Eligibility
//                 </p>
//                 <h3 className="text-lg font-bold text-white mb-3">
//                   Are you a fit?
//                 </h3>
//                 <ul className="grid grid-cols-2 gap-2 text-sm">
//                   {[
//                     "Durham ≤ 30-min drive",
//                     "Customer-facing space",
//                     "On-site point of contact",
//                     "~60-min access window",
//                   ].map((t) => (
//                     <li
//                       key={t}
//                       className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200"
//                     >
//                       {t}
//                     </li>
//                   ))}
//                 </ul>
//               </div>

//               {/* What’s included */}
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
//                 <p className="text-sm font-semibold text-cyan-300 mb-1">
//                   Included
//                 </p>
//                 <h3 className="text-lg font-bold text-white mb-3">
//                   What you’ll get
//                 </h3>
//                 <ul className="space-y-2 text-sm text-slate-300">
//                   <li>• LiDAR mapping of your space</li>
//                   <li>• Custom AR layer tailored to your brand</li>
//                   <li>• QR kit for instant access on-site</li>
//                   <li>• VR headset demo day for your team</li>
//                   <li>• Simple engagement recap & next-step options</li>
//                 </ul>
//               </div>

//               {/* Who does what + availability */}
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
//                 <div className="grid grid-cols-2 gap-4 mb-4">
//                   <div>
//                     <p className="text-xs font-semibold text-emerald-300 mb-1">
//                       We handle
//                     </p>
//                     <ul className="space-y-1 text-sm text-slate-300">
//                       <li>• Mapping & design</li>
//                       <li>• Setup & devices</li>
//                       <li>• Analytics recap</li>
//                     </ul>
//                   </div>
//                   <div>
//                     <p className="text-xs font-semibold text-cyan-300 mb-1">
//                       You provide
//                     </p>
//                     <ul className="space-y-1 text-sm text-slate-300">
//                       <li>• 60-min window</li>
//                       <li>• Logo/menu/product list</li>
//                       <li>• Quick feedback</li>
//                     </ul>
//                   </div>
//                 </div>

//                 <div className="flex flex-wrap items-center gap-2 mb-4">
//                   <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                     Two visits (~10 days)
//                   </span>
//                   <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                     Live demo 1–2 hrs
//                   </span>
//                   <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                     Replies &lt; 24h
//                   </span>
//                   <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                     Limited spots
//                   </span>
//                 </div>

//                 <Button
//                   onClick={handleScrollToContact}
//                   className="w-full rounded-xl h-12 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold shadow-xl"
//                 >
//                   Check my eligibility
//                 </Button>
//               </div>
//             </div>

//             {/* DESKTOP: compact 3-card grid */}
//             <div className="hidden md:grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
//                 <p className="text-sm font-semibold text-emerald-300 mb-1">
//                   Eligibility
//                 </p>
//                 <h3 className="text-xl font-bold text-white mb-3">
//                   Are you a fit?
//                 </h3>
//                 <ul className="grid grid-cols-2 gap-2 text-sm">
//                   {[
//                     "Durham ≤ 30-min",
//                     "Customer-facing",
//                     "POC on-site",
//                     "~60-min access",
//                   ].map((t) => (
//                     <li
//                       key={t}
//                       className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200"
//                     >
//                       {t}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
//                 <p className="text-sm font-semibold text-cyan-300 mb-1">
//                   Included
//                 </p>
//                 <h3 className="text-xl font-bold text-white mb-3">
//                   What you’ll get
//                 </h3>
//                 <ul className="space-y-2 text-sm text-slate-300">
//                   <li>• LiDAR mapping</li>
//                   <li>• Custom AR layer</li>
//                   <li>• QR kit</li>
//                   <li>• VR headset demo day</li>
//                   <li>• Engagement recap</li>
//                 </ul>
//               </div>
//               <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
//                 <div className="grid grid-cols-2 gap-4 mb-4">
//                   <div>
//                     <p className="text-xs font-semibold text-emerald-300 mb-1">
//                       We handle
//                     </p>
//                     <ul className="space-y-1 text-sm text-slate-300">
//                       <li>• Mapping & design</li>
//                       <li>• Setup & devices</li>
//                       <li>• Analytics recap</li>
//                     </ul>
//                   </div>
//                   <div>
//                     <p className="text-xs font-semibold text-cyan-300 mb-1">
//                       You provide
//                     </p>
//                     <ul className="space-y-1 text-sm text-slate-300">
//                       <li>• 60-min window</li>
//                       <li>• Brand assets</li>
//                       <li>• Feedback</li>
//                     </ul>
//                   </div>
//                 </div>

//                 <div className="mt-auto flex items-center justify-between gap-3">
//                   <div className="flex flex-wrap items-center gap-2">
//                     <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                       Replies &lt; 24h
//                     </span>
//                     <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
//                       Limited spots
//                     </span>
//                   </div>
//                   <Button
//                     onClick={handleScrollToContact}
//                     className="rounded-xl h-10 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"
//                   >
//                     Join the Pilot
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* Showcase (lazy) */}
//         <Suspense fallback={<div className="h-40" />}>
//           <div
//             style={{
//               contentVisibility: "auto",
//               contain: "paint",
//               containIntrinsicSize: "1px 720px",
//             }}
//           >
//             <WearableAIDemos />
//           </div>
//         </Suspense>

//         {/* Conversion block (no backdrop-blur) */}
//         <section
//           className="relative py-16"
//           style={{
//             contentVisibility: "auto",
//             contain: "paint",
//             containIntrinsicSize: "1px 560px",
//           }}
//         >
//           <div className="container mx-auto px-4">
//             <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-6 md:p-10 text-center overflow-hidden relative">
//               {/* light sweep */}
//               <div className="pointer-events-none absolute -top-1/2 left-1/2 h-[120%] w-[60%] -translate-x-1/2 rotate-12 bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
//               <h3 className="text-2xl md:text-4xl font-black text-white">
//                 Ready to put AR to work in your location?
//               </h3>
//               <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
//                 We’re onboarding businesses within a 30-minute drive of Durham.
//                 Two quick visits about a week apart: mapping (~60 min) and an
//                 on-site demo (1–2 hrs). The pilot is free.
//               </p>
//               <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 justify-center">
//                 <Button
//                   onClick={handleScrollToContact}
//                   className="h-12 w-full text-base rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition will-change-transform"
//                 >
//                   Join the Durham Pilot (Free)
//                 </Button>
//                 <a href="/pilot-program" className="w-full">
//                   <Button
//                     variant="outline"
//                     className="h-12 w-full text-base rounded-xl border-white/20 text-black hover:bg-white/10"
//                   >
//                     How the Pilot Works
//                   </Button>
//                 </a>
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* Contact (lazy) */}
//         <div
//           ref={contactRef}
//           id="contactForm"
//           style={{
//             contentVisibility: "auto",
//             contain: "paint",
//             containIntrinsicSize: "1px 680px",
//           }}
//         >
//           <Suspense fallback={<div className="h-40" />}>
//             <ContactForm />
//           </Suspense>
//         </div>
//       </main>

//       {/* Sticky mobile CTA */}
//       {!hasReachedContact && (
//         <div className="md:hidden sticky bottom-4 z-50 px-4">
//           <motion.div
//             initial={{ y: 40, opacity: 0 }}
//             animate={{ y: 0, opacity: 1 }}
//             transition={{ delay: 0.4 }}
//           >
//             <Button
//               onClick={handleScrollToContact}
//               className="w-full rounded-2xl h-14 text-base font-semibold shadow-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"
//             >
//               Join Pilot — Free Setup
//             </Button>
//           </motion.div>
//         </div>
//       )}

//       <Footer />
//       <LindyChat ctaVisible={!hasReachedContact} />
//     </div>
//   );
// }

// function AssuranceCard({
//   title,
//   headlineSuffix,
//   body,
//   accentClass,
// }: {
//   title: React.ReactNode;
//   headlineSuffix: string;
//   body: string;
//   accentClass?: string;
//   icon?: React.ReactNode;
// }) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 8 }}
//       whileInView={{ opacity: 1, y: 0 }}
//       viewport={{ once: true }}
//       transition={{ duration: 0.45 }}
//       className="rounded-2xl border border-white/10 bg-white/5 p-6"
//     >
//       <p className={`text-4xl font-black ${accentClass}`}>
//         {title}
//         {typeof title === "string" ? "" : ""}
//       </p>
//       <p className="mt-1 text-slate-200 font-semibold">{headlineSuffix}</p>
//       <p className="mt-2 text-sm text-slate-400">{body}</p>
//     </motion.div>
//   );
// }

// function Stat({ label, value }: { label: string; value: string }) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 6 }}
//       whileInView={{ opacity: 1, y: 0 }}
//       viewport={{ once: true }}
//       transition={{ duration: 0.35 }}
//       className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
//     >
//       <div className="text-xl font-extrabold text-white">{value}</div>
//       <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">
//         {label}
//       </div>
//     </motion.div>
//   );
// }
